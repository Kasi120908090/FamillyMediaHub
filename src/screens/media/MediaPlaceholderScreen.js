import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import { useProfile } from "../../context/ProfileContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

const screenContent = {
  Videos: {
    icon: "videocam",
    title: "Videos",
    subtitle: "Your family videos will show here.",
  },
  Files: {
    icon: "document",
    title: "Files",
    subtitle: "Shared family files will show here.",
  },
  Upload: {
    icon: "cloud-upload",
    title: "Backup",
    subtitle: "Upload and backup options will show here.",
  },
};

const storageSegments = [
  { label: "Files", value: "1.2 GB", percent: 24, color: "#111827" },
  { label: "Photos", value: "800 MB", percent: 16, color: "#6B7280" },
  { label: "Videos", value: "400 MB", percent: 8, color: "#A3A3A3" },
];

const initialHistory = [
  {
    id: "1",
    title: "Today, 2:30 PM",
    subtitle: "Complete - 2.4 GB",
    status: "completed",
  },
  {
    id: "2",
    title: "Yesterday, 2:30 PM",
    subtitle: "Complete - 2.3 GB",
    status: "completed",
  },
  {
    id: "3",
    title: "Jan 15, 2:30 PM",
    subtitle: "Failed - Network error",
    status: "failed",
  },
];

export default function MediaPlaceholderScreen({ navigation, route, onOpenMenu }) {
  const content = screenContent[route.name] || screenContent.Upload;
  const { profile } = useProfile();
  const [automaticBackup, setAutomaticBackup] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [backupProgress, setBackupProgress] = useState(75);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupHistory, setBackupHistory] = useState(initialHistory);

  useEffect(() => {
    if (!isBackingUp) {
      return undefined;
    }

    const timer = setInterval(() => {
      setBackupProgress((current) => {
        if (current >= 100) {
          clearInterval(timer);
          setIsBackingUp(false);
          setBackupHistory((history) => [
            {
              id: String(Date.now()),
              title: "Just now",
              subtitle: "Complete - 2.4 GB",
              status: "completed",
            },
            ...history,
          ]);
          return 100;
        }

        return Math.min(current + 5, 100);
      });
    }, 220);

    return () => clearInterval(timer);
  }, [isBackingUp]);

  const backupStatus = useMemo(
    () => `${Math.round(backupProgress)}% complete`,
    [backupProgress]
  );

  const handleBackupNow = () => {
    if (isBackingUp) {
      return;
    }

    setBackupProgress(0);
    setIsBackingUp(true);
  };

  if (route.name !== "Upload") {
    return (
      <View style={styles.container}>
        <AppHeader
          title="Family Media Hub"
          onOpenMenu={onOpenMenu}
          rightContent={
            <View style={styles.headerRight}>
              <Ionicons name="search" size={20} />
              <TouchableOpacity
                onPress={() => navigation.navigate("Profile")}
                activeOpacity={0.85}
              >
                <ThemedAvatar uri={profile.image} name={profile.name} style={styles.avatar} />
              </TouchableOpacity>
            </View>
          }
        />

        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Ionicons name={content.icon} size={32} color="#3B82F6" />
          </View>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Backup & Restore"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.85}
          >
            <ThemedAvatar uri={profile.image} name={profile.name} style={styles.avatar} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Backup Status</Text>
            <Ionicons name="ellipsis-horizontal" size={18} color="#6B7280" />
          </View>
          <Text style={styles.statusLine}>Last backup: Today, 2:30 PM</Text>
          <Text style={styles.statusLine}>Next backup: Tomorrow, 2:30 PM</Text>
          <ProgressBar progress={backupProgress} color="#3B82F6" />
          <Text style={styles.progressText}>{backupStatus}</Text>
        </View>

        <Text style={styles.groupTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={[styles.backupButton, isBackingUp && styles.backupButtonActive]}
          onPress={handleBackupNow}
          activeOpacity={0.82}
        >
          <Ionicons
            name={isBackingUp ? "sync" : "cloud-upload"}
            size={18}
            color="#111827"
          />
          <Text style={styles.backupButtonText}>
            {isBackingUp ? "Backing Up..." : "Backup Now"}
          </Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backup Settings</Text>
          <SettingRow
            title="Automatic Backup"
            subtitle="Daily at 2:30 PM"
            value={automaticBackup}
            onValueChange={setAutomaticBackup}
          />
          <SettingRow
            title="WiFi Only"
            subtitle="Use only WiFi for backup"
            value={wifiOnly}
            onValueChange={setWifiOnly}
          />
          <SettingRow
            title="Include Photos"
            subtitle="Backup photos and videos"
            value={includePhotos}
            onValueChange={setIncludePhotos}
            isLast
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Storage Usage</Text>
            <Ionicons name="open-outline" size={16} color="#6B7280" />
          </View>
          <View style={styles.storageHeader}>
            <Text style={styles.statusLine}>Used</Text>
            <Text style={styles.statusLine}>2.4 GB of 5 GB</Text>
          </View>
          <View style={styles.segmentTrack}>
            {storageSegments.map((segment) => (
              <View
                key={segment.label}
                style={[
                  styles.segment,
                  {
                    flex: segment.percent,
                    backgroundColor: segment.color,
                  },
                ]}
              />
            ))}
            <View style={styles.segmentRest} />
          </View>
          <View style={styles.storageLegend}>
            {storageSegments.map((segment) => (
              <View key={segment.label} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: segment.color }]}
                />
                <Text style={styles.legendLabel}>{segment.label}</Text>
                <Text style={styles.legendValue}>{segment.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backup History</Text>
          {backupHistory.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.historyRow,
                index === backupHistory.length - 1 && styles.lastRow,
              ]}
            >
              <View style={styles.historyLeft}>
                <View style={styles.historyDot} />
                <View>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historySubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons
                name={
                  item.status === "completed"
                    ? "checkmark"
                    : "warning"
                }
                size={16}
                color={item.status === "completed" ? "#6B7280" : "#6B7280"}
              />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Advanced</Text>
          <AdvancedRow title="Export Backup" subtitle="Download backup file" />
          <AdvancedRow title="Import Backup" subtitle="Restore from file" />
          <AdvancedRow
            title="Delete All Backups"
            subtitle="Permanently remove all backups"
            isLast
          />
        </View>
      </ScrollView>
    </View>
  );
}

const ProgressBar = ({ progress, color }) => (
  <View style={styles.progressTrack}>
    <View
      style={[
        styles.progressFill,
        {
          width: `${Math.min(Math.max(progress, 0), 100)}%`,
          backgroundColor: color,
        },
      ]}
    />
  </View>
);

const SettingRow = ({ title, subtitle, value, onValueChange, isLast }) => (
  <View style={[styles.settingRow, isLast && styles.lastRow]}>
    <View>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#E5E5E5", true: "#60A5FA" }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#E5E5E5"
    />
  </View>
);

const AdvancedRow = ({ title, subtitle, isLast }) => (
  <TouchableOpacity
    style={[styles.advancedRow, isLast && styles.lastRow]}
    activeOpacity={0.78}
    onPress={() => console.log(title)}
  >
    <View>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  iconBox: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: "#EAF1FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },

  subtitle: {
    color: "#777",
    textAlign: "center",
  },

  scrollContent: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 18,
    gap: 12,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 14,
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },

  statusLine: {
    fontSize: 11,
    color: "#111827",
    marginBottom: 5,
  },

  progressTrack: {
    height: 7,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginTop: 4,
  },

  progressFill: {
    height: "100%",
    borderRadius: 8,
  },

  progressText: {
    fontSize: 10,
    color: "#4B5563",
    marginTop: 8,
  },

  groupTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111827",
  },

  backupButton: {
    height: 74,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  backupButtonActive: {
    backgroundColor: "#F8FAFC",
  },

  backupButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#111827",
  },

  settingRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  settingTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#111827",
  },

  settingSubtitle: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 3,
  },

  storageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  segmentTrack: {
    height: 7,
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginVertical: 13,
  },

  segment: {
    height: "100%",
  },

  segmentRest: {
    flex: 52,
    backgroundColor: "#E5E7EB",
  },

  storageLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
  },

  legendItem: {
    alignItems: "center",
    minWidth: 64,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },

  legendLabel: {
    fontSize: 10,
    color: "#111827",
  },

  legendValue: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 2,
  },

  historyRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  historyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#9CA3AF",
  },

  historyTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#111827",
  },

  historySubtitle: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 3,
  },

  advancedRow: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  lastRow: {
    borderBottomWidth: 0,
  },
});
