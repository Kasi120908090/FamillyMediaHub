import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AppHeader from "../../components/navigation/AppHeader";
import VideoPlayer from "../../components/media/VideoPlayer";
import { useAuth } from "../../hooks/useAuth";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { isParentAdminReady } from "../../utils/auth";

const uploadTypes = [
  { id: "image", label: "Image", icon: "image-outline" },
  { id: "video", label: "Video", icon: "videocam-outline" },
  { id: "file", label: "File", icon: "document-outline" },
];

const uploadDestinationByCategory = {
  image: "Images",
  video: "Videos",
  file: "Files",
};

const uploadActionTextByCategory = {
  image: "Upload Image",
  video: "Upload Video",
  file: "Upload File",
};

const createUploadId = () =>
  `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function UploadScreen({ navigation, onOpenMenu, route }) {
  const { category: initialCategory, openPicker } = route?.params || {};
  const {
    currentUser,
    parentDevices,
    profile,
    viewerProfile,
    canManageMedia,
    refreshDevices,
    uploadMedia,
    cancelMediaUpload,
    isSubmitting,
  } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState("image");
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedUploadChildId, setSelectedUploadChildId] = useState(null);
  const [isUploadStarting, setIsUploadStarting] = useState(false);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [isCancellingUpload, setIsCancellingUpload] = useState(false);
  const uploadAbortControllerRef = useRef(null);
  const uploadCancelRequestedRef = useRef(false);

  const isParentAccount = isParentAdminReady(currentUser);
  const loggedInChildId =
    currentUser?.child_id ||
    currentUser?.childId ||
    currentUser?.child_profile_id ||
    currentUser?.childProfileId ||
    currentUser?.child?.id ||
    currentUser?.child_profile?.id ||
    currentUser?.childProfile?.id ||
    currentUser?.profile?.id ||
    currentUser?.id ||
    null;
  const isViewOnly = !canManageMedia;

  useEffect(() => {
    if (isParentAccount) {
      refreshDevices().catch(() => {});
    }
  }, [isParentAccount, refreshDevices]);

  useEffect(() => {
    if (initialCategory && initialCategory !== category) {
      setCategory(initialCategory);
      setSelectedFile(null);
    }
  }, [initialCategory]);

  const childOptions = useMemo(() => {
    if (!isParentAccount) {
      return [{ id: loggedInChildId, label: `${profile.name} (current child account)` }];
    }

    return [];
  }, [isParentAccount, loggedInChildId, profile.name]);

  const uploadInProgress = isUploadStarting || isSubmitting;

  useEffect(() => {
    if (!isParentAccount) {
      setSelectedUploadChildId(loggedInChildId);
      return;
    }

    setSelectedUploadChildId(null);
  }, [
    childOptions,
    isParentAccount,
    loggedInChildId,
  ]);

  const handlePickFile = async (overrideCategory) => {
    if (isPickingFile) {
      return;
    }

    const activeCategory = overrideCategory || category;

    if (isViewOnly) {
      Alert.alert("View only", "Switch back to your own account to upload media.");
      return;
    }

    setIsPickingFile(true);

    try {
      if (activeCategory === "file") {
        const result = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
          type: "*/*",
        });

        if (result.canceled || !result.assets?.length) {
          return;
        }

        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name || `file-${Date.now()}`,
          type: asset.mimeType || "application/octet-stream",
        });
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission required", "Allow media library access to upload files.");
        return;
      }

      const mediaTypeOption =
        activeCategory === "video"
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypeOption,
        quality: 1,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name:
            asset.fileName ||
            `${activeCategory}-${Date.now()}.${activeCategory === "video" ? "mp4" : "jpg"}`,
          type: asset.mimeType || (activeCategory === "video" ? "video/mp4" : "image/jpeg"),
        });
      }
    } finally {
      setIsPickingFile(false);
    }
  };

  useEffect(() => {
    if (openPicker && initialCategory) {
      handlePickFile(initialCategory);
    }
  }, [openPicker, initialCategory]);

  const handleUpload = async () => {
    if (uploadInProgress) {
      return;
    }

    if (isViewOnly) {
      Alert.alert("View only", "Switch back to your own account to upload media.");
      return;
    }

    if (!isParentAccount && !loggedInChildId) {
      Alert.alert("Child required", "This child account could not be identified for upload.");
      return;
    }

    if (!selectedFile) {
      Alert.alert("File required", "Choose a file to upload first.");
      return;
    }

    const uploadId = createUploadId();
    const abortController =
      typeof AbortController !== "undefined" ? new AbortController() : null;

    uploadAbortControllerRef.current = abortController;
    uploadCancelRequestedRef.current = false;
    setActiveUploadId(uploadId);
    setIsCancellingUpload(false);
    setIsUploadStarting(true);

    let locationPayload = {};

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("[Upload] Location permission denied. Continuing upload without device GPS.");
      } else {
        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!servicesEnabled) {
          console.log("[Upload] Location unavailable. Device location services are turned off.");
        } else {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const latitude = currentLocation?.coords?.latitude;
          const longitude = currentLocation?.coords?.longitude;
          const locationAccuracy = currentLocation?.coords?.accuracy;

          if (typeof latitude === "number" && typeof longitude === "number") {
            locationPayload = {
              latitude,
              longitude,
              location_accuracy:
                typeof locationAccuracy === "number" ? locationAccuracy : undefined,
              location_source: "device",
            };
          } else {
            console.log("[Upload] Location unavailable. Coordinates were missing from the device response.");
          }
        }
      }
    } catch (locationError) {
      console.log(
        `[Upload] Location unavailable. Continuing upload without device GPS. ${locationError?.message || ""}`.trim()
      );
    }

    try {
      await uploadMedia({
        upload_id: uploadId,
        child_id: isParentAccount ? undefined : loggedInChildId,
        device_id: isParentAccount && selectedDeviceId ? selectedDeviceId : undefined,
        category,
        file: selectedFile,
        ...locationPayload,
      }, { signal: abortController?.signal });
      Alert.alert("Upload complete", "Your media was uploaded successfully.");
      setSelectedFile(null);
      navigation.navigate(uploadDestinationByCategory[category] || "Gallery");
    } catch (error) {
      if (uploadCancelRequestedRef.current || error?.name === "AbortError") {
        Alert.alert("Upload cancelled", "Your upload was cancelled.");
      } else {
        Alert.alert("Upload failed", error.message);
      }
    } finally {
      uploadAbortControllerRef.current = null;
      uploadCancelRequestedRef.current = false;
      setActiveUploadId(null);
      setIsCancellingUpload(false);
      setIsUploadStarting(false);
    }
  };

  const handleCancelUpload = async () => {
    if (!activeUploadId || isCancellingUpload) {
      return;
    }

    setIsCancellingUpload(true);

    try {
      await cancelMediaUpload(activeUploadId);
      uploadCancelRequestedRef.current = true;
      uploadAbortControllerRef.current?.abort();
    } catch (error) {
      setIsCancellingUpload(false);
      Alert.alert("Cancel failed", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Upload Media"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
            <Image source={{ uri: viewerProfile.image }} style={styles.avatar} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Backup to Family Hub</Text>
        <Text style={styles.subtitle}>
          Upload images, videos, or files directly to your local backend.
        </Text>

        <Text style={styles.sectionLabel}>Media Type</Text>
        <View style={styles.chipRow}>
          {uploadTypes.map((item) => {
            const active = category === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setCategory(item.id);
                  setSelectedFile(null);
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={active ? "#fff" : "#2563EB"}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isParentAccount ? (
          <>
            <Text style={styles.sectionLabel}>Choose Device</Text>
            <View style={styles.targetList}>
              <TouchableOpacity
                key="current-device"
                style={[
                  styles.targetCard,
                  selectedDeviceId === null && styles.targetCardActive,
                ]}
                onPress={() => setSelectedDeviceId(null)}
              >
                <Text
                  style={[
                    styles.targetText,
                    selectedDeviceId === null && styles.targetTextActive,
                  ]}
                >
                  Current Device
                </Text>
                <Text
                  style={[
                    styles.targetMeta,
                    selectedDeviceId === null && styles.targetTextActive,
                  ]}
                >
                  Upload directly from this device without linking it to a parent device.
                </Text>
              </TouchableOpacity>

              {parentDevices.length ? (
                parentDevices.map((device) => {
                  const deviceId = device.id;
                  const active = selectedDeviceId === deviceId;
                  const deviceName =
                    device.device_name || device.name || device.model || `Device ${deviceId}`;
                  const deviceMeta =
                    device.device_type || device.platform || device.serial_number || "Linked device";

                  return (
                    <TouchableOpacity
                      key={String(deviceId)}
                      style={[styles.targetCard, active && styles.targetCardActive]}
                      onPress={() => setSelectedDeviceId(deviceId)}
                    >
                      <Text style={[styles.targetText, active && styles.targetTextActive]}>
                        {deviceName}
                      </Text>
                      <Text style={[styles.targetMeta, active && styles.targetTextActive]}>
                        {deviceMeta}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : null}
            </View>

            <Text style={styles.helperText}>
              {selectedDeviceId
                ? "This upload will be saved to the admin account and associated with the selected device."
                : "This upload will be saved to the admin account."}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Upload For</Text>
            <View style={styles.targetList}>
              {childOptions.map((target) => (
                <View key={String(target.id)} style={[styles.targetCard, styles.targetCardActive]}>
                  <Text style={[styles.targetText, styles.targetTextActive]}>{target.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {selectedFile ? (
          <View style={styles.filePicker}>
            {category === "image" ? (
              <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
            ) : category === "video" ? (
              <VideoPlayer source={selectedFile.uri} style={styles.videoPreview} fullscreen={true} />
            ) : (
              <View style={styles.videoPreview}>
                <Ionicons name="document-text" size={40} color="#2563EB" />
              </View>
            )}
            <Text style={styles.fileName}>{selectedFile.name}</Text>
            <Pressable
              style={styles.changeFileButton}
              onPress={() => handlePickFile(category)}
              disabled={isPickingFile}
            >
              {isPickingFile ? (
                <ActivityIndicator color="#2563EB" />
              ) : (
                <Text style={styles.changeFileButtonText}>
                  Choose another {category}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.filePicker,
              pressed && styles.filePickerPressed,
              isPickingFile && styles.filePickerBusy,
            ]}
            onPress={() => handlePickFile()}
            disabled={isPickingFile}
          >
            <View style={styles.iconBox}>
              {isPickingFile ? (
                <ActivityIndicator color="#2563EB" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={28} color="#2563EB" />
              )}
            </View>
            <Text style={styles.filePickerTitle}>
              {isPickingFile ? "Opening picker..." : `Choose a ${category}`}
            </Text>
            <Text style={styles.filePickerSubtitle}>
              {category === "file"
                ? "Tap here to choose any file from your device."
                : "Tap here to select from your device library."}
            </Text>
          </Pressable>
        )}

        <TouchableOpacity
          style={[
            styles.uploadButton,
            (!selectedFile || uploadInProgress || isViewOnly) &&
              styles.uploadButtonDisabled,
          ]}
          onPress={handleUpload}
          disabled={!selectedFile || uploadInProgress || isViewOnly}
        >
          {uploadInProgress ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>
              {isViewOnly
                ? "View Only"
                : selectedFile
                ? uploadActionTextByCategory[category] || "Upload Now"
                : "Choose Media First"}
            </Text>
          )}
        </TouchableOpacity>

        {activeUploadId && uploadInProgress ? (
          <TouchableOpacity
            style={[
              styles.cancelUploadButton,
              isCancellingUpload && styles.uploadButtonDisabled,
            ]}
            onPress={handleCancelUpload}
            disabled={isCancellingUpload}
          >
            {isCancellingUpload ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.cancelUploadButtonText}>Cancel Upload</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },
  content: {
    padding: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 120,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    color: "#6B7280",
    lineHeight: 20,
  },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6B7280",
  },
  chipRow: {
    flexDirection: "row",
    gap: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E0ECFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: "#2563EB",
  },
  chipText: {
    color: "#2563EB",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  targetList: {
    gap: 10,
  },
  targetCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  targetCardActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EEF4FF",
  },
  targetText: {
    color: "#111827",
    fontWeight: "500",
  },
  targetMeta: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 12,
  },
  targetTextActive: {
    color: "#2563EB",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  emptyText: {
    color: "#6B7280",
  },
  helperText: {
    marginTop: 10,
    color: "#6B7280",
    lineHeight: 20,
  },
  filePicker: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#93C5FD",
    minHeight: 260,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filePickerPressed: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
    transform: [{ scale: 0.995 }],
  },
  filePickerBusy: {
    opacity: 0.8,
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  filePickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  filePickerSubtitle: {
    marginTop: 8,
    textAlign: "center",
    color: "#6B7280",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 14,
  },
  videoPreview: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: {
    color: "#111827",
    fontWeight: "600",
    textAlign: "center",
  },
  changeFileButton: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#E0ECFF",
  },
  changeFileButtonText: {
    color: "#2563EB",
    fontWeight: "700",
  },
  uploadButton: {
    marginTop: 20,
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  cancelUploadButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancelUploadButtonText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 16,
  },
});
