import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  useWindowDimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import ImageViewer from "../../components/media/ImageViewer";
import VideoPlayer from "../../components/media/VideoPlayer"; // Assuming this path based on VideosScreen.js
import VideoThumbnail from "../../components/media/VideoThumbnail";
import ZoomableMedia from "../../components/media/ZoomableMedia";
import {
  FadeInView,
  FileChip,
  ImageTile,
  MediaBadge,
  PlayButton,
  SearchFilterBar,
  formatDuration,
  getFriendlyTitle,
  getReadableSize,
  sharedStyles,
  softShadow,
  ui,
} from "../../components/media/MediaDesign";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { getMediaUri, getVideoThumbnailUri } from "../../utils/media";

const GRID_COLUMNS = 3;
const GRID_GAP = 10;

const getNormalizedCategory = (item) => {
  if (item?.category === "images" || item?.content_type?.startsWith("image/")) {
    return "images";
  }
  if (item?.category === "videos" || item?.content_type?.startsWith("video/")) {
    return "videos";
  }
  return "files";
};

const getMediaItemKey = (item, index, scope = "media") => {
  const stablePart =
    item?.id ??
    item?.file_path ??
    item?.previewUri ??
    item?.stored_file_name ??
    item?.original_file_name ??
    "item";

  return `${scope}-${stablePart}-${index}`;
};

const getMediaItemId = (item) =>
  item?.id ??
  item?.file_path ??
  item?.previewUri ??
  item?.stored_file_name ??
  item?.original_file_name;

const getMediaChildId = (item) =>
  item?.child_id ??
  item?.childId ??
  item?.child_profile_id ??
  item?.childProfileId ??
  null;

const getMediaGroupKey = (group, index) => `group-${group.title}-${index}`;

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

const isSameDay = (firstDate, secondDate) =>
  firstDate.getFullYear() === secondDate.getFullYear() &&
  firstDate.getMonth() === secondDate.getMonth() &&
  firstDate.getDate() === secondDate.getDate();

const formatGroupTitle = (date) => {
  const today = getStartOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatShortDate = (date) =>
  date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function GalleryScreen({ navigation, onOpenMenu }) {
  const {
    viewerProfile,
    mediaItems,
    selectedChildId,
    selectedChild,
    canManageMedia,
    isChildAccount,
    loadChildMedia,
    moveMediaToRecycleBin,
  } = useProfile();
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isGridView, setIsGridView] = useState(true);
  const [mediaType, setMediaType] = useState("all");
  const [isDateReversed, setIsDateReversed] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [currentVideoUri, setCurrentVideoUri] = useState(null);
  const [currentVideoThumbnailUri, setCurrentVideoThumbnailUri] = useState(null);
  const [hasVideoFirstFrame, setHasVideoFirstFrame] = useState(false);
  const [showVideoCover, setShowVideoCover] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState("");
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    setSceneReady(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setSceneReady(true);
    });

    return () => task.cancel();
  }, []);

  const scopedMediaItems = useMemo(() => {
    const sourceMediaItems = sceneReady ? mediaItems : [];

    if (!isChildAccount || !selectedChildId) {
      return sourceMediaItems;
    }

    return sourceMediaItems.filter((item) => {
      const itemChildId = getMediaChildId(item);
      return itemChildId !== null && String(itemChildId) === String(selectedChildId);
    });
  }, [isChildAccount, mediaItems, sceneReady, selectedChildId]);

  const filteredMediaItems = useMemo(
    () =>
      scopedMediaItems
        .filter((item) => {
          const itemDate = getItemDate(item);
          const isAfterStart = startDate ? itemDate >= getStartOfDay(startDate) : true;
          const isBeforeEnd = endDate ? itemDate <= getEndOfDay(endDate) : true;
          return isAfterStart && isBeforeEnd;
        })
        .filter((item) => {
          if (mediaType === "all") return true;
          return getNormalizedCategory(item) === mediaType;
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
        ),
    [endDate, mediaType, scopedMediaItems, searchQuery, startDate, isDateReversed]
  );

  const groupedMedia = useMemo(() => {
    const groups = {};

    filteredMediaItems.forEach((item) => {
      const itemDate = getItemDate(item);
      const key = formatGroupTitle(itemDate);
      if (!groups[key]) {
        groups[key] = {
          date: itemDate,
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    const grouped = Object.entries(groups).map(([key, group]) => {
      const items = [...group.items].sort((firstItem, secondItem) =>
        isDateReversed
          ? getItemDate(firstItem) - getItemDate(secondItem)
          : getItemDate(secondItem) - getItemDate(firstItem)
      );

      return {
        title: key,
        date: group.date,
        items,
      };
    });

    return grouped.sort((firstGroup, secondGroup) =>
      isDateReversed
        ? firstGroup.date - secondGroup.date
        : secondGroup.date - firstGroup.date
    );
  }, [filteredMediaItems, isDateReversed]);

  const stats = useMemo(() => {
    const images = filteredMediaItems.filter((item) => getNormalizedCategory(item) === "images").length;
    const videos = filteredMediaItems.filter((item) => getNormalizedCategory(item) === "videos").length;
    const files = filteredMediaItems.filter((item) => getNormalizedCategory(item) === "files").length;
    return { images, videos, files };
  }, [filteredMediaItems]);

  const highlightItems = useMemo(
    () =>
      filteredMediaItems
        .filter((item) => getNormalizedCategory(item) === "images")
        .slice(0, 8),
    [filteredMediaItems]
  );

  const imageItems = useMemo(
    () => filteredMediaItems.filter((item) => getNormalizedCategory(item) === "images"),
    [filteredMediaItems]
  );

  const mediaTileSize = useMemo(
    () =>
      (windowWidth -
        SCREEN_HORIZONTAL_PADDING * 2 -
        GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [windowWidth]
  );

  const hasActiveFilters = Boolean(startDate || endDate || !isGridView || isDateReversed);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const hydrateMedia = () =>
        InteractionManager.runAfterInteractions(async () => {
          if (!isActive) {
            return;
          }

          setIsMediaLoading(true);
          setMediaLoadError("");

          try {
            await loadChildMedia(isChildAccount ? selectedChildId : null);
          } catch (error) {
            if (isActive) {
              setMediaLoadError(error.message || "Unable to load media right now.");
            }
          } finally {
            if (isActive) {
              setIsMediaLoading(false);
            }
          }
        });

      const task = hydrateMedia();

      return () => {
        isActive = false;
        task?.cancel?.();
      };
    }, [isChildAccount, loadChildMedia, selectedChildId])
  );

  const openViewer = (item) => {
    const itemId = getMediaItemId(item);
    const index = imageItems.findIndex((currentItem) => getMediaItemId(currentItem) === itemId);
    setViewerIndex(index >= 0 ? index : 0);
    setViewerVisible(true);
  };

  const openVideoViewer = (item) => {
    setHasVideoFirstFrame(false);
    setShowVideoCover(true);
    setCurrentVideoThumbnailUri(getVideoThumbnailUri(item));
    setCurrentVideoUri(getMediaUri(item));
    setVideoViewerVisible(true);
  };

  const closeVideoViewer = useCallback(() => {
    setVideoViewerVisible(false);
    setCurrentVideoUri(null);
    setCurrentVideoThumbnailUri(null);
    setHasVideoFirstFrame(false);
    setShowVideoCover(false);
  }, []);

  const deleteCurrentVideo = () => {
    const currentVideo = filteredMediaItems.find(
      (item) => getMediaUri(item) === currentVideoUri
    );

    if (!currentVideo || !canManageMedia) {
      return;
    }

    Alert.alert("Move to Recycle Bin", "This video will be moved to Recycle Bin.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Move",
        style: "destructive",
        onPress: () => {
          moveMediaToRecycleBin(currentVideo);
          closeVideoViewer();
        },
      },
    ]);
  };

  const handleDateChange = (_, selectedDate) => {
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
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setDatePickerTarget(null);
    setIsDateReversed(false);
    setMediaType("all");
  };

  useFocusEffect(
    useCallback(() => {
      const backSubscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (viewerVisible) {
            setViewerVisible(false);
            return true;
          }

          if (videoViewerVisible) {
            closeVideoViewer();
            return true;
          }

          navigation.reset({
            index: 0,
            routes: [{ name: "AuthProfile" }],
          });
          return true;
        }
      );

      return () => backSubscription.remove();
    }, [closeVideoViewer, navigation, videoViewerVisible, viewerVisible])
  );

  useEffect(() => {
    if (!videoViewerVisible || !currentVideoUri) {
      return undefined;
    }

    const coverTimer = setTimeout(() => {
      setShowVideoCover(false);
    }, 900);

    return () => clearTimeout(coverTimer);
  }, [currentVideoUri, videoViewerVisible]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Family Media Hub"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
            <ThemedAvatar uri={viewerProfile.image} name={viewerProfile.name} style={styles.avatar} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={groupedMedia}
        keyExtractor={getMediaGroupKey}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        initialNumToRender={4}
        maxToRenderPerBatch={5}
        windowSize={7}
        ListHeaderComponent={
          <>
            <SearchFilterBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery("")}
              onFilterPress={() => setFilterVisible(true)}
              active={hasActiveFilters}
            />

            {highlightItems.length ? (
              <>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="sparkles" size={13} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Highlights</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate("Images")}>
                    <Ionicons name="chevron-forward" size={17} color={theme.primary} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={highlightItems}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => getMediaItemKey(item, index, "highlight")}
                  contentContainerStyle={styles.highlightsContent}
                  renderItem={({ item }) => (
                    <ImageTile
                      uri={getMediaUri(item)}
                      style={styles.highlightCard}
                      onPress={() => openViewer(item)}
                      title={getFriendlyTitle(item, "Garden Play")}
                      meta={formatShortDate(getItemDate(item)).replace(",", "")}
                    />
                  )}
                />
              </>
            ) : null}

            {/* <View style={styles.statsRow}>
              <StatCard label="Images" value={stats.images} color={theme.primary} theme={theme} />
              <StatCard label="Videos" value={stats.videos} color={theme.accent} theme={theme} />
              <StatCard label="Files" value={stats.files} color={theme.secondary} theme={theme} />
            </View> */}

          </>
        }
        renderItem={({ item: group, index }) => (
          <FadeInView style={styles.group} delay={Math.min(index * 35, 160)}>
            <View style={styles.groupHeader}>
              <View style={styles.groupTitleWrap}>
                <Ionicons name="calendar-outline" size={13} color={theme.primary} />
                <Text style={[styles.groupTitle, { color: theme.text }]}>{group.title}</Text>
                <Text style={[styles.groupDate, { color: theme.subText }]}>
                  {formatShortDate(group.date)}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={theme.primary} />
            </View>
            {isGridView ? (
              <FlatList
                data={group.items}
                keyExtractor={(item, itemIndex) => getMediaItemKey(item, itemIndex, `${group.title}-${index}`)}
                numColumns={GRID_COLUMNS}
                scrollEnabled={false}
                columnWrapperStyle={styles.gridRow}
                renderItem={({ item, index: itemIndex }) => (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={[
                      styles.mediaTile,
                      {
                        width: mediaTileSize,
                        height: mediaTileSize,
                        marginRight:
                          (itemIndex + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
                        marginBottom: GRID_GAP,
                      },
                    ]}
                    onPress={() => {
                      const category = getNormalizedCategory(item);
                      if (category === "images") {
                        openViewer(item);
                      } else if (category === "videos") {
                        openVideoViewer(item);
                      } else if (category === "files") {
                        navigation.navigate("Files");
                      }
                    }}
                  >
                    <View style={styles.mediaTileContent}>
                      {getNormalizedCategory(item) === "images" && (
                        <Image source={{ uri: getMediaUri(item) }} style={styles.mediaPreview} />
                      )}
                      {getNormalizedCategory(item) === "videos" && (
                        <>
                          <VideoThumbnail item={item} style={styles.mediaPreview} />
                          <PlayButton small />
                        </>
                      )}
                      {getNormalizedCategory(item) === "files" && (
                        <FileChip
                          compact={false}
                          name={item.original_file_name || item.stored_file_name || "Document"}
                          type={item.content_type}
                          size={getReadableSize(item)}
                        />
                      )}
                      {getNormalizedCategory(item) !== "files" ? (
                        <MediaBadge icon={getNormalizedCategory(item) === "videos" ? "time-outline" : "image-outline"}>
                          {getNormalizedCategory(item) === "videos"
                            ? formatDuration(item.duration)
                            : ""}
                        </MediaBadge>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.mediaList}>
                {group.items.map((item, itemIndex) => {
                  const category = getNormalizedCategory(item);
                  return (
                    <TouchableOpacity
                      key={getMediaItemKey(item, itemIndex, `${group.title}-${index}-list`)}
                      style={[styles.mediaListItem, { backgroundColor: theme.card }]}
                      activeOpacity={0.88}
                      onPress={() => {
                        if (category === "images") {
                          openViewer(item);
                        } else if (category === "videos") {
                          openVideoViewer(item);
                        } else {
                          navigation.navigate("Files");
                        }
                      }}
                    >
                      <View style={styles.mediaListPreview}>
                        {category === "images" && (
                          <Image source={{ uri: getMediaUri(item) }} style={styles.mediaPreview} />
                        )}
                        {category === "videos" && (
                          <VideoThumbnail item={item} style={styles.mediaPreview} />
                        )}
                        {category === "files" && (
                          <View style={[styles.mediaPreview, styles.mediaFallback]}>
                            <Ionicons name="document-text" size={22} color="#2563EB" />
                          </View>
                        )}
                      </View>
                      <View style={styles.mediaListText}>
                        <Text style={[styles.mediaListTitle, { color: theme.text }]} numberOfLines={1}>
                          {item.original_file_name || item.stored_file_name || "Media"}
                        </Text>
                        <Text style={[styles.mediaListMeta, { color: theme.subText }]}>
                          {category} • {formatShortDate(getItemDate(item))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </FadeInView>
        )}
        ListEmptyComponent={
          !sceneReady || isMediaLoading ? (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Loading your media</Text>
              <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
                Bringing in your latest family photos, videos, and files.
              </Text>
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Ionicons
                name={mediaLoadError ? "alert-circle-outline" : "cloud-upload-outline"}
                size={40}
                color={theme.primary}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {mediaLoadError ? "Unable to load media" : "No uploaded media yet"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
                {mediaLoadError || "Use the Backup tab to upload your first image or video."}
              </Text>
            </View>
          )
        }
      />

      <ImageViewer
        images={imageItems}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        onDelete={canManageMedia ? moveMediaToRecycleBin : null}
        getImageUri={getMediaUri}
        getImageTitle={(item) => item?.original_file_name || item?.stored_file_name || "Image"}
      />

      {/* Video Viewer Modal */}
      <Modal
        visible={videoViewerVisible}
        onRequestClose={closeVideoViewer}
        animationType="none"
      >
        <View style={styles.videoModalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={closeVideoViewer}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {canManageMedia ? (
            <TouchableOpacity style={styles.deleteButton} onPress={deleteCurrentVideo}>
              <Ionicons name="trash" size={22} color="#FCA5A5" />
            </TouchableOpacity>
          ) : null}
          {currentVideoUri ? (
            <>
              <ZoomableMedia
                resetKey={currentVideoUri}
                style={styles.fullScreenVideo}
              >
                <VideoPlayer
                  key={currentVideoUri}
                  source={currentVideoUri}
                  style={styles.fullScreenVideo}
                  contentFit="contain"
                  nativeControls
                  fullscreen={true} // Explicitly enable fullscreen
                  shouldPlay={videoViewerVisible}
                  surfaceType="textureView"
                  posterSource={
                    currentVideoThumbnailUri ? { uri: currentVideoThumbnailUri } : null
                  }
                  onFirstFrameRender={() => {
                    setHasVideoFirstFrame(true);
                    setShowVideoCover(false);
                  }}
                />
              </ZoomableMedia>
              {showVideoCover && !hasVideoFirstFrame && currentVideoThumbnailUri ? (
                <View style={styles.videoLoadingCover} pointerEvents="none">
                  <Image
                    source={{ uri: currentVideoThumbnailUri }}
                    style={styles.fullScreenVideo}
                    resizeMode="contain"
                  />
                  <ActivityIndicator size="large" color="#fff" style={styles.videoLoadingIndicator} />
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </Modal>

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
              <TouchableOpacity style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setDatePickerTarget("start")}>
                <Ionicons name="calendar-outline" size={17} color={theme.primary} />
                <Text style={[styles.dateButtonText, { color: theme.text }]} numberOfLines={1}>
                  {startDate ? formatShortDate(startDate) : "Start date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setDatePickerTarget("end")}>
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

        <Text style={[styles.filterLabel, { color: theme.subText }]}>Media Type</Text>
        <View style={[styles.segmentedControl, { backgroundColor: theme.card }]}>
          {["all", "images", "videos", "files"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.segmentButton, mediaType === type && { backgroundColor: theme.primary }]}
              onPress={() => setMediaType(type)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: mediaType === type ? theme.buttonText : theme.subText, textTransform: "capitalize" },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.filterLabel, { color: theme.subText }]}>Sort Order</Text>
        <View style={[styles.segmentedControl, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            style={[styles.segmentButton, !isDateReversed && { backgroundColor: theme.primary }]}
            onPress={() => setIsDateReversed(false)}
          >
            <Ionicons name="arrow-down" size={16} color={!isDateReversed ? theme.buttonText : theme.subText} />
            <Text style={[styles.segmentText, { color: !isDateReversed ? theme.buttonText : theme.subText }]}>
              Newest
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, isDateReversed && { backgroundColor: theme.primary }]}
            onPress={() => setIsDateReversed(true)}
          >
            <Ionicons name="arrow-up" size={16} color={isDateReversed ? theme.buttonText : theme.subText} />
            <Text style={[styles.segmentText, { color: isDateReversed ? theme.buttonText : theme.subText }]}>
              Oldest
            </Text>
          </TouchableOpacity>
        </View>

            <Text style={[styles.filterLabel, { color: theme.subText }]}>View</Text>
            <View style={[styles.segmentedControl, { backgroundColor: theme.card }]}>
              <TouchableOpacity style={[styles.segmentButton, !isGridView && { backgroundColor: theme.primary }]} onPress={() => setIsGridView(false)}>
                <Ionicons name="list" size={18} color={!isGridView ? theme.buttonText : theme.subText} />
                <Text style={[styles.segmentText, { color: !isGridView ? theme.buttonText : theme.subText }]}>List</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.segmentButton, isGridView && { backgroundColor: theme.primary }]} onPress={() => setIsGridView(true)}>
                <Ionicons name="grid" size={18} color={isGridView ? theme.buttonText : theme.subText} />
                <Text style={[styles.segmentText, { color: isGridView ? theme.buttonText : theme.subText }]}>Grid</Text>
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
    </View>
  );
}

const StatCard = ({ label, value, color, theme }) => (
  <View style={[styles.statCard, { backgroundColor: theme.card }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginTop: 16,
  },
  highlightsContent: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 4,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightCard: {
    width: 72,
    height: 72,
    marginRight: 10,
    borderRadius: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    marginTop: 4,
    color: "#6B7280",
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 8,
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  link: {
    color: "#2563EB",
    fontWeight: "600",
  },
  group: {
    marginBottom: 12,
  },
  groupHeader: {
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  groupTitle: {
    color: ui.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  groupDate: {
    fontSize: 10,
    fontWeight: "700",
  },
  gridRow: {
    justifyContent: "flex-start",
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  mediaTile: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E9E7F5",
  },
  mediaList: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  mediaListItem: {
    minHeight: 82,
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  mediaListPreview: {
    width: 62,
    height: 62,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  mediaListText: {
    flex: 1,
    marginLeft: 12,
  },
  mediaListTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  mediaListMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  mediaPreview: {
    width: "100%",
    height: "100%",
  },
  mediaFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },
  emptyState: {
    backgroundColor: "#fff",
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginTop: 12,
  },
  emptyTitle: {
    marginTop: 12,
    fontWeight: "700",
    fontSize: 18,
    color: "#111827",
  },
  emptySubtitle: {
    marginTop: 8,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  videoModalContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenVideo: {
    width: "100%",
    height: "100%",
  },
  videoLoadingCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    top: 40, // Adjust as needed for safe area
    right: 20,
    zIndex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 2,
  },
  deleteButton: {
    position: "absolute",
    top: 42,
    left: 20,
    zIndex: 1,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTileContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
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
