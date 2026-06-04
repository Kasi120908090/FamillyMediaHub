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
import ThemedAvatar from "../../components/common/ThemedAvatar";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../context/ProfileContext";
import { backupAutoSyncService } from "../../services/backupAutoSyncService";
import { backupService } from "../../services/backupService";
import { borderRadius, layout, spacing, typography } from "../../theme/designSystem";
import { moderateScale } from "../../theme/responsive";

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
  const { viewerProfile } = useProfile();
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => (onOpenMenu ? onOpenMenu() : navigation.goBack())}
          >
            <Ionicons name="menu" size={19} color="#5B3FFF" />
          </TouchableOpacity>

          <View style={styles.brand}>
            <View style={styles.logoBox}>
              <Ionicons name="home" size={16} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>Family Media Hub</Text>
            <Ionicons name="add" size={16} color="#5B3FFF" />
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate("Notifications")}>
              <Ionicons name="notifications-outline" size={20} color="#5B3FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
              <ThemedAvatar uri={viewerProfile.image} name={viewerProfile.name} style={styles.avatar} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.pageTitle}>Backup Settings</Text>

        <View style={styles.introCard}>
          <View style={styles.shieldIcon}>
            <Ionicons name="shield" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{settings?.enabled ? "Auto sync enabled" : "Auto sync disabled"}</Text>
            <Text style={styles.cardSub}>
              Storage: {snapshot.storageType} - {snapshot.meta?.last_autosync_scan_count || 0} scanned
            </Text>
          </View>
          <Switch
            value={Boolean(settings?.enabled)}
            onValueChange={toggleAutoSync}
            trackColor={{ false: "#E5E7EB", true: "#5B3FFF" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.phoneMock}>
            <View style={styles.phoneSpeaker} />
            <Ionicons name="image" size={30} color="#5B3FFF" />
          </View>
          <View style={styles.signalWrap}>
            <View style={styles.dottedLine} />
            <Ionicons name="wifi" size={18} color="#5B3FFF" />
            <View style={styles.dottedLine} />
          </View>
          <View style={styles.driveMock}>
            <View style={styles.checkBubble}>
              <Ionicons name={autoSyncRunning ? "sync" : "checkmark"} size={16} color="#FFFFFF" />
            </View>
            <Ionicons name="home-outline" size={16} color="#64748B" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Backup by File Type</Text>
        <Text style={styles.sectionSub}>Toggle on or off to choose what gets backed up automatically.</Text>

        <MediaToggle
          icon="image"
          title="Photos"
          stats={backupStats.photo}
          value={photos}
          onValueChange={(enabled) => updateMediaType("photo", enabled)}
        />
        <MediaToggle
          icon="videocam"
          title="Videos"
          stats={backupStats.video}
          value={videos}
          onValueChange={(enabled) => updateMediaType("video", enabled)}
        />
        <MediaToggle
          icon="document-text"
          title="Files"
          stats={backupStats.file}
          value={files}
          onValueChange={(enabled) => updateMediaType("file", enabled)}
        />

        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <Ionicons
              name={snapshot.meta?.last_autosync_error ? "alert-circle" : "checkmark-circle"}
              size={22}
              color={snapshot.meta?.last_autosync_error ? "#EF4444" : "#22C55E"}
            />
            <View style={styles.flex}>
              <Text style={styles.statusTitle}>{statusTitle}</Text>
              <Text style={styles.statusSub} numberOfLines={1}>
                {statusDetail}
              </Text>
            </View>
          </View>

          <View style={styles.autoBadge}>
            <Ionicons name="sync" size={13} color="#5B3FFF" />
            <Text style={styles.autoBadgeText}>Auto</Text>
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

        <TouchableOpacity
          style={[styles.scanNowButton, isScanning && styles.scanNowButtonDisabled]}
          onPress={scanNow}
          disabled={isScanning || !deviceId}
        >
          <Ionicons name={isScanning ? "sync" : "search"} size={16} color="#FFFFFF" />
          <Text style={styles.scanNowButtonText}>{isScanning ? "Scanning..." : "Scan Now"}</Text>
        </TouchableOpacity>

        {scanMessage ? (
          <View style={styles.scanMessageBox}>
            <Text style={styles.scanMessageText}>{scanMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Destination</Text>

        <TouchableOpacity style={styles.destinationCard} onPress={() => navigation.navigate("BackupDashboard")}>
          <View style={styles.destinationLeft}>
            <View style={styles.mediaIcon}>
              <Ionicons name="folder" size={20} color="#5B3FFF" />
            </View>
            <View>
              <Text style={styles.mediaTitle}>Media</Text>
              <Text style={styles.mediaSub}>
                {deviceId
                  ? `${backupStats.queue.complete} complete, ${backupStats.queue.pending + backupStats.queue.uploading} pending`
                  : "Auto registration pending"}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8A8F9E" />
        </TouchableOpacity>

        <View style={styles.footerLine}>
          <Ionicons name="lock-closed-outline" size={13} color="#6B7280" />
          <Text style={styles.footerText}>All selected items are saved in Media on your LAN backup server.</Text>
        </View>
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

const MediaToggle = ({ icon, title, stats, value, onValueChange }) => (
  <View style={styles.mediaCard}>
    <View style={styles.mediaLeft}>
      <View style={styles.mediaIcon}>
        <Ionicons name={icon} size={20} color="#5B3FFF" />
      </View>
      <View>
        <Text style={styles.mediaTitle}>{title}</Text>
        <Text style={styles.mediaSub}>
          {formatCount(stats.uploadedCount)}/{formatCount(stats.totalCount)} backed up - {bytesToGb(stats.bytes)}
        </Text>
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#E5E7EB", true: "#5B3FFF" }}
      thumbColor="#FFFFFF"
    />
  </View>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  darkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.xxl,
  },
  darkHeaderButton: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: borderRadius.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    alignItems: "center",
    justifyContent: "center",
  },
  darkHeaderTitle: {
    color: "#101445",
    fontSize: typography.heading,
    fontWeight: "900",
  },
  darkToggleCard: {
    minHeight: moderateScale(56),
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  darkToggleTitle: {
    color: "#101445",
    fontSize: typography.title,
    fontWeight: "500",
  },
  darkBackupPanel: {
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(16),
  },
  connectionLine: {
    width: moderateScale(84),
    borderTopWidth: moderateScale(3),
    borderStyle: "dotted",
    borderColor: "#7377A0",
  },
  connectionText: {
    marginTop: spacing.xs,
    color: "#7377A0",
    fontSize: typography.body,
    fontWeight: "500",
    textAlign: "center",
  },
  darkMediaRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
  },
  darkMediaCard: {
    flex: 1,
    minHeight: moderateScale(178),
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: "#ECE9F7",
    padding: spacing.lg,
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
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(4),
    backgroundColor: "#F1ECFF",
    alignItems: "center",
    justifyContent: "center",
  },
  darkCheckBoxActive: {
    backgroundColor: "#5B3FFF",
  },
  darkMediaTitle: {
    marginTop: spacing.xl,
    color: "#101445",
    fontSize: typography.heading,
    fontWeight: "900",
  },
  darkMediaCount: {
    marginTop: spacing.md,
    color: "#7377A0",
    fontSize: typography.body,
    fontWeight: "500",
  },
  darkMediaBytes: {
    marginTop: spacing.sm,
    color: "#7377A0",
    fontSize: typography.body,
    fontWeight: "500",
  },
  darkHelpText: {
    marginTop: spacing.xl,
    color: "#7377A0",
    fontSize: typography.body,
    lineHeight: typography.body * 1.4,
    fontWeight: "500",
  },
  darkSectionTitle: {
    paddingHorizontal: layout.screenPadding,
    color: "#101445",
    fontSize: typography.title,
    fontWeight: "900",
  },
  darkDestinationCard: {
    minHeight: moderateScale(56),
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  darkDestinationTitle: {
    color: "#101445",
    fontSize: typography.title,
    fontWeight: "500",
  },
  darkDestinationSub: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.xl,
    color: "#7377A0",
    fontSize: typography.body,
    lineHeight: typography.body * 1.4,
    fontWeight: "500",
  },
  fileRowDark: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.lg,
    minHeight: moderateScale(52),
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
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
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  darkStatusTitle: {
    color: "#101445",
    fontSize: typography.caption,
    fontWeight: "900",
  },
  darkStatusSub: {
    marginTop: spacing.xs,
    color: "#7377A0",
    fontSize: typography.caption,
    fontWeight: "600",
  },
  darkScanMessageBox: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#14532D",
  },
  darkScanMessageText: {
    color: "#DCFCE7",
    fontSize: typography.caption,
    fontWeight: "600",
    lineHeight: typography.caption * 1.4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
  },
  headerButton: {
    width: moderateScale(28),
    height: moderateScale(28),
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  logoBox: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: borderRadius.sm,
    backgroundColor: "#5B3FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.caption,
    fontWeight: "900",
    color: "#5B3FFF",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
  },
  pageTitle: {
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
    color: "#111827",
    fontSize: typography.heading,
    fontWeight: "900",
  },
  introCard: {
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: "#F7F3FF",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  shieldIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: borderRadius.md,
    backgroundColor: "#4B22F4",
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
  cardTitle: {
    color: "#101828",
    fontSize: typography.label,
    fontWeight: "900",
  },
  cardSub: {
    marginTop: spacing.xs,
    color: "#6B7280",
    fontSize: typography.caption,
    fontWeight: "600",
  },
  heroCard: {
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
    minHeight: moderateScale(136),
    borderRadius: borderRadius.md,
    backgroundColor: "#FBF9FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  phoneMock: {
    width: moderateScale(58),
    height: moderateScale(94),
    borderRadius: moderateScale(7),
    borderWidth: moderateScale(2),
    borderColor: "#111827",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneSpeaker: {
    position: "absolute",
    top: moderateScale(6),
    width: moderateScale(18),
    height: moderateScale(2),
    borderRadius: moderateScale(1),
    backgroundColor: "#111827",
  },
  signalWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dottedLine: {
    width: moderateScale(42),
    borderTopWidth: moderateScale(2),
    borderStyle: "dotted",
    borderColor: "#5B3FFF",
  },
  driveMock: {
    width: moderateScale(78),
    height: moderateScale(48),
    borderRadius: borderRadius.md,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: moderateScale(5) },
    elevation: 3,
  },
  checkBubble: {
    position: "absolute",
    top: -moderateScale(22),
    right: moderateScale(14),
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    backgroundColor: "#4B22F4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: moderateScale(5),
    borderColor: "#EEE8FF",
  },
  sectionTitle: {
    paddingHorizontal: layout.screenPadding,
    color: "#111827",
    fontSize: typography.label,
    fontWeight: "900",
  },
  sectionSub: {
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    color: "#6B7280",
    fontSize: typography.caption,
    fontWeight: "600",
  },
  mediaCard: {
    marginHorizontal: layout.screenPadding,
    padding: spacing.md,
    borderRadius: borderRadius.md,
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
    gap: spacing.md,
  },
  mediaIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: borderRadius.md,
    backgroundColor: "#F4F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTitle: {
    color: "#101828",
    fontSize: typography.label,
    fontWeight: "900",
  },
  mediaSub: {
    marginTop: spacing.xs,
    color: "#5B3FFF",
    fontSize: typography.caption,
    fontWeight: "700",
  },
  statusCard: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: "#FBF9FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  statusLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusTitle: {
    color: "#111827",
    fontSize: typography.caption,
    fontWeight: "900",
  },
  statusSub: {
    marginTop: spacing.xs,
    color: "#6B7280",
    fontSize: typography.caption,
    fontWeight: "600",
  },
  autoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: "#EFE8FF",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  autoBadgeText: {
    color: "#5B3FFF",
    fontSize: typography.caption,
    fontWeight: "900",
  },
  destinationCard: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
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
    gap: spacing.md,
  },
  footerLine: {
    marginTop: spacing.sm,
    marginHorizontal: layout.screenPadding,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  footerText: {
    color: "#6B7280",
    fontSize: typography.caption,
    fontWeight: "600",
  },
  scanNowButton: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: "#5B3FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  scanNowButtonDisabled: {
    opacity: 0.6,
  },
  scanNowButtonText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: "700",
  },
  spinIcon: {
    animationIterationCount: "infinite",
  },
  scanMessageBox: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  scanMessageText: {
    color: "#166534",
    fontSize: typography.caption,
    fontWeight: "500",
    lineHeight: typography.caption * 1.4,
  },
  skippedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  skippedText: {
    color: "#6B7280",
    fontSize: typography.caption,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
