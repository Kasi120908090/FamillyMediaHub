import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  InteractionManager,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { backupAutoSyncService } from "../../services/backupAutoSyncService";
import { backupService } from "../../services/backupService";

const bytesToGb = (bytes = 0) => `${(Number(bytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`;

const formatCount = (value = 0) => Number(value || 0).toLocaleString();

const getFileKind = (item) => {
  const type = String(item.content_type || "").toLowerCase();
  const name = String(item.file_name || "").toLowerCase();

  if (type.startsWith("video/") || /\.(mp4|mov|mkv|avi)$/.test(name)) {
    return "video";
  }

  if (type.startsWith("image/") || /\.(jpg|jpeg|png|heic|webp)$/.test(name)) {
    return "photo";
  }

  return "file";
};

const formatLastBackup = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not yet";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function BackupSettingsScreen({ navigation, onOpenMenu }) {
  const { currentUser, parentDevices } = useAuth();
  const [settings, setSettings] = useState(null);
  const [snapshot, setSnapshot] = useState({ items: [], meta: {}, storageType: "pending" });
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const mediaTypes = settings?.mediaTypes || [];
  const photos = mediaTypes.includes("photo");
  const videos = mediaTypes.includes("video");
  const files = mediaTypes.includes("file");
  const deviceId =
    currentUser?.device_id ||
    currentUser?.deviceId ||
    currentUser?.device?.id ||
    parentDevices?.[0]?.id ||
    null;

  const backupStats = useMemo(() => {
    const items = snapshot.items || [];
    const scannedStats = {
      photo: {
        count: Number(snapshot.meta?.last_autosync_photo_count || 0),
        bytes: Number(snapshot.meta?.last_autosync_photo_bytes || 0),
        deviceCount: Number(snapshot.meta?.last_autosync_photo_device_count || 0),
      },
      video: {
        count: Number(snapshot.meta?.last_autosync_video_count || 0),
        bytes: Number(snapshot.meta?.last_autosync_video_bytes || 0),
        deviceCount: Number(snapshot.meta?.last_autosync_video_device_count || 0),
      },
      file: {
        count: Number(snapshot.meta?.last_autosync_file_count || 0),
        bytes: Number(snapshot.meta?.last_autosync_file_bytes || 0),
        deviceCount: Number(snapshot.meta?.last_autosync_file_count || 0),
      },
    };
    const queuedStats = {
      photo: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      file: { count: 0, bytes: 0 },
    };
    const queueStats = {
      pending: 0,
      uploading: 0,
      complete: 0,
      failed: 0,
    };
    const uploadedStats = {
      photo: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      file: { count: 0, bytes: 0 },
    };

    for (const item of items) {
      const kind = getFileKind(item);
      const size = Number(item.file_size || 0);
      const status = String(item.status || "").toUpperCase();

      queuedStats[kind].count += 1;
      queuedStats[kind].bytes += size;

      if (status === "COMPLETE") {
        queueStats.complete += 1;
        uploadedStats[kind].count += 1;
        uploadedStats[kind].bytes += size;
      } else if (status === "FAILED") {
        queueStats.failed += 1;
      } else if (status === "UPLOADING") {
        queueStats.uploading += 1;
      } else {
        queueStats.pending += 1;
      }
    }

    const makeTypeStats = (kind) => {
      const scanned = scannedStats[kind];
      const queued = queuedStats[kind];
      const uploaded = uploadedStats[kind];
      const totalCount = Math.max(scanned.deviceCount || 0, scanned.count, queued.count, uploaded.count);
      const totalBytes = Math.max(scanned.bytes, queued.bytes, uploaded.bytes);

      return {
        uploadedCount: uploaded.count || (totalCount && !queued.count ? totalCount : 0),
        totalCount,
        bytes: totalBytes,
      };
    };

    return {
      photo: makeTypeStats("photo"),
      video: makeTypeStats("video"),
      file: makeTypeStats("file"),
      queue: queueStats,
      totalCount: items.length,
    };
  }, [snapshot.items, snapshot.meta]);

  const loadState = useCallback(async () => {
    const [nextSettings, nextSnapshot] = await Promise.all([
      backupAutoSyncService.getSettings(),
      backupService.getQueueSnapshot(),
    ]);

    setSettings(nextSettings);
    setSnapshot(nextSnapshot);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let intervalId;

    const task = InteractionManager.runAfterInteractions(() => {
      if (isCancelled) {
        return;
      }

      loadState().catch(() => {});
      intervalId = setInterval(() => {
        loadState().catch(() => {});
      }, 5000);
    });

    return () => {
      isCancelled = true;
      task.cancel();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loadState]);

  const updateMediaType = async (type, enabled) => {
    const nextMediaTypes = new Set(settings?.mediaTypes || []);

    if (enabled) {
      nextMediaTypes.add(type);
    } else {
      nextMediaTypes.delete(type);
    }

    const nextSettings = await backupAutoSyncService.updateSettings({
      mediaTypes: Array.from(nextMediaTypes),
    });
    setSettings(nextSettings);
  };

  const toggleAutoSync = async (enabled) => {
    const nextSettings = await backupAutoSyncService.updateSettings({ enabled });
    setSettings(nextSettings);
  };

  const scanNow = async () => {
    if (isScanning || !deviceId) {
      return;
    }

    setScanMessage("");
    setIsScanning(true);

    try {
      // First check permission status
      const permStatus = await backupAutoSyncService.getPermissionStatus();
      
      if (!permStatus.granted) {
        // Request permission
        const reqResult = await backupAutoSyncService.requestPermission();
        
        if (!reqResult.granted) {
          setScanMessage(
            reqResult.permanent
              ? "❌ Permission permanently denied. Enable in Settings > Apps > Family Media Hub > Permissions > Photos"
              : "❌ Permission denied. Please allow access to photos and videos."
          );
          setIsScanning(false);
          return;
        }
      }

      // Now scan
      const scanResult = await backupAutoSyncService.scanMediaNow({
        deviceId,
        childId: currentUser?.child_id || currentUser?.childId || currentUser?.child?.id,
        settings,
      });

      if (scanResult.error) {
        setScanMessage(`❌ Scan failed: ${scanResult.error}`);
      } else if (scanResult.skippedReason) {
        setScanMessage(`⚠️ ${scanResult.skippedReason}`);
      } else {
        const queuedMsg = scanResult.queued?.length 
          ? ` - ${scanResult.queued.length} new items queued`
          : "";
        setScanMessage(`✅ Scan complete: Found ${scanResult.scanned} items${queuedMsg}`);
      }

      // Reload state
      await loadState();
    } catch (error) {
      setScanMessage(`❌ Error: ${error?.message || "Unknown error"}`);
    } finally {
      setIsScanning(false);
      // Clear message after 5 seconds
      setTimeout(() => setScanMessage(""), 5000);
    }
  };

  const showSkippedList = () => {
    const list = snapshot.meta?.last_autosync_skipped_list;
    if (!list || list.length === 0) {
      Alert.alert("No files skipped", "The last scan didn't skip any files.");
      return;
    }
    Alert.alert("Skipped Files", `The following ${list.length} files were skipped (0 bytes):\n\n${list.slice(0, 10).join('\n')}${list.length > 10 ? '\n...and more' : ''}`);
  };

  const autoSyncRunning = Boolean(snapshot.meta?.last_autosync_running);
  const statusTitle = snapshot.meta?.last_autosync_error
    ? "Backup needs attention"
    : autoSyncRunning
    ? `Auto sync ${String(snapshot.meta?.last_autosync_phase || "running").replace(/_/g, " ")}`
    : settings?.enabled
    ? "Auto sync is on"
    : "Auto sync is off";
  const statusDetail = snapshot.meta?.last_autosync_error
    ? snapshot.meta.last_autosync_error
    : autoSyncRunning && snapshot.meta?.last_autosync_current_file
    ? snapshot.meta.last_autosync_current_file
    : `Last backup: ${formatLastBackup(snapshot.meta?.last_autosync_at)}`;

  return (
    <View style={styles.darkContainer}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.darkHeader}>
          <TouchableOpacity
            style={styles.darkHeaderButton}
            onPress={() => (onOpenMenu ? onOpenMenu() : navigation.goBack())}
          >
            <Ionicons name="chevron-back" size={24} color="#5B3FFF" />
          </TouchableOpacity>

          <Text style={styles.darkHeaderTitle}>Photo Backup</Text>

          <TouchableOpacity style={styles.darkHeaderButton} onPress={scanNow} disabled={isScanning || !deviceId}>
            <Ionicons name={isScanning ? "sync" : "scan-outline"} size={22} color="#5B3FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.darkToggleCard}>
          <Text style={styles.darkToggleTitle}>Photo Backup</Text>
          <Switch
            value={Boolean(settings?.enabled)}
            onValueChange={toggleAutoSync}
            trackColor={{ false: "#27272A", true: "#0A84FF" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.darkBackupPanel}>
          <View style={styles.connectionRow}>
            <Ionicons name="phone-portrait-outline" size={44} color="#5B3FFF" />
            <View style={styles.connectionLine} />
            <Ionicons name={serverIconName(autoSyncRunning, snapshot.meta?.last_autosync_error)} size={18} color="#9CA3AF" />
            <View style={styles.connectionLine} />
            <Ionicons name="server-outline" size={42} color="#7377A0" />
          </View>
          <Text style={styles.connectionText}>
            {settings?.enabled
              ? "UniFi Endpoint and UNAS on the Same Network"
              : "Photo Backup is currently turned off"}
          </Text>

          <View style={styles.darkMediaRow}>
            <MediaSelectCard
              icon="image"
              title="Photo"
              stats={backupStats.photo}
              value={photos}
              onPress={() => updateMediaType("photo", !photos)}
            />
            <MediaSelectCard
              icon="film"
              title="Video"
              stats={backupStats.video}
              value={videos}
              onPress={() => updateMediaType("video", !videos)}
            />
          </View>

          <Text style={styles.darkHelpText}>
            Backs up automatically on the same network as NAS.
            {"\n"}Stay in the app for faster backups.
          </Text>
        </View>

        <Text style={styles.darkSectionTitle}>Destination</Text>

        <TouchableOpacity style={styles.darkDestinationCard} onPress={() => navigation.navigate("BackupDashboard")}>
          <Text style={styles.darkDestinationTitle}>Media</Text>
          <Ionicons name="chevron-forward" size={22} color="#A1A1AA" />
        </TouchableOpacity>

        <Text style={styles.darkDestinationSub}>
          Backed-up items are saved in Media on Personal Drive.
        </Text>

        {files ? (
          <TouchableOpacity style={styles.fileRowDark} onPress={() => updateMediaType("file", false)}>
            <View style={styles.fileRowLeft}>
              <Ionicons name="document-text" size={18} color="#0A84FF" />
              <Text style={styles.fileRowText}>Files</Text>
            </View>
            <Text style={styles.fileRowMeta}>
              {formatCount(backupStats.file.uploadedCount)}/{formatCount(backupStats.file.totalCount)}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.darkStatusCard}>
          <View style={styles.statusLeft}>
            <Ionicons
              name={snapshot.meta?.last_autosync_error ? "alert-circle" : "checkmark-circle"}
              size={22}
              color={snapshot.meta?.last_autosync_error ? "#EF4444" : "#22C55E"}
            />
            <View style={styles.flex}>
              <Text style={styles.darkStatusTitle}>{statusTitle}</Text>
              <Text style={styles.darkStatusSub} numberOfLines={1}>
                {statusDetail}
              </Text>
            </View>
          </View>
        </View>

        {Number(snapshot.meta?.last_autosync_skipped_count || 0) > 0 && (
          <TouchableOpacity style={styles.skippedRow} onPress={showSkippedList}>
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text style={styles.skippedText}>
              {snapshot.meta.last_autosync_skipped_count} ghost files skipped. Tap to view.
            </Text>
          </TouchableOpacity>
        )}

        {scanMessage ? (
          <View style={styles.darkScanMessageBox}>
            <Text style={styles.darkScanMessageText}>{scanMessage}</Text>
          </View>
        ) : null}
      </ScrollView>

    </View>
  );
}

const serverIconName = (running, hasError) => {
  if (hasError) {
    return "cloud-offline-outline";
  }

  return running ? "sync" : "wifi-outline";
};

const MediaSelectCard = ({ icon, title, stats, value, onPress }) => (
  <TouchableOpacity
    style={[styles.darkMediaCard, value && styles.darkMediaCardActive]}
    onPress={onPress}
    activeOpacity={0.86}
  >
    <View style={styles.darkMediaCardTop}>
      <Ionicons name={icon} size={32} color="#5B3FFF" />
      <View style={[styles.darkCheckBox, value && styles.darkCheckBoxActive]}>
        {value ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
      </View>
    </View>
    <Text style={styles.darkMediaTitle}>{title}</Text>
    <Text style={styles.darkMediaCount}>
      {formatCount(stats.uploadedCount)}/{formatCount(stats.totalCount)}
    </Text>
    <Text style={styles.darkMediaBytes}>({bytesToGb(stats.bytes)})</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  darkContainer: {
    flex: 1,
    backgroundColor: "#FBFAFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingTop: 42,
    paddingBottom: 104,
  },
  darkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 34,
  },
  darkHeaderButton: {
    width: 64,
    height: 64,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    alignItems: "center",
    justifyContent: "center",
  },
  darkHeaderTitle: {
    color: "#101445",
    fontSize: 22,
    fontWeight: "900",
  },
  darkToggleCard: {
    minHeight: 56,
    marginHorizontal: 18,
    marginBottom: 26,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  darkToggleTitle: {
    color: "#101445",
    fontSize: 20,
    fontWeight: "500",
  },
  darkBackupPanel: {
    marginHorizontal: 18,
    marginBottom: 34,
    paddingTop: 38,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  connectionLine: {
    width: 84,
    borderTopWidth: 3,
    borderStyle: "dotted",
    borderColor: "#7377A0",
  },
  connectionText: {
    marginTop: 8,
    color: "#7377A0",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  darkMediaRow: {
    marginTop: 30,
    flexDirection: "row",
    gap: 12,
  },
  darkMediaCard: {
    flex: 1,
    minHeight: 178,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ECE9F7",
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  darkMediaCardActive: {
    borderColor: "#5B3FFF",
  },
  darkMediaCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  darkCheckBox: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#F1ECFF",
    alignItems: "center",
    justifyContent: "center",
  },
  darkCheckBoxActive: {
    backgroundColor: "#5B3FFF",
  },
  darkMediaTitle: {
    marginTop: 26,
    color: "#101445",
    fontSize: 21,
    fontWeight: "900",
  },
  darkMediaCount: {
    marginTop: 14,
    color: "#7377A0",
    fontSize: 18,
    fontWeight: "500",
  },
  darkMediaBytes: {
    marginTop: 6,
    color: "#7377A0",
    fontSize: 18,
    fontWeight: "500",
  },
  darkHelpText: {
    marginTop: 28,
    color: "#7377A0",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
  },
  darkSectionTitle: {
    paddingHorizontal: 18,
    color: "#101445",
    fontSize: 18,
    fontWeight: "900",
  },
  darkDestinationCard: {
    minHeight: 56,
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  darkDestinationTitle: {
    color: "#101445",
    fontSize: 20,
    fontWeight: "500",
  },
  darkDestinationSub: {
    marginTop: 14,
    marginHorizontal: 36,
    color: "#7377A0",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  fileRowDark: {
    marginHorizontal: 18,
    marginTop: 18,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fileRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fileRowText: {
    color: "#101445",
    fontSize: 15,
    fontWeight: "800",
  },
  fileRowMeta: {
    color: "#7377A0",
    fontSize: 13,
    fontWeight: "700",
  },
  darkStatusCard: {
    marginHorizontal: 18,
    marginTop: 22,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  darkStatusTitle: {
    color: "#101445",
    fontSize: 12,
    fontWeight: "900",
  },
  darkStatusSub: {
    marginTop: 3,
    color: "#7377A0",
    fontSize: 10,
    fontWeight: "600",
  },
  darkScanMessageBox: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#14532D",
  },
  darkScanMessageText: {
    color: "#DCFCE7",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  headerButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#5B3FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#5B3FFF",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  pageTitle: {
    paddingHorizontal: 20,
    marginBottom: 16,
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },
  introCard: {
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#F7F3FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#4B22F4",
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
  cardTitle: {
    color: "#101828",
    fontSize: 13,
    fontWeight: "900",
  },
  cardSub: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },
  heroCard: {
    marginHorizontal: 18,
    marginBottom: 22,
    minHeight: 136,
    borderRadius: 8,
    backgroundColor: "#FBF9FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  phoneMock: {
    width: 58,
    height: 94,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#111827",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneSpeaker: {
    position: "absolute",
    top: 6,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#111827",
  },
  signalWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dottedLine: {
    width: 42,
    borderTopWidth: 2,
    borderStyle: "dotted",
    borderColor: "#5B3FFF",
  },
  driveMock: {
    width: 78,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  checkBubble: {
    position: "absolute",
    top: -22,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#4B22F4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#EEE8FF",
  },
  sectionTitle: {
    paddingHorizontal: 20,
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  sectionSub: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 14,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },
  mediaCard: {
    marginHorizontal: 18,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0EEF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mediaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mediaIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F4F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTitle: {
    color: "#101828",
    fontSize: 13,
    fontWeight: "900",
  },
  mediaSub: {
    marginTop: 3,
    color: "#5B3FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  statusCard: {
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 22,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#FBF9FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusTitle: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },
  statusSub: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
  },
  autoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EFE8FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  autoBadgeText: {
    color: "#5B3FFF",
    fontSize: 11,
    fontWeight: "900",
  },
  destinationCard: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0EEF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  destinationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerLine: {
    marginTop: 12,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
  },
  scanNowButton: {
    marginHorizontal: 18,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#5B3FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanNowButtonDisabled: {
    opacity: 0.6,
  },
  scanNowButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  spinIcon: {
    animationIterationCount: "infinite",
  },
  scanMessageBox: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  scanMessageText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  skippedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 6,
  },
  skippedText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
