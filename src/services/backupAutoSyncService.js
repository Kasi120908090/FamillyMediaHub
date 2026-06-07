import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { backupService } from "./backupService";
import { BACKUP_QUEUE_STATUS, backupQueueMetaStore, backupQueueStore } from "./backupQueueStore";
import { ensureMediaLibraryPermissions } from "../utils/permissionHelper";

const SETTINGS_KEY = "@family-media-hub/backup-autosync-settings";
const DEFAULT_SCAN_LIMIT = 250;
const HEALTH_TIMEOUT_MS = 3000;
const STOPPED_REASON = "auto sync is disabled";

export const DEFAULT_AUTO_SYNC_SETTINGS = {
  enabled: true,
  intervalMinutes: 30,
  scanLimit: DEFAULT_SCAN_LIMIT,
  mediaTypes: ["photo", "video"],
};

let isRunning = false;
let stopRequested = false;

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

const mergeSettings = (settings) => ({
  ...DEFAULT_AUTO_SYNC_SETTINGS,
  ...(settings || {}),
});

const isAutoSyncEnabled = async (settings) => {
  const resolvedSettings = mergeSettings(settings || (await backupAutoSyncService.getSettings()));
  return Boolean(resolvedSettings.enabled) && !stopRequested;
};

const getStopResult = () => ({
  queued: [],
  scanned: 0,
  skipped: true,
  skippedReason: STOPPED_REASON,
});

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
  if (!(await isAutoSyncEnabled(settings))) {
    return {
      assets: [],
      skippedReason: STOPPED_REASON,
    };
  }

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

  console.log("[BackupScan] Selected media types:", selectedMediaTypes);
  console.log("[BackupScan] MediaLibrary.MediaType:", MediaLibrary.MediaType);

  const mediaTypeFilters = [];
  if (selectedMediaTypes.includes("photo") && getMediaLibraryTypeValue("photo")) {
    mediaTypeFilters.push(getMediaLibraryTypeValue("photo"));
  }
  if (selectedMediaTypes.includes("video") && getMediaLibraryTypeValue("video")) {
    mediaTypeFilters.push(getMediaLibraryTypeValue("video"));
  }
  if (selectedMediaTypes.includes("audio") && getMediaLibraryTypeValue("audio")) {
    mediaTypeFilters.push(getMediaLibraryTypeValue("audio"));
  }

  const mediaType = mediaTypeFilters.length > 0 ? mediaTypeFilters : undefined;

  console.log("[BackupScan] Media type filters:", mediaTypeFilters);

  const limit = Math.max(1, Number(settings.scanLimit || DEFAULT_SCAN_LIMIT));
  const discovered = [];
  let after = null;

  while (discovered.length < limit) {
    if (!(await isAutoSyncEnabled(settings))) {
      return {
        assets: [],
        skippedReason: STOPPED_REASON,
      };
    }

    try {
      const queryOptions = {
        first: Math.min(100, limit - discovered.length),
        after,
      };

      if (mediaType) {
        queryOptions.mediaType = mediaType;
      }

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
      break;
    }
  }

  console.log("[BackupScan] Total assets discovered:", discovered.length);

  const assets = [];
  const skipped = [];

  for (const asset of discovered) {
    if (!(await isAutoSyncEnabled(settings))) {
      return {
        assets: [],
        skippedReason: STOPPED_REASON,
      };
    }

    try {
      let info = asset;
      try {
        if (MediaLibrary.getAssetInfoAsync) {
          info = await MediaLibrary.getAssetInfoAsync(asset);
        }
      } catch (infoError) {
        console.warn("[BackupScan] Could not get detailed info, using basic asset info:", infoError?.message);
      }

      const uri = info?.localUri || info?.uri || asset.uri;
      const fileSize = await getFileSize(uri, info?.fileSize || asset.fileSize || 0);

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
        uri: uri.substring(0, 50),
      });

      assets.push({
        id: createAutoBackupId(asset, fileSize),
        uri,
        name: asset.filename || info?.filename || `media-${asset.id}`,
        size: fileSize,
        mimeType: info?.mimeType || getMimeType(asset),
        duration: asset.duration,
        mediaType: asset.mediaType,
      });
    } catch (error) {
      console.warn("[BackupScan] Error processing asset:", error?.message);
    }
  }

  console.log("[BackupScan] Final assets after filtering:", assets.length);
  return { assets, discoveredCount: discovered.length, skipped, deviceCounts };
};

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

    if (updates?.enabled === false) {
      stopRequested = true;
      isRunning = false;
      await backupQueueMetaStore.merge({
        last_autosync_running: false,
        last_autosync_phase: "stopped",
        last_autosync_error: "",
      });
    }

    if (updates?.enabled === true) {
      stopRequested = false;
      await backupQueueMetaStore.merge({
        last_autosync_phase: "idle",
        last_autosync_error: "",
      });
    }

    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    return nextSettings;
  },

  stopNow: async () => {
    stopRequested = true;
    isRunning = false;

    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...(await backupAutoSyncService.getSettings()),
        enabled: false,
      })
    );

    await backupQueueMetaStore.merge({
      last_autosync_running: false,
      last_autosync_phase: "stopped",
      last_autosync_error: "",
      last_autosync_scan_error: "",
    });

    return { stopped: true, skippedReason: STOPPED_REASON };
  },

  startNow: async () => {
    stopRequested = false;
    const nextSettings = await backupAutoSyncService.updateSettings({ enabled: true });
    return nextSettings;
  },

  scanAndEnqueue: async ({ deviceId, childId, settings } = {}) => {
    const resolvedSettings = mergeSettings(settings || (await backupAutoSyncService.getSettings()));

    if (!resolvedSettings.enabled || stopRequested) {
      await backupQueueMetaStore.merge({
        last_autosync_scan_error: "",
        last_autosync_phase: "stopped",
        last_autosync_running: false,
      });
      return getStopResult();
    }

    if (!deviceId) {
      await backupQueueMetaStore.merge({
        last_autosync_scan_error: "no backup device is linked",
      });
      return { queued: [], scanned: 0, skippedReason: "no backup device is linked" };
    }

    const scanResult = await scanMediaAssets(resolvedSettings);

    if (scanResult.skippedReason) {
      await backupQueueMetaStore.merge({
        last_autosync_scan_error: scanResult.skippedReason === STOPPED_REASON ? "" : scanResult.skippedReason,
        last_autosync_phase: scanResult.skippedReason === STOPPED_REASON ? "stopped" : "idle",
        last_autosync_running: false,
      });
      return { queued: [], scanned: 0, skippedReason: scanResult.skippedReason };
    }

    if (!(await isAutoSyncEnabled(resolvedSettings))) {
      return getStopResult();
    }

    await backupQueueStore.init();
    const allQueued = await backupQueueStore.getAll();
    const activeStatuses = [
      BACKUP_QUEUE_STATUS.PENDING,
      BACKUP_QUEUE_STATUS.UPLOADING,
      BACKUP_QUEUE_STATUS.COMPLETE,
    ];
    const activeQueuedIds = new Set(
      allQueued.filter((i) => activeStatuses.includes(i.status)).map((i) => i.id)
    );
    const queuedMap = new Map(allQueued.map((i) => [i.id, i]));

    const newAssets = [];
    const migrationPromises = [];

    for (const asset of scanResult.assets) {
      if (!(await isAutoSyncEnabled(resolvedSettings))) {
        return getStopResult();
      }

      const existing = queuedMap.get(asset.id);
      if (!activeQueuedIds.has(asset.id)) {
        newAssets.push(asset);
      } else if (existing && !existing.duration && asset.duration > 0) {
        migrationPromises.push(backupQueueStore.update(asset.id, { duration: asset.duration }));
      }
    }

    const typeStats = getAssetTypeStats(scanResult.assets);
    const queued = await backupService.enqueueAssets(newAssets, {
      device_id: deviceId,
      child_id: childId,
    });

    if (migrationPromises.length > 0) {
      await Promise.all(migrationPromises);
    }

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

    if (!resolvedSettings.enabled || stopRequested || !token || !deviceId || isRunning) {
      return { skipped: true, skippedReason: !resolvedSettings.enabled || stopRequested ? STOPPED_REASON : undefined };
    }

    stopRequested = false;
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

      if (!(await isAutoSyncEnabled(resolvedSettings))) {
        return getStopResult();
      }

      await backupQueueMetaStore.merge({
        last_autosync_phase: "scanning",
      });

      const scanResult = await backupAutoSyncService.scanAndEnqueue({
        deviceId,
        childId,
        settings: resolvedSettings,
      });

      if (scanResult.skippedReason === STOPPED_REASON || !(await isAutoSyncEnabled(resolvedSettings))) {
        await backupQueueMetaStore.merge({
          last_autosync_phase: "stopped",
          last_autosync_running: false,
        });
        return {
          ...scanResult,
          completed: [],
        };
      }

      await backupQueueMetaStore.merge({
        last_autosync_phase: "uploading",
      });

      const completed = await backupService.resumeQueue(token, {
        shouldContinue: async () => backupAutoSyncService.isEnabled(),
        onProgress: async (progress) => {
          if (!(await backupAutoSyncService.isEnabled())) {
            return;
          }

          await backupQueueMetaStore.merge({
            last_autosync_phase: progress.phase || "uploading",
            last_autosync_current_file: progress.item?.file_name || "",
            last_autosync_bytes_received: progress.bytesReceived || 0,
            last_autosync_total_bytes: progress.totalBytes || 0,
          });
          onProgress?.(progress);
        },
      });

      if (!(await isAutoSyncEnabled(resolvedSettings))) {
        await backupQueueMetaStore.merge({
          last_autosync_phase: "stopped",
          last_autosync_running: false,
        });
        return {
          ...scanResult,
          completed,
          skippedReason: STOPPED_REASON,
        };
      }

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
      const stopped = error?.message === STOPPED_REASON || stopRequested;

      await backupQueueMetaStore.merge({
        last_autosync_error: stopped ? "" : error?.message || "Auto sync failed",
        last_autosync_phase: stopped ? "stopped" : "failed",
        last_autosync_running: false,
      });

      if (stopped) {
        return getStopResult();
      }

      throw error;
    } finally {
      isRunning = false;
    }
  },

  scanMediaNow: async ({ deviceId, childId, settings } = {}) => {
    const resolvedSettings = mergeSettings(settings || (await backupAutoSyncService.getSettings()));

    if (!resolvedSettings.enabled || stopRequested) {
      return {
        ...getStopResult(),
        permissionError: false,
      };
    }

    if (!deviceId) {
      return {
        queued: [],
        scanned: 0,
        skippedReason: "no backup device is linked",
        permissionError: false,
      };
    }

    try {
      const scanResult = await scanMediaAssets(resolvedSettings);

      if (scanResult.skippedReason) {
        const isPermissionError = scanResult.skippedReason.includes("permission");
        return {
          queued: [],
          scanned: 0,
          skippedReason: scanResult.skippedReason,
          permissionError: isPermissionError,
        };
      }

      if (!(await isAutoSyncEnabled(resolvedSettings))) {
        return {
          ...getStopResult(),
          permissionError: false,
        };
      }

      await backupQueueStore.init();
      const allQueued = await backupQueueStore.getAll();
      const queuedMap = new Map(allQueued.map((item) => [item.id, item]));

      const newAssets = [];
      const migrationPromises = [];

      for (const asset of scanResult.assets) {
        if (!(await isAutoSyncEnabled(resolvedSettings))) {
          return {
            ...getStopResult(),
            permissionError: false,
          };
        }

        const existing = queuedMap.get(asset.id);
        if (!existing) {
          newAssets.push(asset);
        } else if ((existing.duration === 0 || !existing.duration) && asset.duration > 0) {
          migrationPromises.push(backupQueueStore.update(asset.id, { duration: asset.duration }));
        }
      }

      const typeStats = getAssetTypeStats(scanResult.assets);

      const queued = await backupService.enqueueAssets(newAssets, {
        device_id: deviceId,
        child_id: childId,
      });

      if (migrationPromises.length > 0) {
        await Promise.all(migrationPromises);
      }

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
      const stopped = error?.message === STOPPED_REASON || stopRequested;

      await backupQueueMetaStore.merge({
        last_autosync_scan_error: stopped ? "" : error?.message || "Manual scan failed",
        last_autosync_phase: stopped ? "stopped" : undefined,
        last_autosync_running: false,
      });

      return {
        queued: [],
        scanned: 0,
        error: stopped ? undefined : error?.message,
        skippedReason: stopped ? STOPPED_REASON : undefined,
        permissionError: error?.message?.includes("permission"),
      };
    }
  },

  isEnabled: async () => {
    const settings = await backupAutoSyncService.getSettings();
    return Boolean(settings.enabled) && !stopRequested;
  },

  getPermissionStatus: async () => {
    const result = await ensureMediaLibraryPermissions();
    return {
      granted: result.granted,
      alreadyGranted: result.alreadyGranted,
      permanent: result.permanent,
      message: result.message,
    };
  },

  requestPermission: async () => {
    const result = await ensureMediaLibraryPermissions();
    return {
      granted: result.granted,
      alreadyGranted: result.alreadyGranted,
      permanent: result.permanent,
      message: result.message,
    };
  },

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
      const permCheck = await ensureMediaLibraryPermissions();
      diagnostics.hasPermissions = permCheck.granted;

      if (!diagnostics.hasPermissions) {
        diagnostics.error = `Permission check failed: ${permCheck.message}`;
        return diagnostics;
      }

      const response = await MediaLibrary.getAssetsAsync({
        first: 500,
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
