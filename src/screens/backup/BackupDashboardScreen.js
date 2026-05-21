import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../hooks/useAuth";
import { backupService } from "../../services/backupService";
import { BACKUP_QUEUE_STATUS, backupQueueStore } from "../../services/backupQueueStore";
import { userService } from "../../services/userService";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

const formatPercent = (value) => `${Math.round(Math.max(0, Math.min(1, value || 0)) * 100)}%`;

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (!value) {
    return "0 KB";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(value > 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export default function BackupDashboardScreen({ navigation }) {
  const { authToken, currentUser, parentDevices, refreshDevices } = useAuth();
  const [queueItems, setQueueItems] = useState([]);
  const [backupItems, setBackupItems] = useState([]);
  const [storageType, setStorageType] = useState("pending");
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isRegisteringDevice, setIsRegisteringDevice] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [serverOnline, setServerOnline] = useState(null);
  const [activeProgress, setActiveProgress] = useState(null);
  const abortControllerRef = useRef(null);
  const loggedInChildId =
    currentUser?.child_id ||
    currentUser?.childId ||
    currentUser?.child_profile_id ||
    currentUser?.childProfileId ||
    currentUser?.child?.id ||
    currentUser?.child_profile?.id ||
    currentUser?.childProfile?.id ||
    currentUser?.profile?.id ||
    null;
  const fallbackDeviceId =
    selectedDeviceId ||
    currentUser?.device_id ||
    currentUser?.deviceId ||
    currentUser?.device?.id ||
    parentDevices?.[0]?.id ||
    null;

  const refreshBackupState = useCallback(async () => {
    const snapshot = await backupService.getQueueSnapshot();
    setQueueItems(snapshot.items);
    setStorageType(snapshot.storageType);

    if (!authToken) {
      setServerOnline(null);
      return;
    }

    try {
      await backupService.checkHealth(authToken);
      setServerOnline(true);
      setBackupItems(await backupService.listBackups(authToken));
    } catch (error) {
      setServerOnline(false);
    }
  }, [authToken]);

  useEffect(() => {
    refreshBackupState().catch(() => {});
  }, [refreshBackupState]);

  useEffect(() => {
    refreshDevices?.().catch(() => {});
  }, [refreshDevices]);

  useEffect(() => {
    if (!selectedDeviceId && parentDevices?.length) {
      setSelectedDeviceId(parentDevices[0].id);
    }
  }, [parentDevices, selectedDeviceId]);

  const queueSummary = useMemo(() => {
    const complete = queueItems.filter((item) => item.status === BACKUP_QUEUE_STATUS.COMPLETE).length;
    const failed = queueItems.filter((item) => item.status === BACKUP_QUEUE_STATUS.FAILED).length;
    const pending = queueItems.filter((item) =>
      [BACKUP_QUEUE_STATUS.PENDING, BACKUP_QUEUE_STATUS.UPLOADING].includes(item.status)
    ).length;
    const totalBytes = queueItems.reduce((sum, item) => sum + Number(item.file_size || 0), 0);
    const receivedBytes = queueItems.reduce(
      (sum, item) => sum + Math.min(Number(item.bytes_received || 0), Number(item.file_size || 0)),
      0
    );

    return {
      complete,
      failed,
      pending,
      total: queueItems.length,
      progress: totalBytes ? receivedBytes / totalBytes : 0,
      receivedBytes,
      totalBytes,
    };
  }, [queueItems]);

  const runBackup = useCallback(
    async (itemsToRun) => {
      if (!authToken) {
        Alert.alert("Sign in required", "Please sign in before starting a backup.");
        return;
      }

      if (!itemsToRun.length || isBackingUp) {
        return;
      }

      setIsBackingUp(true);
      abortControllerRef.current =
        typeof AbortController !== "undefined" ? new AbortController() : null;

      try {
        const itemsWithDevice = [];

        for (const item of itemsToRun) {
          if (item.device_id || fallbackDeviceId) {
            const nextItem = item.device_id
              ? item
              : await backupQueueStore.update(item.id, { device_id: fallbackDeviceId });
            if (nextItem) {
              itemsWithDevice.push(nextItem);
            }
          }
        }

        if (!itemsWithDevice.length) {
          Alert.alert(
            "Device required",
            "Backup requires a linked device. Link or select a device before starting backup."
          );
          return;
        }

        await backupService.resumeQueue(authToken, {
          items: itemsWithDevice,
          signal: abortControllerRef.current?.signal,
          onProgress: ({ item, phase, progress, bytesReceived, totalBytes }) => {
            setActiveProgress({
              fileName: item?.file_name || "Backup file",
              phase,
              progress: Number(progress || 0),
              bytesReceived,
              totalBytes,
            });
            refreshBackupState().catch(() => {});
          },
        });
        await refreshBackupState();
      } catch (error) {
        if (error?.name !== "AbortError") {
          Alert.alert("Backup paused", error.message);
        }
        await refreshBackupState();
      } finally {
        setIsBackingUp(false);
        setActiveProgress(null);
        abortControllerRef.current = null;
      }
    },
    [authToken, fallbackDeviceId, isBackingUp, refreshBackupState]
  );

  const handleChooseBackupFiles = async () => {
    if (isPicking || isBackingUp) {
      return;
    }

    setIsPicking(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: "*/*",
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      if (!fallbackDeviceId) {
        Alert.alert(
          "Device required",
          "Backup requires a linked device. Link or select a device before starting backup."
        );
        return;
      }

      const queued = await backupService.enqueueAssets(result.assets, {
        device_id: fallbackDeviceId,
        child_id: loggedInChildId,
      });
      await refreshBackupState();
      await runBackup(queued);
    } finally {
      setIsPicking(false);
    }
  };

  const handleResumeBackup = async () => {
    await runBackup(await backupQueueStore.getActive());
  };

  const handleRegisterDevice = async () => {
    if (!authToken || isRegisteringDevice) {
      return;
    }

    setIsRegisteringDevice(true);

    try {
      const deviceName =
        Platform.OS === "android"
          ? "Android phone"
          : Platform.OS === "ios"
          ? "iPhone"
          : "Current device";
      const devicePayload = {
        device_name: deviceName,
        name: deviceName,
        device_type:
          Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : "web",
        platform: Platform.OS || "mobile",
        serial_number: `family-hub-${currentUser?.id || currentUser?.username || "user"}-${Platform.OS}`,
        mac_address: `family-hub-${currentUser?.id || currentUser?.username || "user"}-${Platform.OS}`,
      };
      const createdDevice = await userService.createDevice(devicePayload, authToken);
      const nextDeviceId = createdDevice?.id;

      const devices = await userService.getMyDevices(authToken);
      const selectedId = nextDeviceId || devices?.[0]?.id || fallbackDeviceId;

      if (selectedId) {
        setSelectedDeviceId(selectedId);
      }

      await refreshDevices?.();
      await refreshBackupState();

      if (nextDeviceId || devices?.length > 0) {
        Alert.alert("Device linked", "Your backup device was registered successfully.");
      }
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      const isDuplicateDevice =
        message.includes("mac address") ||
        message.includes("already exists") ||
        message.includes("duplicate") ||
        error?.status === 409;

      if (isDuplicateDevice) {
        const devices = await refreshDevices?.();
        const existingDevice = devices?.[0];

        if (existingDevice?.id) {
          setSelectedDeviceId(existingDevice.id);
          await refreshBackupState();
          return;
        }
      }

      Alert.alert(
        "Device registration failed",
        error?.message || "Unable to register the backup device. Please try again."
      );
    } finally {
      setIsRegisteringDevice(false);
    }
  };

  const handleStopBackup = () => {
    abortControllerRef.current?.abort();
    setIsBackingUp(false);
  };

  const recentQueueItems = queueItems.slice(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#5B3FFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Back up</Text>
            <Text style={styles.subtitle}>LAN resumable backup for photos, videos, and files</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={refreshBackupState}>
            <Ionicons name="refresh" size={20} color="#5B3FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.backupCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>LAN Backup Queue</Text>
              <Text style={styles.cardSub}>
                {serverOnline === false
                  ? "Backend offline. Saved queue can resume later."
                  : `Storage: ${storageType === "sqlite" ? "SQLite primary" : "AsyncStorage fallback"}`}
              </Text>
            </View>
            <View style={[styles.healthPill, serverOnline === false && styles.healthPillOffline]}>
              <Ionicons
                name={serverOnline === false ? "cloud-offline" : "cloud-done"}
                size={14}
                color={serverOnline === false ? "#DC2626" : "#16A34A"}
              />
              <Text style={[styles.healthText, serverOnline === false && styles.healthTextOffline]}>
                {serverOnline === false ? "Offline" : "Ready"}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <QueueStat label="Queued" value={queueSummary.total} />
            <QueueStat label="Done" value={queueSummary.complete} />
            <QueueStat label="Pending" value={queueSummary.pending} />
            <QueueStat label="Failed" value={queueSummary.failed} />
          </View>

          {parentDevices?.length ? (
            <View style={styles.deviceSelector}>
              <Text style={styles.deviceLabel}>Backup device</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {parentDevices.map((device) => {
                  const active = String(selectedDeviceId) === String(device.id);
                  const label =
                    device.device_name || device.name || device.model || `Device ${device.id}`;

                  return (
                    <TouchableOpacity
                      key={String(device.id)}
                      style={[styles.deviceChip, active && styles.deviceChipActive]}
                      onPress={() => setSelectedDeviceId(device.id)}
                    >
                      <Ionicons
                        name="phone-portrait-outline"
                        size={14}
                        color={active ? "#FFFFFF" : "#5B3FFF"}
                      />
                      <Text style={[styles.deviceChipText, active && styles.deviceChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.noDeviceCard}>
              <View style={styles.noDeviceTextWrap}>
                <Text style={styles.noDeviceTitle}>No linked backup device</Text>
                <Text style={styles.noDeviceText}>
                  Register this phone once so the backend can attach backups to a device.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.registerDeviceButton, isRegisteringDevice && styles.disabledButton]}
                onPress={handleRegisterDevice}
                disabled={isRegisteringDevice}
              >
                {isRegisteringDevice ? (
                  <ActivityIndicator color="#5B3FFF" />
                ) : (
                  <>
                    <Ionicons name="phone-portrait-outline" size={16} color="#5B3FFF" />
                    <Text style={styles.registerDeviceText}>Register</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {formatBytes(queueSummary.receivedBytes)} of {formatBytes(queueSummary.totalBytes)}
            </Text>
            <Text style={styles.progressPercent}>{formatPercent(queueSummary.progress)}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: formatPercent(queueSummary.progress) }]} />
          </View>

          <Text style={styles.progressHint} numberOfLines={2}>
            {activeProgress
              ? `${activeProgress.phase === "hashing" ? "Preparing" : "Uploading"} ${activeProgress.fileName}`
              : backupItems.length
              ? `${backupItems.length} files are visible on the backend.`
              : "Choose files to create a resumable backup queue."}
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButton, (isPicking || isBackingUp) && styles.disabledButton]}
              onPress={handleChooseBackupFiles}
              disabled={isPicking || isBackingUp}
            >
              {isPicking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="folder-open" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Choose & Backup</Text>
                </>
              )}
            </TouchableOpacity>

            {isBackingUp ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleStopBackup}>
                <Ionicons name="pause-circle-outline" size={18} color="#5B3FFF" />
                <Text style={styles.secondaryButtonText}>Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleResumeBackup}>
                <Ionicons name="refresh" size={18} color="#5B3FFF" />
                <Text style={styles.secondaryButtonText}>Resume</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.queueListHeader}>
          <Text style={styles.sectionTitle}>Recent Queue</Text>
          <Text style={styles.sectionMeta}>{recentQueueItems.length} shown</Text>
        </View>

        {recentQueueItems.length ? (
          <View style={styles.queueList}>
            {recentQueueItems.map((item) => (
              <View key={item.id} style={styles.queueRow}>
                <View style={styles.fileIcon}>
                  <Ionicons name="document-text-outline" size={18} color="#5B3FFF" />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {item.file_name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {item.status} · {formatBytes(item.bytes_received)} / {formatBytes(item.file_size)}
                  </Text>
                </View>
                <Text style={styles.filePercent}>
                  {formatPercent(Number(item.file_size) ? Number(item.bytes_received || 0) / Number(item.file_size) : 0)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-upload-outline" size={28} color="#5B3FFF" />
            <Text style={styles.emptyTitle}>No backup jobs yet</Text>
            <Text style={styles.emptyText}>Pick files to start. Paused or interrupted uploads will stay here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const QueueStat = ({ label, value }) => (
  <View style={styles.queueStat}>
    <Text style={styles.queueStatValue}>{value}</Text>
    <Text style={styles.queueStatLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 44,
    paddingBottom: 150,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
  backupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  cardSub: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  healthPill: {
    minHeight: 28,
    borderRadius: 8,
    paddingHorizontal: 9,
    backgroundColor: "#ECFDF5",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  healthPillOffline: {
    backgroundColor: "#FEF2F2",
  },
  healthText: {
    color: "#16A34A",
    fontSize: 11,
    fontWeight: "900",
  },
  healthTextOffline: {
    color: "#DC2626",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  queueStat: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#F8F7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  queueStatValue: {
    color: "#5B3FFF",
    fontWeight: "900",
    fontSize: 15,
  },
  queueStatLabel: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
  },
  deviceSelector: {
    marginTop: 14,
  },
  deviceLabel: {
    marginBottom: 8,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  deviceChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C4B5FD",
    paddingHorizontal: 10,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deviceChipActive: {
    backgroundColor: "#5B3FFF",
    borderColor: "#5B3FFF",
  },
  deviceChipText: {
    color: "#5B3FFF",
    fontSize: 11,
    fontWeight: "800",
  },
  deviceChipTextActive: {
    color: "#FFFFFF",
  },
  noDeviceCard: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noDeviceTextWrap: {
    flex: 1,
  },
  noDeviceTitle: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "900",
  },
  noDeviceText: {
    marginTop: 3,
    color: "#A16207",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
  registerDeviceButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C4B5FD",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  registerDeviceText: {
    color: "#5B3FFF",
    fontSize: 11,
    fontWeight: "900",
  },
  progressHeader: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
  },
  progressPercent: {
    color: "#5B3FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  progressTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    minWidth: 4,
    borderRadius: 8,
    backgroundColor: "#5B3FFF",
  },
  progressHint: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  actionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#5B3FFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  secondaryButton: {
    minWidth: 104,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryButtonText: {
    color: "#5B3FFF",
    fontWeight: "900",
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.65,
  },
  queueListHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  sectionMeta: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
  },
  queueList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    overflow: "hidden",
  },
  queueRow: {
    minHeight: 64,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F0FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },
  fileMeta: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
  },
  filePercent: {
    color: "#5B3FFF",
    fontSize: 11,
    fontWeight: "900",
  },
  emptyCard: {
    minHeight: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  emptyTitle: {
    marginTop: 10,
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "700",
  },
});
