import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import { getMediaUri } from "../../utils/media";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../context/ProfileContext";
import { backupService } from "../../services/backupService";

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (!value) {
    return "0 KB";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(value > 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDateTime = (value) => {
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

const fileIcon = {
  photo: "image-outline",
  video: "videocam-outline",
  file: "document-text-outline",
};

export default function BackupDashboardScreen({ navigation, onOpenMenu }) {
  const { authToken } = useAuth();
  const { viewerProfile } = useProfile();
  const [snapshot, setSnapshot] = useState({ items: [], meta: {}, storageType: "pending" });
  const [backupItems, setBackupItems] = useState([]);
  const [serverOnline, setServerOnline] = useState(null);

  const refreshBackupState = useCallback(async () => {
    const nextSnapshot = await backupService.getQueueSnapshot();
    setSnapshot(nextSnapshot);

    if (!authToken) {
      setServerOnline(null);
      setBackupItems([]);
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
    let isCancelled = false;
    let intervalId;

    const task = InteractionManager.runAfterInteractions(() => {
      if (isCancelled) {
        return;
      }

      refreshBackupState().catch(() => {});
      intervalId = setInterval(() => {
        refreshBackupState().catch(() => {});
      }, 5000);
    });

    return () => {
      isCancelled = true;
      task.cancel();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refreshBackupState]);

  const unifiedItems = useMemo(() => {
    const all = [...(snapshot.items || []), ...backupItems];
    return Array.from(new Map(all.map(item => [item.id || item.file_name, item])).values());
  }, [backupItems, snapshot.items]);

  const stats = useMemo(() => {
    const totals = {
      photo: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      file: { count: 0, bytes: 0 },
    };

    // Calculate totals using a combination of server items and local items
    const uniqueItems = unifiedItems;

    for (const item of uniqueItems) {
      const kind = getFileKind(item);
      totals[kind].count += 1;
      totals[kind].bytes += Number(item.file_size || 0);
    }

    const totalBytes = totals.photo.bytes + totals.video.bytes + totals.file.bytes;
    const queuedBytes = (snapshot.items || []).reduce(
      (sum, item) => sum + Number(item.file_size || 0),
      0
    );
    const uploadedBytes = (snapshot.items || []).reduce(
      (sum, item) => sum + Math.min(Number(item.bytes_received || 0), Number(item.file_size || 0)),
      0
    );
    const queue = {
      pending: 0,
      uploading: 0,
      complete: 0,
      failed: 0,
    };

    for (const item of snapshot.items || []) {
      const status = String(item.status || "").toUpperCase();

      if (status === "COMPLETE") {
        queue.complete += 1;
      } else if (status === "FAILED") {
        queue.failed += 1;
      } else if (status === "UPLOADING") {
        queue.uploading += 1;
      } else {
        queue.pending += 1;
      }
    }

    return {
      ...totals,
      queue,
      totalBytes,
      uploadedBytes,
      uploadPercent: queuedBytes ? Math.min(100, Math.round((uploadedBytes / queuedBytes) * 100)) : 0,
      totalCount: uniqueItems.length,
    };
  }, [backupItems, snapshot.items]);

  const recentItems = useMemo(() => unifiedItems.slice(0, 6), [unifiedItems]);

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
              <Ionicons
                name={serverOnline === false ? "cloud-offline-outline" : "notifications-outline"}
                size={20}
                color={serverOnline === false ? "#EF4444" : "#5B3FFF"}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
              <ThemedAvatar uri={viewerProfile.image} name={viewerProfile.name} style={styles.avatar} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.storageCard}>
          <View style={styles.mediaFolderIcon}>
            <Ionicons name="folder-outline" size={28} color="#5B3FFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Media</Text>
            <Text style={styles.cardSub}>All your backed up photos, videos and files in one place.</Text>
            <View style={styles.usageRow}>
              <Ionicons name="server-outline" size={13} color="#5B3FFF" />
              <Text style={styles.usageText}>
                {formatBytes(stats.totalBytes)} backed up across {stats.totalCount.toLocaleString()} files
              </Text>
              <Text style={styles.usagePercent}>{stats.uploadPercent}% synced</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${stats.uploadPercent}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.tileRow}>
          <CategoryTile
            icon="image-outline"
            title="Photos"
            count={stats.photo.count}
            bytes={stats.photo.bytes}
            onPress={() => navigation.jumpTo("Gallery", { mediaTab: "Images" })}
          />
          <CategoryTile
            icon="videocam-outline"
            title="Videos"
            count={stats.video.count}
            bytes={stats.video.bytes}
            onPress={() => navigation.jumpTo("Gallery", { mediaTab: "Videos" })}
          />
          <CategoryTile
            icon="document-text-outline"
            title="Files"
            count={stats.file.count}
            bytes={stats.file.bytes}
            onPress={() => navigation.jumpTo("Gallery", { mediaTab: "Files" })}
          />
        </View>

        <SectionHeader
          title="Recent Items"
          action="View All"
          onActionPress={() => navigation.jumpTo("Gallery", { mediaTab: "Gallery" })}
        />
        {recentItems.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentList}>
            {recentItems.map((item, index) => {
              const kind = getFileKind(item);
              const status = String(item.status || "").toUpperCase();
              const isProcessing = status === "UPLOADING" || status === "PENDING" || item.is_processing;

              return (
                <View key={item.id || item.file_name || index} style={styles.recentCard}>
                  <View style={styles.previewBox}>
                    {kind === "photo" || kind === "video" ? (
                      <>
                        <Image
                          source={{ uri: getMediaUri(item) }}
                          style={[styles.previewImage, isProcessing && { opacity: 0.6 }]}
                          resizeMode="cover"
                        />
                        {isProcessing && (
                          <View style={styles.processingBadge}>
                            <Text style={styles.processingText}>Processing</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Ionicons name={fileIcon[kind]} size={24} color="#5B3FFF" />
                    )}
                  </View>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {item.file_name || "Backup file"}
                  </Text>
                  <Text style={styles.recentMeta} numberOfLines={1}>
                    {formatBytes(item.file_size)} - {item.status || "COMPLETE"}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-upload-outline" size={26} color="#5B3FFF" />
            <Text style={styles.emptyTitle}>No backups yet</Text>
            <Text style={styles.emptyText}>Auto sync will add media here after the next LAN backup.</Text>
          </View>
        )}

        <SectionHeader title="Auto Sync Status" action={serverOnline === false ? "Offline" : "Live"} />
        <View style={styles.folderList}>
          <StatusRow icon="sync" title="Current phase" value={String(snapshot.meta?.last_autosync_phase || "idle").replace(/_/g, " ")} />
          <StatusRow icon="scan-outline" title="Last scan" value={`${snapshot.meta?.last_autosync_scan_count || 0} files`} />
          <StatusRow icon="cloud-upload-outline" title="Queue" value={`${stats.queue.uploading} uploading, ${stats.queue.pending} pending`} />
          <StatusRow icon="checkmark-circle-outline" title="Complete" value={`${stats.queue.complete} files`} />
          <StatusRow icon="alert-circle-outline" title="Failed" value={`${stats.queue.failed} files`} danger={stats.queue.failed > 0} />
        </View>

        <Text style={[styles.sectionTitle, styles.breakdownTitle]}>Storage Breakdown</Text>
        <View style={styles.breakdownTrack}>
          <View style={[styles.breakdownSegment, styles.photosSegment, { flex: Math.max(1, stats.photo.bytes) }]} />
          <View style={[styles.breakdownSegment, styles.videosSegment, { flex: Math.max(1, stats.video.bytes) }]} />
          <View style={[styles.breakdownSegment, styles.filesSegment, { flex: Math.max(1, stats.file.bytes) }]} />
        </View>
        <View style={styles.legendRow}>
          <LegendDot color="#5B3FFF" label="Photos" value={formatBytes(stats.photo.bytes)} />
          <LegendDot color="#0EA5E9" label="Videos" value={formatBytes(stats.video.bytes)} />
          <LegendDot color="#22C55E" label="Files" value={formatBytes(stats.file.bytes)} />
        </View>

        <View style={styles.safeCard}>
          <View style={styles.safeIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#5B3FFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.safeTitle}>Your memories are safe</Text>
            <Text style={styles.safeText} numberOfLines={1}>
              {snapshot.meta?.last_autosync_error ||
                (snapshot.meta?.last_autosync_at
                  ? `Last sync: ${formatDateTime(snapshot.meta.last_autosync_at)}`
                  : "Auto sync starts when this phone is on the configured LAN.")}
            </Text>
          </View>
          <Ionicons name="sync" size={20} color="#5B3FFF" />
        </View>
      </ScrollView>
    </View>
  );
}

const SectionHeader = ({ title, action, onActionPress }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onActionPress ? (
      <TouchableOpacity onPress={onActionPress}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    ) : (
      <Text style={styles.sectionAction}>{action}</Text>
    )}
  </View>
);

const CategoryTile = ({ icon, title, count, bytes, onPress }) => (
  <TouchableOpacity style={styles.categoryTile} onPress={onPress}>
    <View style={styles.categoryIcon}>
      <Ionicons name={icon} size={17} color="#5B3FFF" />
    </View>
    <Text style={styles.categoryTitle}>{title}</Text>
    <Text style={styles.categoryCount}>{count.toLocaleString()}</Text>
    <Text style={styles.categoryMeta}>{formatBytes(bytes)}</Text>
  </TouchableOpacity>
);

const StatusRow = ({ icon, title, value, danger }) => (
  <View style={styles.folderRow}>
    <View style={styles.folderLeft}>
      <Ionicons name={icon} size={18} color={danger ? "#EF4444" : "#5B3FFF"} />
      <Text style={styles.folderTitle}>{title}</Text>
    </View>
    <View style={styles.folderRight}>
      <Text style={[styles.folderCount, danger && styles.folderCountDanger]}>{value}</Text>
    </View>
  </View>
);

const LegendDot = ({ color, label, value }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendLabel}>{label}</Text>
    <Text style={styles.legendValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingTop: 42,
    paddingBottom: 164,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 18,
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
    color: "#5B3FFF",
    fontSize: 13,
    fontWeight: "900",
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
  storageCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0EEF8",
    flexDirection: "row",
    gap: 12,
  },
  mediaFolderIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#F4F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  cardSub: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
  },
  usageRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  usageText: {
    flex: 1,
    color: "#5B3FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  usagePercent: {
    color: "#5B3FFF",
    fontSize: 10,
    fontWeight: "900",
  },
  progressTrack: {
    marginTop: 6,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#5B3FFF",
  },
  tileRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  categoryTile: {
    flex: 1,
    minHeight: 98,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0EEF8",
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F4F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTitle: {
    marginTop: 8,
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
  },
  categoryCount: {
    marginTop: 6,
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  categoryMeta: {
    marginTop: 3,
    color: "#5B3FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
  },
  breakdownTitle: {
    paddingHorizontal: 18,
  },
  sectionAction: {
    color: "#5B3FFF",
    fontSize: 10,
    fontWeight: "900",
  },
  recentList: {
    paddingHorizontal: 18,
    gap: 10,
    paddingBottom: 16,
  },
  recentCard: {
    width: 86,
  },
  previewBox: {
    height: 72,
    borderRadius: 8,
    backgroundColor: "#F4F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  processingBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingVertical: 2,
  },
  processingText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  recentName: {
    marginTop: 7,
    color: "#111827",
    fontSize: 10,
    fontWeight: "900",
  },
  recentMeta: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 9,
    fontWeight: "600",
  },
  emptyCard: {
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 18,
    borderRadius: 8,
    backgroundColor: "#FBF9FF",
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 8,
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  folderList: {
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F0EEF8",
    overflow: "hidden",
  },
  folderRow: {
    minHeight: 45,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#F3F1FA",
  },
  folderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  folderTitle: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
  },
  folderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  folderCount: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
  },
  folderCountDanger: {
    color: "#EF4444",
  },
  breakdownTrack: {
    marginTop: 12,
    marginHorizontal: 18,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    flexDirection: "row",
    overflow: "hidden",
  },
  breakdownSegment: {
    height: "100%",
  },
  photosSegment: {
    backgroundColor: "#5B3FFF",
  },
  videosSegment: {
    backgroundColor: "#0EA5E9",
  },
  filesSegment: {
    backgroundColor: "#22C55E",
  },
  freeSegment: {
    backgroundColor: "#D1D5DB",
  },
  legendRow: {
    paddingHorizontal: 18,
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    minWidth: 70,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: 4,
  },
  legendLabel: {
    color: "#111827",
    fontSize: 9,
    fontWeight: "900",
  },
  legendValue: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 9,
    fontWeight: "600",
  },
  safeCard: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#F7F3FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  safeIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#EFE8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  safeTitle: {
    color: "#5B3FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  safeText: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
  },
});
