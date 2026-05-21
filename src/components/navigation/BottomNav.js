import React, { useState } from "react";
import { Alert, Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { softShadow } from "../media/MediaDesign";

const BottomNav = ({ activeTab }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { canManageMedia } = useProfile();
  const focusedTab = activeTab || route.name;
  const tabs = [
    { id: "Gallery", icon: "images-outline", activeIcon: "images", label: "Gallery" },
    { id: "Images", icon: "image-outline", activeIcon: "image", label: "Images" },
    { id: "Videos", icon: "videocam-outline", activeIcon: "videocam", label: "Videos" },
    { id: "Files", icon: "folder-outline", activeIcon: "folder", label: "Files" },
    { id: "BackupDashboard", icon: "cloud-upload-outline", activeIcon: "cloud-upload", label: "Back up" },
  ];

  const [uploadOptionsVisible, setUploadOptionsVisible] = useState(false);

  const openUploadOptions = () => setUploadOptionsVisible(true);
  const closeUploadOptions = () => setUploadOptionsVisible(false);

  const handleUploadOption = (category) => {
    closeUploadOptions();
    if (!canManageMedia) {
      Alert.alert("View only", "Switch back to your own account to upload media.");
      return;
    }
    navigation.navigate("Upload", { category, openPicker: true });
  };

  return (
    <>
      <View
        style={[
          styles.bottomNav,
          softShadow,
          {
            backgroundColor: theme.tabBar,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = focusedTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.navItem, isActive && { backgroundColor: theme.iconBg }]}
              onPress={() => {
                if (!isActive) {
                  navigation.navigate(tab.id);
                }
              }}
              activeOpacity={0.82}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={21}
                color={isActive ? theme.primary : theme.subText}
              />
              <Text
                style={[
                  styles.navText,
                  { color: isActive ? theme.primary : theme.subText },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.centerButtonWrapper, softShadow]}>
        <Pressable
          style={({ pressed }) => [
            styles.centerButton,
            { backgroundColor: theme.primary },
            !canManageMedia && styles.navItemDisabled,
            pressed && styles.centerButtonPressed,
          ]}
          onPress={openUploadOptions}
          hitSlop={10}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </Pressable>
        <Text style={[styles.uploadLabel, { color: theme.primary }]}>Upload</Text>
      </View>

      <Modal visible={uploadOptionsVisible} transparent animationType="fade" onRequestClose={closeUploadOptions}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeUploadOptions} />
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Upload</Text>
          <TouchableOpacity style={styles.optionRow} onPress={() => handleUploadOption("image")}> 
            <Ionicons name="image-outline" size={22} color={theme.primary} />
            <Text style={[styles.optionLabel, { color: theme.text }]}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} onPress={() => handleUploadOption("video")}> 
            <Ionicons name="videocam-outline" size={22} color={theme.primary} />
            <Text style={[styles.optionLabel, { color: theme.text }]}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} onPress={() => handleUploadOption("file")}> 
            <Ionicons name="document-outline" size={22} color={theme.primary} />
            <Text style={[styles.optionLabel, { color: theme.text }]}>File</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 5,
    paddingTop: 7,
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  navItem: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    gap: 2,
  },
  centerButtonWrapper: {
    position: "absolute",
    right: 22,
    bottom: 72,
    width: 54,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  centerButtonPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalContent: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 90,
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
    gap: 12,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 10,
  },
  navItemDisabled: {
    opacity: 0.55,
  },
  navText: {
    fontSize: 9,
    fontWeight: "700",
  },
  uploadLabel: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: "800",
  },
});

export default BottomNav;
