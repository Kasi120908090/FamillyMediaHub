import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { backupService } from "./backupService";
import { BACKUP_QUEUE_STATUS, backupQueueMetaStore, backupQueueStore } from "./backupQueueStore";
import { ensureMediaLibraryPermissions } from "../utils/permissionHelper";

const SETTINGS_KEY = "@family-media-hub/backup-autosync-settings";
const DEFAULT_SCAN_LIMIT = 250;
const HEALTH_TIMEOUT_MS = 3000;

export const DEFAULT_AUTO_SYNC_SETTINGS = {
  enabled: true,
  intervalMinutes: 30,
  scanLimit: DEFAULT_SCAN_LIMIT,
  mediaTypes: ["photo", "video"],
};

let isRunning = false;

const stringToBytes = (value) => {
  const input = String(value || "");
  const bytes = new Uint8Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    bytes[index] = input.charCodeAt(index) & 0xff;
  }

  return bytes;
};

const quickSignature = (value) => {
  let hash = 2166136261;
  const bytes = stringToBytes(value);

  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

const createAutoBackupId = (asset, fileSize) =>
  `auto-${quickSignature(
    [
      asset.id,
      asset.uri,
      asset.filename,
      fileSize || asset.fileSize || 0,
      asset.modificationTime || asset.creationTime || 0,
    ].join("|")
  )}`;

const getMimeType = (asset) => {
  if (asset.mediaType === "video") {
    return "video/mp4";
  }

  if (asset.mediaType === "audio") {
    return "audio/mpeg";
  }

  return "image/jpeg";
};

const getFileSize = async (uri, fallbackSize = 0) => {
  if (!uri) {
    return Number(fallbackSize || 0);
  }

  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return Number(info?.size || fallbackSize || 0);
  } catch (error) {
    return Number(fallbackSize || 0);
  }
};

const getMediaPermission = async () => {
  const result = await ensureMediaLibraryPermissions();
  
  if (result.granted) {
    return true;
  }

  if (result.permanent) {
    throw new Error(`Media library permission denied permanently: ${result.message}`);
  }

  throw new Error(`Media library permission denied: ${result.message}`);
};

const normalizeMediaType = (mediaType) => {
  if (mediaType === "photo") {
    return "photo";
  }

  if (mediaType === "video") {
    return "video";
  }

  if (mediaType === "audio") {
    return "audio";
  }

  return null;
};

const getMediaLibraryTypeValue = (type) => {
  if (type === "photo") {
    return MediaLibrary.MediaType?.photo;
  }

  if (type === "video") {
    return MediaLibrary.MediaType?.video;
  }

  if (type === "audio") {
    return MediaLibrary.MediaType?.audio;
  }

  return null;
};

const getDeviceMediaCounts = async () => {
  const counts = {
    photo: 0,
    video: 0,
    audio: 0,
  };

  if (!MediaLibrary?.getAssetsAsync) {
    return counts;
  }

  for (const type of Object.keys(counts)) {
    const mediaType = getMediaLibraryTypeValue(type);

    if (!mediaType) {
      continue;
    }

    try {
      const response = await MediaLibrary.getAssetsAsync({
        first: 1,
        mediaType: [mediaType],
      });

      counts[type] = Number(response?.totalCount || response?.assets?.length || 0);
    } catch (error) {
      counts[type] = 0;
    }
  }

  return counts;
};

const scanMediaAssets = async (settings) => {
  if (!MediaLibrary?.getAssetsAsync) {
    return {
      assets: [],
      skippedReason: "expo-media-library is not installed",
    };
  }

  const hasPermission = await getMediaPermission();

  if (!hasPermission) {
    return {
      assets: [],
      skippedReason: "media library permission was not granted",
    };
  }

  const selectedMediaTypes = (settings.mediaTypes || DEFAULT_AUTO_SYNC_SETTINGS.mediaTypes)
    .map(normalizeMediaType)
    .filter(Boolean);
  const deviceCounts = await getDeviceMediaCounts();
  
  // Diagnostic logging
  console.log("[BackupScan] Selected media types:", selectedMediaTypes);
  console.log("[BackupScan] MediaLibrary.MediaType:", MediaLibrary.MediaType);
  
  // Map to correct MediaLibrary enum values
  let mediaTypeFilters = [];
  if (selectedMediaTypes.includes("photo") && getMediaLibraryTypeValue("photo")) {
    mediaTypeFilters.push(getMediaLibraryTypeValue("photo"));
  }
  if (selectedMediaTypes.includes("video") && getMediaLibraryTypeValue("video")) {
    mediaTypeFilters.push(getMediaLibraryTypeValue("video"));
  }
  if (selectedMediaTypes.includes("audio") && getMediaLibraryTypeValue("audio")) {
    mediaTypeFilters.push(getMediaLibraryTypeValue("audio"));
  }

  // If no valid media types found, fall back to just scanning with no filter
  const mediaType = mediaTypeFilters.length > 0 ? mediaTypeFilters : undefined;
  
  console.log("[BackupScan] Media type filters:", mediaTypeFilters);
  
  const limit = Math.max(1, Number(settings.scanLimit || DEFAULT_SCAN_LIMIT));
  const discovered = [];
  let after = null;

  while (discovered.length < limit) {
    try {
      const queryOptions = {
        first: Math.min(100, limit - discovered.length),
        after,
      };
      
      // Only add mediaType filter if we have valid types
      if (mediaType) {
        queryOptions.mediaType = mediaType;
      }
      
      // Add sort if available
      if (MediaLibrary.SortBy?.modificationTime) {
        queryOptions.sortBy = [MediaLibrary.SortBy.modificationTime];
      }

      console.log("[BackupScan] Query options:", queryOptions);

      const response = await MediaLibrary.getAssetsAsync(queryOptions);
      
      console.log("[BackupScan] Response batch - found", response?.assets?.length || 0, "assets");

      const pageAssets = Array.isArray(response?.assets) ? response.assets : [];
      discovered.push(...pageAssets);

      console.log("[BackupScan] Total discovered so far:", discovered.length);

      if (!response?.hasNextPage || !response?.endCursor) {
        console.log("[BackupScan] No more pages");
        break;
      }

      after = response.endCursor;
    } catch (error) {
      console.warn("[BackupScan] Error during scan:", error?.message);
      // Log error but continue - some assets might be unreadable
      break;
    }
  }

  console.log("[BackupScan] Total assets discovered:", discovered.length);

  const assets = [];
  const skipped = [];

  for (const asset of discovered) {
    try {
      // Try to get detailed info (requires ACCESS_MEDIA_LOCATION for EXIF)
      let info = asset;
      try {
        if (MediaLibrary.getAssetInfoAsync) {
          info = await MediaLibrary.getAssetInfoAsync(asset);
        }
      } catch (infoError) {
        // Fall back to basic asset info if getAssetInfoAsync fails
        // (e.g., missing ACCESS_MEDIA_LOCATION permission)
        console.warn("[BackupScan] Could not get detailed info, using basic asset info:", infoError?.message);
      }

      const uri = info?.localUri || info?.uri || asset.uri;
      
      // For photos, fileSize might be unavailable - use a default minimum
      // Videos usually have size, but photos might not
      let fileSize = await getFileSize(uri, info?.fileSize || asset.fileSize || 0);
      
      if (fileSize < 1) {
        console.warn("[BackupScan] Skipping asset - size is 0 or unreadable:", asset.filename);
        skipped.push(asset.filename || asset.id);
        continue;
      }

      if (!uri) {
        console.warn("[BackupScan] Skipping asset - no URI", { uri });
        continue;
      }

      console.log("[BackupScan] Added asset:", { 
        name: asset.filename, 
        size: fileSize, 
        mediaType: asset.mediaType,
        uri: uri.substring(0, 50) 
      });

      assets.push({
        id: createAutoBackupId(asset, fileSize),
        uri,
        name: asset.filename || info?.filename || `media-${asset.id}`,
        size: fileSize,
        mimeType: info?.mimeType || getMimeType(asset),
        mediaType: asset.mediaType,
      });
    } catch (error) {
      console.warn("[BackupScan] Error processing asset:", error?.message);
      // Keep scanning even if one asset cannot be resolved to a readable file URI.
    }
  }

  console.log("[BackupScan] Final assets after filtering:", assets.length);
  return { assets, discoveredCount: discovered.length, skipped, deviceCounts };
};

const mergeSettings = (settings) => ({
  ...DEFAULT_AUTO_SYNC_SETTINGS,
  ...(settings || {}),
});

const withTimeoutSignal = (timeoutMs) => {
  if (typeof AbortController === "undefined") {
    return { signal: undefined, cleanup: () => {} };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
};

const getQueuedIds = async () => {
  const items = await backupQueueStore.getAll();
  const activeStatuses = [
    BACKUP_QUEUE_STATUS.PENDING,
    BACKUP_QUEUE_STATUS.UPLOADING,
    BACKUP_QUEUE_STATUS.COMPLETE,
  ];

  return new Set(
    items
      .filter((item) => activeStatuses.includes(item.status))
      .map((item) => item.id)
  );
};

const getAssetTypeStats = (assets) => {
  const stats = {
    photo: { count: 0, bytes: 0 },
    video: { count: 0, bytes: 0 },
    file: { count: 0, bytes: 0 },
  };

  for (const asset of assets) {
    const type = stats[asset.mediaType] ? asset.mediaType : "file";
    stats[type].count += 1;
    stats[type].bytes += Number(asset.size || 0);
  }

  return stats;
};

export const backupAutoSyncService = {
  getSettings: async () => {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return mergeSettings(raw ? JSON.parse(raw) : null);
  },

  updateSettings: async (updates) => {
    const nextSettings = mergeSettings({
      ...(await backupAutoSyncService.getSettings()),
      ...updates,
    });
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    return nextSettings;
  },

  scanAndEnqueue: async ({ deviceId, childId, settings } = {}) => {
    if (!deviceId) {
      await backupQueueMetaStore.merge({
        last_autosync_scan_error: "no backup device is linked",
      });
      return { queued: [], scanned: 0, skippedReason: "no backup device is linked" };
    }

    const scanResult = await scanMediaAssets(mergeSettings(settings));

    if (scanResult.skippedReason) {
      await backupQueueMetaStore.merge({
        last_autosync_scan_error: scanResult.skippedReason,
      });
      return { queued: [], scanned: 0, skippedReason: scanResult.skippedReason };
    }

    await backupQueueStore.init();
    const queuedIds = await getQueuedIds();
    const newAssets = scanResult.assets.filter((asset) => !queuedIds.has(asset.id));
    const typeStats = getAssetTypeStats(scanResult.assets);
    const queued = await backupService.enqueueAssets(newAssets, {
      device_id: deviceId,
      child_id: childId,
    });

    await backupQueueMetaStore.merge({
      last_autosync_scan_at: new Date().toISOString(),
      last_autosync_scan_count: scanResult.assets.length,
      last_autosync_discovered_count: scanResult.discoveredCount || scanResult.assets.length,
      last_autosync_enqueue_count: queued.length,
      last_autosync_photo_count: typeStats.photo.count,
      last_autosync_photo_bytes: typeStats.photo.bytes,
      last_autosync_photo_device_count: scanResult.deviceCounts?.photo || typeStats.photo.count,
      last_autosync_video_count: typeStats.video.count,
      last_autosync_video_bytes: typeStats.video.bytes,
      last_autosync_video_device_count: scanResult.deviceCounts?.video || typeStats.video.count,
      last_autosync_file_count: typeStats.file.count,
      last_autosync_file_bytes: typeStats.file.bytes,
      last_autosync_scan_error: "",
      last_autosync_skipped_count: scanResult.skipped.length,
      last_autosync_skipped_list: scanResult.skipped,
    });

    return { queued, scanned: scanResult.assets.length };
  },

  runOnce: async ({ token, deviceId, childId, settings, onProgress } = {}) => {
    const resolvedSettings = mergeSettings(settings || (await backupAutoSyncService.getSettings()));

    if (!resolvedSettings.enabled || !token || !deviceId || isRunning) {
      return { skipped: true };
    }

    isRunning = true;

    try {
      await backupQueueMetaStore.merge({
        last_autosync_running: true,
        last_autosync_phase: "checking_server",
        last_autosync_error: "",
      });

      const healthTimeout = withTimeoutSignal(HEALTH_TIMEOUT_MS);

      try {
        await backupService.checkHealth(token, { signal: healthTimeout.signal });
      } finally {
        healthTimeout.cleanup();
      }

      await backupQueueMetaStore.merge({
        last_autosync_phase: "scanning",
      });

      const scanResult = await backupAutoSyncService.scanAndEnqueue({
        deviceId,
        childId,
        settings: resolvedSettings,
      });
      await backupQueueMetaStore.merge({
        last_autosync_phase: "uploading",
      });

      const completed = await backupService.resumeQueue(token, {
        onProgress: async (progress) => {
          await backupQueueMetaStore.merge({
            last_autosync_phase: progress.phase || "uploading",
            last_autosync_current_file: progress.item?.file_name || "",
            last_autosync_bytes_received: progress.bytesReceived || 0,
            last_autosync_total_bytes: progress.totalBytes || 0,
          });
          onProgress?.(progress);
        },
      });

      await backupQueueMetaStore.merge({
        last_autosync_at: new Date().toISOString(),
        last_autosync_completed_count: completed.length,
        last_autosync_error: "",
        last_autosync_phase: "idle",
        last_autosync_running: false,
      });

      return {
        ...scanResult,
        completed,
      };
    } catch (error) {
      await backupQueueMetaStore.merge({
        last_autosync_error: error?.message || "Auto sync failed",
        last_autosync_phase: "failed",
        last_autosync_running: false,
      });
      throw error;
    } finally {
      isRunning = false;
    }
  },

  /**
   * Manually scan device media without waiting for auto-sync interval
   * Returns detailed scan results for UI display
   */
  scanMediaNow: async ({ deviceId, childId, settings } = {}) => {
    if (!deviceId) {
      return {
        queued: [],
        scanned: 0,
        skippedReason: "no backup device is linked",
        permissionError: false,
      };
    }

    try {
      // Ensure we have permission before scanning
      const scanResult = await scanMediaAssets(mergeSettings(settings));

      if (scanResult.skippedReason) {
        const isPermissionError = scanResult.skippedReason.includes("permission");
        return {
          queued: [],
          scanned: 0,
          skippedReason: scanResult.skippedReason,
          permissionError: isPermissionError,
        };
      }

      // Queue the scanned assets
      await backupQueueStore.init();
      const queuedIds = await getQueuedIds();
      const newAssets = scanResult.assets.filter((asset) => !queuedIds.has(asset.id));
      const typeStats = getAssetTypeStats(scanResult.assets);

      const queued = await backupService.enqueueAssets(newAssets, {
        device_id: deviceId,
        child_id: childId,
      });

      // Update metadata
      await backupQueueMetaStore.merge({
        last_autosync_manual_scan_at: new Date().toISOString(),
        last_autosync_scan_count: scanResult.assets.length,
        last_autosync_discovered_count: scanResult.discoveredCount || scanResult.assets.length,
        last_autosync_enqueue_count: queued.length,
        last_autosync_photo_count: typeStats.photo.count,
        last_autosync_photo_bytes: typeStats.photo.bytes,
        last_autosync_photo_device_count: scanResult.deviceCounts?.photo || typeStats.photo.count,
        last_autosync_video_count: typeStats.video.count,
        last_autosync_video_bytes: typeStats.video.bytes,
        last_autosync_video_device_count: scanResult.deviceCounts?.video || typeStats.video.count,
        last_autosync_file_count: typeStats.file.count,
        last_autosync_file_bytes: typeStats.file.bytes,
        last_autosync_scan_error: "",
        last_autosync_skipped_count: scanResult.skipped.length,
        last_autosync_skipped_list: scanResult.skipped,
      });

      return {
        queued,
        scanned: scanResult.assets.length,
        discovered: scanResult.discoveredCount || scanResult.assets.length,
        permissionError: false,
        stats: typeStats,
      };
    } catch (error) {
      await backupQueueMetaStore.merge({
        last_autosync_scan_error: error?.message || "Manual scan failed",
      });

      return {
        queued: [],
        scanned: 0,
        error: error?.message,
        permissionError: error?.message?.includes("permission"),
      };
    }
  },

  /**
   * Get current media library permission status
   */
  getPermissionStatus: async () => {
    const result = await ensureMediaLibraryPermissions();
    return {
      granted: result.granted,
      alreadyGranted: result.alreadyGranted,
      permanent: result.permanent,
      message: result.message,
    };
  },

  /**
   * Diagnostic function to check what media is on the device
   * Useful for debugging why photos/videos aren't being scanned
   */
  getDiagnostics: async () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      hasMediaLibrary: Boolean(MediaLibrary?.getAssetsAsync),
      hasPermissions: false,
      mediaTypeEnum: MediaLibrary?.MediaType || null,
      sortByEnum: MediaLibrary?.SortBy || null,
      allMedia: [],
      photoCount: 0,
      videoCount: 0,
      audioCount: 0,
      error: null,
    };

    try {
      // Check permission
      const permCheck = await ensureMediaLibraryPermissions();
      diagnostics.hasPermissions = permCheck.granted;

      if (!diagnostics.hasPermissions) {
        diagnostics.error = `Permission check failed: ${permCheck.message}`;
        return diagnostics;
      }

      // Scan ALL media without any filters to see what's there
      const response = await MediaLibrary.getAssetsAsync({
        first: 500, // Get first 500 items
      });

      if (Array.isArray(response?.assets)) {
        diagnostics.allMedia = response.assets.map((asset) => ({
          id: asset.id,
          filename: asset.filename,
          mediaType: asset.mediaType,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          creationTime: asset.creationTime,
          modificationTime: asset.modificationTime,
        }));

        // Count by type
        for (const asset of response.assets) {
          if (asset.mediaType === "photo") {
            diagnostics.photoCount += 1;
          } else if (asset.mediaType === "video") {
            diagnostics.videoCount += 1;
          } else if (asset.mediaType === "audio") {
            diagnostics.audioCount += 1;
          }
        }
      }
    } catch (error) {
      diagnostics.error = error?.message;
    }

    console.log("[BackupDiagnostics]", JSON.stringify(diagnostics, null, 2));
    return diagnostics;
  },
};
