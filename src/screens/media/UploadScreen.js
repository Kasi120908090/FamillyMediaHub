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
import VideoPlayer from "../../components/media/VideoPlayer";
import { softShadow, ui } from "../../components/media/MediaDesign";
import { mediaService } from "../../services/mediaService";
import { useAuth } from "../../hooks/useAuth";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import * as S from "../../theme/designSystem";
import * as j from "../../theme/responsive";
import { commonStyles as x } from "../../theme/commonStyles";
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

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (!value) {
    return "";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(value > 10 * 1024 * 1024 ? 0 : 1)} MB`;
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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [category, setCategory] = useState("image");
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedUploadChildId, setSelectedUploadChildId] = useState(null);
  const [isUploadStarting, setIsUploadStarting] = useState(false);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [activeUploadMode, setActiveUploadMode] = useState("standard");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCancellingUpload, setIsCancellingUpload] = useState(false);
  const uploadAbortControllerRef = useRef(null);
  const uploadCancelRequestedRef = useRef(false);
  const lastProgressRef = useRef(0);
  const activeUploadIdRef = useRef(null);
  const activeUploadModeRef = useRef("standard");
  const [activeUploadFileName, setActiveUploadFileName] = useState("");
  const [activeUploadIndex, setActiveUploadIndex] = useState(0);
  const [activeUploadTotal, setActiveUploadTotal] = useState(0);

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
  const selectedFile = selectedFiles[0] || null;
  const selectedFileCount = selectedFiles.length;

  useEffect(() => {
    if (isParentAccount) {
      refreshDevices().catch(() => {});
    }
  }, [isParentAccount, refreshDevices]);

  useEffect(() => {
    if (initialCategory && initialCategory !== category) {
      setCategory(initialCategory);
      setSelectedFiles([]);
    }
  }, [initialCategory]);

  const childOptions = useMemo(() => {
    if (!isParentAccount) {
      return [{ id: loggedInChildId, label: `${profile.name} (current child account)` }];
    }

    return [];
  }, [isParentAccount, loggedInChildId, profile.name]);

  const uploadInProgress = isUploadStarting || isSubmitting;
  const canShowCancelUpload = uploadInProgress && !isViewOnly;
  const selectedFileUsesChunkedUpload = selectedFile
    ? selectedFiles.some((file) => mediaService.shouldUseChunkedUpload({ category, file }))
    : false;

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
          multiple: true,
          type: "*/*",
        });

        // Handle both expo-document-picker response shapes across versions
        // Newer: { canceled: boolean, assets: [...] }
        // Older: { type: 'cancel'|'success', uri, name, size, mimeType }
        if (!result.canceled && Array.isArray(result.assets) && result.assets.length) {
          setSelectedFiles(
            result.assets.map((asset, index) => ({
              uri: asset.uri,
              name: asset.name || `file-${Date.now()}-${index + 1}`,
              type: asset.mimeType || "application/octet-stream",
              size: asset.size || asset.fileSize || 0,
            }))
          );
          return;
        }

        if (result.type === "success" && result.uri) {
          setSelectedFiles([
            {
              uri: result.uri,
              name: result.name || `file-${Date.now()}`,
              type: result.mimeType || "application/octet-stream",
              size: result.size || 0,
            },
          ]);
          return;
        }

        // Cancelled or unsupported shape
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission required", "Allow media library access to upload files.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // Using array syntax is the modern standard for expo-image-picker to avoid deprecation warnings
        mediaTypes: activeCategory === "video" ? ["videos"] : ["images"],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets?.length) {
        setSelectedFiles(
          result.assets.map((asset, index) => ({
            uri: asset.uri,
            name:
              asset.fileName ||
              `${activeCategory}-${Date.now()}-${index + 1}.${activeCategory === "video" ? "mp4" : "jpg"}`,
            type: asset.mimeType || (activeCategory === "video" ? "video/mp4" : "image/jpeg"),
            duration: asset.duration ? asset.duration / 1000 : undefined,
            size: asset.fileSize || asset.size || 0,
          }))
        );
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

    if (!selectedFiles.length) {
      Alert.alert("File required", "Choose a file to upload first.");
      return;
    }

    const abortController =
      typeof AbortController !== "undefined" ? new AbortController() : null;

    uploadAbortControllerRef.current = abortController;
    uploadCancelRequestedRef.current = false;
    activeUploadIdRef.current = null;
    activeUploadModeRef.current = "standard";
    setActiveUploadId(null);
    setActiveUploadMode("standard");
    setUploadProgress(0);
    lastProgressRef.current = 0;
    setIsCancellingUpload(false);
    setIsUploadStarting(true);
    setActiveUploadTotal(selectedFiles.length);

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
      if (uploadCancelRequestedRef.current || abortController?.signal?.aborted) {
        const abortError = new Error("Upload cancelled");
        abortError.name = "AbortError";
        throw abortError;
      }

      for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex += 1) {
        const file = selectedFiles[fileIndex];
        const uploadId = createUploadId();
        const willUseChunkedUpload = mediaService.shouldUseChunkedUpload({
          category,
          file,
        });

        activeUploadIdRef.current = uploadId;
        activeUploadModeRef.current = willUseChunkedUpload ? "chunked" : "standard";
        setActiveUploadId(uploadId);
        setActiveUploadMode(willUseChunkedUpload ? "chunked" : "standard");
        setActiveUploadFileName(file.name);
        setActiveUploadIndex(fileIndex + 1);
        lastProgressRef.current = 0;
        setUploadProgress(fileIndex / selectedFiles.length);

        console.log(`[UploadScreen] Dispatching upload for item ${fileIndex + 1}:`, {
          name: file.name,
          uri: file.uri,
          size: file.size,
          type: file.type
        });

        await uploadMedia({
          upload_id: uploadId,
          child_id: isParentAccount ? undefined : loggedInChildId,
          device_id: isParentAccount && selectedDeviceId ? selectedDeviceId : undefined,
          category,
          file,
          ...locationPayload,
        }, {
          signal: abortController?.signal,
          onUploadStart: ({ uploadId: serverUploadId, mode }) => {
            if (serverUploadId) {
              activeUploadIdRef.current = serverUploadId;
              setActiveUploadId(serverUploadId);
            }
            activeUploadModeRef.current = mode || "standard";
            setActiveUploadMode(mode || "standard");
          },
          onProgress: ({ progress }) => {
            const itemProgress = Math.max(0, Math.min(1, Number(progress) || 0));
            const overallProgress = (fileIndex + itemProgress) / selectedFiles.length;
            if (
              overallProgress === 1 ||
              overallProgress - lastProgressRef.current >= 0.03
            ) {
              lastProgressRef.current = overallProgress;
              setUploadProgress(overallProgress);
            }
          },
        });
      }

      Alert.alert(
        "Upload complete",
        selectedFiles.length === 1
          ? "Your media was uploaded successfully."
          : `${selectedFiles.length} items were uploaded successfully.`
      );
      setSelectedFiles([]);
      const parentNavigation = navigation.getParent?.() || navigation;
      parentNavigation.navigate("MainTabs", {
        screen: "Gallery",
        params: { mediaTab: uploadDestinationByCategory[category] || "Gallery" },
      });
    } catch (error) {
      if (uploadCancelRequestedRef.current || error?.name === "AbortError") {
        Alert.alert("Upload cancelled", "Your upload was cancelled.");
      } else {
        Alert.alert("Upload failed", error.message);
      }
    } finally {
      uploadAbortControllerRef.current = null;
      uploadCancelRequestedRef.current = false;
      activeUploadIdRef.current = null;
      activeUploadModeRef.current = "standard";
      setActiveUploadId(null);
      setActiveUploadMode("standard");
      // Keep filename visible briefly before clearing to avoid flickering
      setActiveUploadIndex(0);
      setActiveUploadTotal(0);
      setUploadProgress(0);
      setIsCancellingUpload(false);
      setIsUploadStarting(false);
      // Clear filename after a short delay to prevent flickering
      setTimeout(() => {
        setActiveUploadFileName("");
      }, 100);
    }
  };

  const handleCancelUpload = async () => {
    const uploadIdToCancel = activeUploadIdRef.current || activeUploadId;
    const uploadModeToCancel = activeUploadModeRef.current || activeUploadMode;

    if (isCancellingUpload || !uploadInProgress) {
      return;
    }

    setIsCancellingUpload(true);
    uploadCancelRequestedRef.current = true;
    uploadAbortControllerRef.current?.abort();

    if (!uploadIdToCancel) {
      return;
    }

    try {
      await cancelMediaUpload(uploadIdToCancel, {
        chunked: uploadModeToCancel === "chunked",
      });
    } catch (error) {
      if (!uploadCancelRequestedRef.current) {
        Alert.alert("Cancel failed", error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.uploadTopBar}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()} activeOpacity={0.82}>
            <Ionicons name="close" size={22} color={ui.purple} />
          </TouchableOpacity>
          <View style={styles.uploadTitleWrap}>
            <Text style={styles.heading}>Upload</Text>
            <Text style={styles.subtitle}>
              Add photos, videos, and files to your family hub
            </Text>
          </View>
          <View style={styles.closeButton} />
        </View>
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
                  setSelectedFiles([]);
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
            {selectedFileCount > 1 ? (
              <Text style={styles.fileCountText}>
                {selectedFileCount} items selected
              </Text>
            ) : null}
            {selectedFile.size ? (
              <Text style={styles.fileSizeText}>{formatBytes(selectedFile.size)}</Text>
            ) : null}
            {selectedFileUsesChunkedUpload ? (
              <View style={styles.largeVideoPill}>
                <Ionicons name="flash-outline" size={13} color={ui.purple} />
                <Text style={styles.largeVideoText}>Large video - smooth chunked upload</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.changeFileButton}
              onPress={() => handlePickFile(category)}
              disabled={isPickingFile}
            >
              {isPickingFile ? (
                <ActivityIndicator color="#2563EB" />
              ) : (
                <Text style={styles.changeFileButtonText}>
                  Choose more {category === "file" ? "files" : `${category}s`}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.filePicker,
              softShadow,
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
              {isPickingFile ? "Opening picker..." : "Tap anywhere to upload"}
            </Text>
            <Text style={styles.filePickerSubtitle}>
              Photos, videos, and files
            </Text>
            <View style={styles.divider} />
            <View style={styles.browseButton}>
              <Ionicons name="folder-outline" size={16} color={ui.purple} />
              <Text style={styles.browseText}>Browse Files</Text>
            </View>
          </Pressable>
        )}

        {uploadInProgress ? (
          <View style={[styles.progressCard, softShadow]}>
            <View style={styles.progressTopRow}>
              <Text style={styles.progressTitle}>
                {activeUploadMode === "chunked" ? "Uploading large video" : "Uploading"}
              </Text>
              <Text style={styles.progressPercent}>
                {Math.round(uploadProgress * 100)}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(4, Math.round(uploadProgress * 100))}%` },
                ]}
              />
            </View>
            <Text style={styles.progressHint} numberOfLines={2}>
              {activeUploadFileName
                ? `${activeUploadTotal > 1 ? `Item ${activeUploadIndex} of ${activeUploadTotal} - ` : ""}${activeUploadFileName}`
                : activeUploadMode === "chunked"
                ? "Sending one chunk at a time to keep the app responsive."
                : "Keeping your upload steady."}
            </Text>
            {canShowCancelUpload ? (
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
          </View>
        ) : null}

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
                ? selectedFileCount > 1
                  ? `Upload ${selectedFileCount} Items`
                  : uploadActionTextByCategory[category] || "Upload Now"
                : "Choose Media First"}
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// Alias StyleSheet to 's' to match the usage in the T style object below
const s = StyleSheet;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  content: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 38,
    paddingBottom: 120,
  },
  uploadTopBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  heading: {
    fontSize: 15,
    fontWeight: "900",
    color: ui.ink,
  },
  subtitle: {
    marginTop: 7,
    color: ui.muted,
    lineHeight: 16,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0,
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
    borderRadius: 9,
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
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#BBAEFF",
    minHeight: 250,
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  filePickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ui.ink,
    fontSize: 13,
  },
  filePickerSubtitle: {
    marginTop: 8,
    textAlign: "center",
    color: ui.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: "#ECE9F7",
    marginVertical: 18,
  },
  browseButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: ui.purpleSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  browseText: {
    color: ui.purple,
    fontWeight: "900",
    fontSize: 12,
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
  fileSizeText: {
    marginTop: 4,
    color: ui.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  fileCountText: {
    marginTop: 6,
    color: ui.purple,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  largeVideoPill: {
    marginTop: 10,
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: ui.purpleSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  largeVideoText: {
    color: ui.purple,
    fontSize: 11,
    fontWeight: "800",
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
  progressCard: {
    marginTop: 18,
    borderRadius: 8,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE9F7",
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressTitle: {
    color: ui.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  progressPercent: {
    color: ui.purple,
    fontSize: 12,
    fontWeight: "900",
  },
  progressTrack: {
    height: 8,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#ECE9F7",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: ui.purple,
  },
  progressHint: {
    marginTop: 8,
    color: ui.muted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
    maxWidth: "100%",
  },
  uploadButton: {
    marginTop: 20,
    backgroundColor: ui.purple,
    borderRadius: 8,
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
