import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

const getMediaChildId = (item) =>
  item?.child_id ??
  item?.childId ??
  item?.child_profile_id ??
  item?.childProfileId ??
  null;

export default function ProfileScreen({ navigation, onOpenMenu }) {
  const {
    profile,
    viewerProfile,
    mediaItems,
    children,
    logout,
    selectedChild,
    selectedChildId,
    isChildAccount,
  } = useProfile();
  const { theme, themeName, themes, changeTheme } = useTheme();
  const scopedMediaItems = mediaItems.filter((item) => {
    if (!isChildAccount || !selectedChildId) {
      return true;
    }

    const itemChildId = getMediaChildId(item);
    return itemChildId !== null && String(itemChildId) === String(selectedChildId);
  });
  const imageCount = scopedMediaItems.filter((item) => item.category === "images").length;
  const videoCount = scopedMediaItems.filter((item) => item.category === "videos").length;
  const activeTheme = themes[themeName] || theme;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AppHeader title="Profile" onOpenMenu={onOpenMenu} />

        {/* PROFILE IMAGE */}
        <View style={styles.profileSection}>
          <View style={styles.imageWrapper}>
            <ThemedAvatar
              uri={viewerProfile.image}
              name={viewerProfile.name}
              style={styles.profileImage}
            />
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </View>

          <Text style={[styles.name, { color: theme.text }]}>{viewerProfile.name}</Text>
          <Text style={[styles.email, { color: theme.subText }]}>
            {viewerProfile.email || "No email available"}
          </Text>

          {/* BUTTONS */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate("EditProfile")}
            >
              <Text style={[styles.editText, { color: theme.buttonText }]}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.shareBtn, { backgroundColor: theme.iconBg }]}>
              <Ionicons name="share-social" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          <StatItem number={String(imageCount)} label="Photos" theme={theme} />
          <StatItem number={String(videoCount)} label="Videos" theme={theme} />
          <StatItem number={String(children?.length ?? 0)} label="Children" theme={theme} />
        </View>

        {/* ACCOUNT */}
        <Section title="Account" theme={theme}>
          <Item icon="person" title="Personal Information" subtitle="Name, email, phone" theme={theme} />
          <Item icon="shield-checkmark" title="Privacy & Security" subtitle="Password, 2FA" theme={theme} />
          <Item
            icon="notifications"
            title="Notifications"
            subtitle="Push, email preferences"
            theme={theme}
            onPress={() => navigation.navigate("Notifications")}
          />
        </Section>

        {/* PREFERENCES */}
        <Section title="Preferences" theme={theme}>
          <Item
            icon="color-palette"
            title="Appearance"
            subtitle={`${activeTheme.name || activeTheme.id} theme`}
            theme={theme}
            onPress={() => navigation.navigate("Appearance")}
          />
          <Item icon="cloud-upload" title="Storage & Backup" subtitle="2.4 GB of 10 GB used" theme={theme} />
          <Item icon="language" title="Language" subtitle="English (US)" theme={theme} />
        </Section>

        {/* SUPPORT */}
        <Section title="Support" theme={theme}>
          <Item icon="help-circle" title="Help Center" theme={theme} />
          <Item icon="document-text" title="Terms & Privacy" theme={theme} />
          <Item icon="information-circle" title="About" subtitle="Version 2.4.1" theme={theme} />
        </Section>

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logout}
          onPress={async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: "AuthProfile" }],
            });
          }}
        >
          <Ionicons name="log-out" size={16} color="red" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
const StatItem = ({ number, label, theme }) => (
  <View style={{ alignItems: "center" }}>
    <Text style={{ color: theme.text, fontWeight: "bold", fontSize: 16 }}>{number}</Text>
    <Text style={{ color: theme.subText, fontSize: 12 }}>{label}</Text>
  </View>
);

const Section = ({ title, children, theme }) => (
  <View style={{ marginTop: 20 }}>
    <Text style={[styles.sectionTitle, { color: theme.subText }]}>{title}</Text>
    <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>
  </View>
);

const Item = ({ icon, title, subtitle, onPress, theme }) => (
  <TouchableOpacity
    style={styles.item}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.78}
  >
    <View style={styles.itemLeft}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <View>
        <Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.itemSub, { color: theme.subText }]}>{subtitle}</Text>}
      </View>
    </View>
    <Ionicons name="chevron-forward" size={16} color={theme.subText} />
  </TouchableOpacity>
);

const ThemeOption = ({ option, active, currentTheme, onPress }) => (
  <TouchableOpacity
    style={[
      styles.themeOption,
      {
        backgroundColor: active ? currentTheme.iconBg : currentTheme.surface,
        borderColor: active ? currentTheme.primary : currentTheme.border,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.78}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={`Use ${option.name || option.id} theme`}
  >
    <View style={styles.themePreview}>
      <View style={[styles.themePreviewBg, { backgroundColor: option.background }]} />
      <View style={[styles.themePreviewCard, { backgroundColor: option.card }]} />
      <View style={[styles.themePreviewAccent, { backgroundColor: option.primary }]} />
    </View>
    <Text style={[styles.themeOptionText, { color: currentTheme.text }]}>
      {option.name || option.id}
    </Text>
    <Ionicons
      name={active ? "checkmark-circle" : "ellipse-outline"}
      size={18}
      color={active ? currentTheme.primary : currentTheme.subText}
    />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },

  profileSection: { alignItems: "center", marginTop: 10 },

  imageWrapper: { position: "relative" },

  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },

  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3B82F6",
    padding: 5,
    borderRadius: 15,
  },

  name: { fontWeight: "bold", marginTop: 10 },

  email: { color: "#777", fontSize: 12 },

  actionRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 10,
  },

  editBtn: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },

  editText: { color: "#fff" },

  shareBtn: {
    backgroundColor: "#E5E7EB",
    padding: 10,
    borderRadius: 8,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },

  sectionTitle: {
    marginLeft: SCREEN_HORIZONTAL_PADDING,
    marginBottom: 5,
    fontWeight: "600",
    color: "#777",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    padding: 10,
  },
  themePicker: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  themeOption: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  themePreview: {
    width: 36,
    height: 28,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  themePreviewBg: {
    ...StyleSheet.absoluteFillObject,
  },
  themePreviewCard: {
    position: "absolute",
    left: 5,
    right: 5,
    bottom: 4,
    height: 12,
    borderRadius: 3,
  },
  themePreviewAccent: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 12,
    height: 5,
    borderRadius: 3,
  },
  themeOptionText: {
    flex: 1,
    fontWeight: "600",
  },

  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    alignItems: "center",
  },

  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  itemTitle: { fontWeight: "500" },

  itemSub: { fontSize: 12, color: "#777" },

  logout: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
    alignItems: "center",
    gap: 5,
    marginBottom: 30,
  },

  logoutText: { color: "red" },
});
