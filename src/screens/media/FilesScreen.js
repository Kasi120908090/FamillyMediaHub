import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import VideoThumbnail from "../../components/media/VideoThumbnail";
import CachedImage from "../../components/media/CachedImage";
import { FlashList } from "@shopify/flash-list";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import FileViewer from "../../components/media/FileViewer";
import ImageViewer from "../../components/media/ImageViewer";
import VideoFullScreenViewer from "../../components/media/VideoFullScreenViewer";
import AppHeader from "../../components/navigation/AppHeader";
import {
  SearchFilterBar,
  getFileTone,
  getFriendlyTitle,
  getReadableSize,
  softShadow,
  ui,
} from "../../components/media/MediaDesign";
import { moderateScale } from "../../theme/responsive";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { resolveMediaUri } from "../../services/api";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { getMediaSource } from "../../utils/media";
import { getOrCreateVideoThumbnailUri } from "../../utils/videoThumbnails";

const getFileItemKey = (item, index) => {
  const stablePart =
    item?.id ??
    item?.file_path ??
    item?.previewUri ??
    item?.stored_file_name ??
    item?.original_file_name ??
    "file";

  return `file-${stablePart}-${index}`;
};

const firstValue = (...values) => values.find((value) => Boolean(value));

const getFileExtension = (value) => {
  const stringValue = String(value || "").split("?")[0].toLowerCase();
  const match = stringValue.match(/\.([^.\/]+)$/);
  return match ? match[1] : "";
};

const getContentType = (item) =>
  String(item?.content_type || item?.mime_type || item?.mimeType || item?.type || "").toLowerCase();

const isMediaCategory = (category) =>
  typeof category === "string" && /(image|images|video|videos)/i.test(category);

const isImageExtension = (value) => {
  const extension = getFileExtension(value);
  return ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tiff", "svg"].includes(extension);
};

const isVideoExtension = (value) => {
  const extension = getFileExtension(value);
  return ["mp4", "mov", "avi", "mkv", "webm", "3gp", "flv", "mts", "m4v"].includes(extension);
};

const getFileUri = (item) => {
  const serverPath = firstValue(
    item?.file_url,
    item?.fileUrl,
    item?.file_uri,
    item?.fileUri,
    item?.url,
    item?.download_url,
    item?.downloadUrl,
    item?.file_path,
    item?.path,
    item?.preview_url,
    item?.previewUrl,
    item?.preview_uri
  );

  return serverPath
    ? resolveMediaUri(serverPath)
    : firstValue(
        item?.previewUri,
        item?.preview_url,
        item?.previewUrl,
        item?.uri,
        item?.local_uri,
        item?.localUri,
        item?.file_path,
        item?.path
      ) || null;
};

const getFileOpenCategory = (item) => {
  const fileName = String(item?.original_file_name || item?.stored_file_name || item?.file_path || item?.path || "");
  const contentType = getContentType(item);
  const extension = getFileExtension(fileName || getFileUri(item));

  if (contentType.startsWith("image/") || isImageExtension(fileName)) return "image";
  if (contentType.startsWith("video/") || isVideoExtension(fileName)) return "video";
  if (extension === "pdf" || contentType.includes("pdf")) return "pdf";
  if (extension === "txt" || contentType.includes("text/plain")) return "txt";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) return "office";
  return "external";
};

const getMediaChildId = (item) =>
  item?.child_id ??
  item?.childId ??
  item?.child_profile_id ??
  item?.childProfileId ??
  null;

const isFileUpload = (item) => {
  const contentType = getContentType(item);
  const fileName = String(
    item?.original_file_name || item?.stored_file_name || item?.file_path || item?.path || item?.uri || ""
  );

  if (isMediaCategory(item?.category)) {
    return false;
  }

  if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
    return false;
  }

  if (isImageExtension(fileName) || isVideoExtension(fileName)) {
    return false;
  }

  return true;
};

const getItemDate = (item) => {
  const date = new Date(item?.created_at || item?.createdAt || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getStartOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const getEndOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
};

const formatShortDate = (date) =>
  date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function FilesScreen({ navigation, onOpenMenu }) {
  const {
    viewerProfile,
    mediaItems = [],
    selectedChildId,
    canManageMedia,
    isChildAccount,
    authToken,
    moveMediaToRecycleBin,
  } = useProfile();

  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState("");
  const [isGridView, setIsGridView] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isDateReversed, setIsDateReversed] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [selectedVideoThumbnailUri, setSelectedVideoThumbnailUri] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setSceneReady(true);
    });
    return () => task.cancel();
  }, []);

  const getAuthenticatedFileSource = useCallback(
    (item) => getMediaSource(item, authToken, getFileUri(item)),
    [authToken]
  );

  const files = useMemo(() => {
    const items = Array.isArray(mediaItems) ? mediaItems : [];
    return (sceneReady ? items : [])
      .filter((item) => isFileUpload(item))
      .filter(
        (item) => {
          if (!isChildAccount || !selectedChildId) {
            return true;
          }

          const itemChildId = getMediaChildId(item);
          return itemChildId !== null && String(itemChildId) === String(selectedChildId);
        }
      )
        .filter((item) => {
          const itemDate = getItemDate(item);
          const isAfterStart = startDate ? itemDate >= getStartOfDay(startDate) : true;
          const isBeforeEnd = endDate ? itemDate <= getEndOfDay(endDate) : true;
          return isAfterStart && isBeforeEnd;
        })
        .filter((item) =>
          (item.original_file_name || item.stored_file_name || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        )
        .sort((firstItem, secondItem) =>
          isDateReversed
            ? getItemDate(firstItem) - getItemDate(secondItem)
            : getItemDate(secondItem) - getItemDate(firstItem)
        );
  }, [endDate, isChildAccount, mediaItems, sceneReady, searchQuery, selectedChildId, startDate, isDateReversed]);

  const hasActiveFilters = Boolean(startDate || endDate || isDateReversed);

  const handleDateChange = useCallback((_, selectedDate) => {
    if (Platform.OS === "android") {
      setDatePickerTarget(null);
    }

    if (!selectedDate || !datePickerTarget) {
      return;
    }

    if (datePickerTarget === "start") {
      setStartDate(selectedDate);
      if (endDate && selectedDate > endDate) {
        setEndDate(selectedDate);
      }
    } else {
      setEndDate(selectedDate);
      if (startDate && selectedDate < startDate) {
        setStartDate(selectedDate);
      }
    }
  }, [datePickerTarget, endDate, startDate]);

  const clearFilters = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
    setDatePickerTarget(null);
    setIsDateReversed(false);
  }, []);

  const getFileTitle = useCallback(
    (item) => item?.original_file_name || item?.stored_file_name || "Document",
    []
  );

  const handleShareFile = useCallback(async (item) => {
    const fileUri = getFileUri(item);

    if (!fileUri) {
      Alert.alert("Share unavailable", "This file link is missing.");
      return;
    }

    try {
      await Share.share({
        title: getFileTitle(item),
        message: fileUri,
        url: Platform.OS === "ios" ? fileUri : undefined,
      });
    } catch {
      Alert.alert("Share unavailable", "This file could not be shared right now.");
    }
  }, [getFileTitle]);

  const confirmDeleteFile = useCallback((item) => {
    if (!canManageMedia) {
      return;
    }

    Alert.alert("Move to Recycle Bin", "This file will be moved to Recycle Bin.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Move",
        style: "destructive",
        onPress: () => moveMediaToRecycleBin(item),
      },
    ]);
  }, [canManageMedia, moveMediaToRecycleBin]);

  const showFileActions = useCallback((item) => {
    const actions = [
      { text: "Share", onPress: () => handleShareFile(item) },
      { text: "Cancel", style: "cancel" },
    ];

    if (canManageMedia) {
      actions.splice(1, 0, {
        text: "Delete",
        style: "destructive",
        onPress: () => confirmDeleteFile(item),
      });
    }

    Alert.alert(getFileTitle(item), "File actions", actions);
  }, [canManageMedia, confirmDeleteFile, getFileTitle, handleShareFile]);

  const openExternalFile = useCallback(async (item) => {
    const fileUri = getFileUri(item);

    if (!fileUri) {
      Alert.alert("Open unavailable", "This file link is missing.");
      return;
    }

    try {
      await Linking.openURL(fileUri);
    } catch {
      Alert.alert("Open unavailable", "This file cannot be opened on this device.");
    }
  }, []);

  const openFileDirectly = useCallback(async (item) => {
    const openCategory = getFileOpenCategory(item);

    if (openCategory === "image") {
      setSelectedImageFile(item);
      return;
    }

    if (openCategory === "video") {
      setSelectedVideoFile(item);
      setSelectedVideoThumbnailUri(null);
      const thumbnailUri = await getOrCreateVideoThumbnailUri(item, getFileUri(item));
      setSelectedVideoThumbnailUri(thumbnailUri);
      return;
    }

    if (openCategory === "pdf" || openCategory === "txt") {
      setSelectedFile(item);
      return;
    }

    await openExternalFile(item);
  }, [openExternalFile]);

  const renderFileItem = useCallback(
    ({ item }) => {
      const fileName = item.original_file_name || item.stored_file_name || "Document";
      const contentType = getContentType(item);
      const isImage = contentType.startsWith("image/") || isImageExtension(fileName);
      const isVideo = contentType.startsWith("video/") || isVideoExtension(fileName);

      return (
        <TouchableOpacity
          style={[styles.fileGridCard, softShadow, { backgroundColor: theme.card }]}
          onPress={() => openFileDirectly(item)}
          onLongPress={() => showFileActions(item)}
          activeOpacity={0.86}
        >
          <View style={styles.cardPreview}>
            {isImage ? (
              <CachedImage source={getAuthenticatedFileSource(item)} style={styles.previewContent} resizeMode="cover" />
            ) : isVideo ? (
              <VideoThumbnail item={item} style={styles.previewContent} small />
            ) : (
              <View style={[styles.iconLarge, { backgroundColor: getFileTone(fileName, contentType).bg }]}>
                <Ionicons
                  name={getFileTone(fileName, contentType).icon}
                  size={42}
                  color={getFileTone(fileName, contentType).color}
                />
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
              {getFriendlyTitle(item, "File")}
            </Text>
            <Text style={[styles.fileMeta, { color: theme.subText }]} numberOfLines={1}>
              {getReadableSize(item)} • {formatShortDate(getItemDate(item))}
            </Text>
          </View>
      </TouchableOpacity>
    );
    }, [getAuthenticatedFileSource, openFileDirectly, showFileActions, theme]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Files"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
            <ThemedAvatar uri={viewerProfile?.image} name={viewerProfile?.name} style={styles.avatar} />
          </TouchableOpacity>
        }
      />

      <SearchFilterBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onClear={() => setSearchQuery("")}
        onFilterPress={() => setFilterVisible(true)}
        placeholder="Search files..."
        active={hasActiveFilters}
      />

      <FlashList
        data={files}
        keyExtractor={getFileItemKey}
        key={isGridView ? "files-grid" : "files-list"}
        numColumns={isGridView ? 3 : 1}
        columnWrapperStyle={isGridView ? styles.gridRow : null}
        contentContainerStyle={styles.listContent}
        estimatedItemSize={160}
        removeClippedSubviews
        renderItem={renderFileItem}
        ListEmptyComponent={
          !sceneReady ? null :
          <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No files available</Text>
            <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
              This tab will show document uploads once your backend exposes them.
            </Text>
          </View>
        }
      />

      <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.filterOverlay}>
          <TouchableOpacity style={styles.filterScrim} activeOpacity={1} onPress={() => setFilterVisible(false)} />
          <View style={[styles.filterPanel, { backgroundColor: theme.surface }]}>
            <View style={styles.filterHeader}>
              <Text style={[styles.filterTitle, { color: theme.text }]}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)} style={styles.iconButton}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.filterLabel, { color: theme.subText }]}>Date range</Text>
            <View style={styles.dateRangeRow}>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setDatePickerTarget("start")}
              >
                <Ionicons name="calendar-outline" size={17} color={theme.primary} />
                <Text style={[styles.dateButtonText, { color: theme.text }]} numberOfLines={1}>
                  {startDate ? formatShortDate(startDate) : "Start date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setDatePickerTarget("end")}
              >
                <Ionicons name="calendar" size={17} color={theme.primary} />
                <Text style={[styles.dateButtonText, { color: theme.text }]} numberOfLines={1}>
                  {endDate ? formatShortDate(endDate) : "End date"}
                </Text>
              </TouchableOpacity>
            </View>

            {datePickerTarget ? (
              <DateTimePicker
                value={datePickerTarget === "start" ? startDate || new Date() : endDate || startDate || new Date()}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            ) : null}

            <Text style={[styles.filterLabel, { color: theme.subText }]}>Sort Order</Text>
            <View style={[styles.segmentedControl, { backgroundColor: theme.card }]}>
              <TouchableOpacity
                style={[styles.segmentButton, !isDateReversed && { backgroundColor: theme.primary }]}
                onPress={() => setIsDateReversed(false)}
              >
                <Ionicons name="arrow-down" size={16} color={!isDateReversed ? theme.buttonText : theme.subText} />
                <Text style={[styles.segmentText, { color: !isDateReversed ? theme.buttonText : theme.subText }]}>Newest</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, isDateReversed && { backgroundColor: theme.primary }]}
                onPress={() => setIsDateReversed(true)}
              >
                <Ionicons name="arrow-up" size={16} color={isDateReversed ? theme.buttonText : theme.subText} />
                <Text style={[styles.segmentText, { color: isDateReversed ? theme.buttonText : theme.subText }]}>Oldest</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={[styles.clearButton, { borderColor: theme.border }]} onPress={clearFilters}>
                <Text style={[styles.clearButtonText, { color: theme.text }]}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.applyButton, { backgroundColor: theme.primary }]} onPress={() => setFilterVisible(false)}>
                <Text style={[styles.applyButtonText, { color: theme.buttonText }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FileViewer
        file={selectedFile}
        visible={Boolean(selectedFile)}
        onClose={() => setSelectedFile(null)}
        onDelete={canManageMedia ? moveMediaToRecycleBin : null}
        getFileUri={getFileUri}
        getFileTitle={getFileTitle}
      />

      <ImageViewer
        images={selectedImageFile ? [selectedImageFile] : []}
        initialIndex={0}
        visible={Boolean(selectedImageFile)}
        onClose={() => setSelectedImageFile(null)}
        onDelete={canManageMedia ? moveMediaToRecycleBin : null}
        getImageUri={getFileUri}
        getImageSource={getAuthenticatedFileSource}
        getImageTitle={getFileTitle}
      />

      <VideoFullScreenViewer
        visible={Boolean(selectedVideoFile)}
        sourceUri={selectedVideoFile ? getFileUri(selectedVideoFile) : null}
        thumbnailUri={selectedVideoThumbnailUri}
        canDelete={canManageMedia}
        onClose={() => {
          setSelectedVideoFile(null);
          setSelectedVideoThumbnailUri(null);
        }}
        onDelete={() => {
          if (selectedVideoFile) {
            confirmDeleteFile(selectedVideoFile);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginBottom: 10,
    paddingTop: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  input: {
    marginLeft: 8,
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    paddingTop: 8,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    marginLeft: 4,
  },
  recentScroll: {
    paddingLeft: 4,
    gap: 12,
  },
  recentCard: {
    width: moderateScale(110),
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  recentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  recentName: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  allFilesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  fileCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  fileGridCard: {
    flex: 1,
    margin: 4,
    borderRadius: moderateScale(16),
    overflow: "hidden",
  },
  cardPreview: {
    height: moderateScale(100),
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  previewContent: {
    width: "100%",
    height: "100%",
  },
  iconLarge: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    padding: 8,
  },
  fileName: {
    fontSize: 12,
    fontWeight: "700",
  },
  fileMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "500",
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginTop: 24,
  },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 18,
    color: "#111827",
  },
  emptySubtitle: {
    marginTop: 8,
    color: "#6B7280",
    textAlign: "center",
  },
  filterOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  filterScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  filterPanel: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dateRangeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  dateButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "800",
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
  },
  clearButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    fontWeight: "800",
  },
  applyButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    fontWeight: "800",
  },
});
