import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import ThemedAvatar from "../common/ThemedAvatar";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { isChildAccount } from "../../utils/auth";

const menuItems = [
  {
    icon: "images",
    iconColor: "#3B82F6",
    iconBg: "#EAF1FF",
    title: "Albums",
    route: "Gallery",
  },
  {
    icon: "people",
    iconColor: "#FB923C",
    iconBg: "#FFF0E5",
    title: "People",
  },
  {
    icon: "location",
    iconColor: "#8B5CF6",
    iconBg: "#F1EAFF",
    title: "Places",
  },
  {
    icon: "lock-closed",
    iconColor: "#22C55E",
    iconBg: "#E8FAEF",
    title: "Vault",
  },
  {
    icon: "heart",
    iconColor: "#EC4899",
    iconBg: "#FDEAF4",
    title: "Favorites",
    route: "Images",
  },
  {
    icon: "trash",
    iconColor: "#6366F1",
    iconBg: "#EEF2FF",
    title: "Recycle Bin",
    route: "RecycleBin",
  },
];

const getLoggedInChildId = (user) =>
  user?.child_id ||
  user?.childId ||
  user?.child_profile_id ||
  user?.childProfileId ||
  user?.child?.id ||
  user?.child_profile?.id ||
  user?.childProfile?.id ||
  user?.profile?.id ||
  user?.id ||
  null;

export default function MenuDrawer({ visible, onClose }) {
  const navigation = useNavigation();
  const {
    children,
    currentUser,
    profile,
    refreshChildren,
    selectedChildId,
    selectedParentView,
    selectChild,
    selectParentAccount,
    viewerProfile,
    logout,
  } = useProfile();
  const { theme } = useTheme();
  const [accountsVisible, setAccountsVisible] = useState(false);

  useEffect(() => {
    if (visible && currentUser?.id) {
      refreshChildren().catch(() => {});
    }
  }, [currentUser?.id, refreshChildren, visible]);

  const accountOptions = useMemo(() => {
    const childUser = isChildAccount(currentUser);
    const loggedInChildId = childUser
      ? getLoggedInChildId(currentUser)
      : null;

    const activeAccountKey = selectedParentView
      ? "parent"
      : selectedChildId
      ? `child-${selectedChildId}`
      : childUser && loggedInChildId
      ? `child-${loggedInChildId}`
      : "owner";

    const loggedInAccount = {
      id: "owner",
      name: profile.name,
      subtitle: childUser ? "Your account" : "Owner account",
      image: profile.image,
      isOwner: true,
      isActive:
        activeAccountKey === "owner" ||
        (childUser &&
          loggedInChildId &&
          activeAccountKey === `child-${loggedInChildId}`),
    };

    if (childUser) {
      return [loggedInAccount];
    }

    const childAccounts = children
      .filter((child) => !loggedInChildId || String(child.id) !== String(loggedInChildId))
      .map((child) => ({
        id: child.id,
        name: child.name || child.full_name || child.username || "Child",
        subtitle: `${child.relationship || "Child account"} - View only`,
        image: child.avatar_url || child.profile_image || child.image || "",
        isOwner: false,
        isActive: activeAccountKey === `child-${child.id}`,
      }));

    return [loggedInAccount, ...childAccounts];
  }, [children, currentUser, profile, selectedChildId, selectedParentView]);

  const handleRoutePress = (route) => {
    onClose();

    if (route) {
      navigation.navigate(route);
    }
  };

  const handleAccountPress = async (account) => {
    try {
      if (account.isOwner) {
        if (isChildAccount(currentUser)) {
          await selectChild(getLoggedInChildId(currentUser));
        } else {
          await selectChild(null);
        }
      } else if (account.isParentView) {
        await selectParentAccount();
      } else {
        await selectChild(account.id);
      }
      onClose();
      navigation.navigate("Gallery");
    } catch (error) {
      // Keep the drawer open so the user can retry or choose another profile.
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.drawer, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.primary} />
            </TouchableOpacity>
            <View style={styles.iconButton} />
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => setAccountsVisible((current) => !current)}
          >
            <ThemedAvatar
              uri={viewerProfile.image}
              name={viewerProfile.name}
              style={styles.profileImage}
            />
            <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: theme.text }]}>{viewerProfile.name}</Text>
              <Text style={[styles.profileEmail, { color: theme.subText }]}>{viewerProfile.email}</Text>
            </View>
            <Ionicons
              name={accountsVisible ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.subText}
            />
          </TouchableOpacity>

          {accountsVisible ? (
            <View style={styles.accountList}>
              {accountOptions.map((account) => (
                <TouchableOpacity
                  key={String(account.id)}
                  style={[
                    styles.accountRow,
                    { backgroundColor: account.isActive ? theme.iconBg : "transparent" },
                  ]}
                  onPress={() => handleAccountPress(account)}
                  activeOpacity={0.86}
                >
                  <ThemedAvatar
                    uri={account.image}
                    name={account.name}
                    style={styles.accountImage}
                  />
                  <View style={styles.menuText}>
                    <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
                      {account.name}
                    </Text>
                    <Text style={[styles.menuSubtitle, { color: theme.subText }]}>
                      {account.subtitle}
                    </Text>
                  </View>
                  {account.isActive ? (
                    <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={styles.menuGroup}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.title}
                style={styles.menuItem}
                onPress={() => handleRoutePress(item.route)}
              >
                <View
                  style={[styles.menuIcon, { backgroundColor: theme.iconBg }]}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.iconColor}
                  />
                </View>
                <View style={styles.menuText}>
                  <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subText} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.spacer} />

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={async () => {
              onClose();
              await logout();
              navigation.reset({
                index: 0,
                routes: [{ name: "AuthProfile" }],
              });
            }}
          >
            <Ionicons name="log-out" size={16} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Pressable style={styles.scrim} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
  },

  drawer: {
    width: "58%",
    maxWidth: 330,
    minWidth: 230,
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },

  scrim: {
    flex: 1,
    backgroundColor: "rgba(16,20,69,0.22)",
  },

  header: {
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: -20,
    paddingHorizontal: 16,
    paddingTop: 26,
    marginBottom: 16,
  },

  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 12,
    gap: 12,
    marginBottom: 22,
  },

  profileText: {
    flex: 1,
  },

  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  profileName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },

  profileEmail: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },

  menuGroup: {
    gap: 6,
  },

  accountList: {
    marginTop: -12,
    marginBottom: 18,
    gap: 4,
  },

  accountRow: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  accountImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  accountName: {
    fontSize: 13,
    fontWeight: "700",
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
  },

  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  menuText: {
    flex: 1,
  },

  menuTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  menuSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 18,
  },

  settingsIcon: {
    backgroundColor: "#F3F4F6",
  },

  spacer: {
    flex: 1,
    minHeight: 18,
  },

  storageCard: {
    backgroundColor: "#EEF4FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  storageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  storageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  storageTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  storageText: {
    fontSize: 11,
    color: "#374151",
  },

  progressTrack: {
    height: 7,
    backgroundColor: "#D8E5FF",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },

  progressFill: {
    width: "85%",
    height: "100%",
    backgroundColor: "#6366F1",
  },

  storageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  storageSub: {
    fontSize: 11,
    color: "#6B7280",
  },

  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  upgradeText: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "600",
  },

  signOutButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  signOutText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EF4444",
  },
});
