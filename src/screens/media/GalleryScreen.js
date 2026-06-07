import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { FlashList } from "@shopify/flash-list";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import CachedImage from "../../components/media/CachedImage";
import ImageViewer from "../../components/media/ImageViewer";
import VideoThumbnail from "../../components/media/VideoThumbnail";
import {
  FadeInView,
  FileChip,
  ImageTile,
  MediaBadge,
  PlayButton,
  SearchFilterBar,
  getFileTone,
  formatDuration,
  getFriendlyTitle,
  getReadableSize,
  sharedStyles,
  softShadow,
  ui,
} from "../../components/media/MediaDesign";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { borderRadius, layout, spacing, typography } from "../../theme/designSystem";
import { moderateScale } from "../../theme/responsive";
import { getMediaSource, getMediaUri } from "../../utils/media";
import { getOrCreateVideoThumbnailUri } from "../../utils/videoThumbnails";

const GRID_COLUMNS = 3;
const GRID_GAP = 10;

const getNormalizedCategory = (item) => {
  const cat = String(item?.category || "").toLowerCase();
  const mime = String(item?.content_type || "").toLowerCase();

  if (cat === "images" || cat === "image" || mime.startsWith("image/")) {
    return "images";
  }
  if (cat === "videos" || cat === "video" || mime.startsWith("video/")) {
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

const getMediaItemIdentity = (item) => {
  const uri = getMediaUri(item);
  const id = getMediaItemId(item);
  const fallback =
    item?.original_file_name ||
    item?.stored_file_name ||
    item?.file_path ||
    item?.uri ||
    item?.local_uri ||
    item?.localUri ||
    "unknown-media-item";

  return String(id || uri || fallback);
};

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
    authToken,
    loadChildMedia,
    moveMediaToRecycleBin,
  } = useProfile();
  const renderCounter = useRef(0);
  renderCounter.current += 1;

  useEffect(() => {
    console.log("[Perf] GalleryScreen mount", {
      renderCount: renderCounter.current,
      mediaItemsCount: mediaItems.length,
      selectedChildId,
    });
    return () => console.log("[Perf] GalleryScreen unmount");
  }, []);
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

  const filteredMediaItems = useMemo(() => {
    const result = scopedMediaItems
      .filter((item) => {
        if (!item) return false;
        const itemDate = getItemDate(item);
        const isAfterStart = startDate ? itemDate >= getStartOfDay(startDate) : true;
        const isBeforeEnd = endDate ? itemDate <= getEndOfDay(endDate) : true;
        return isAfterStart && isBeforeEnd;
      })
      .filter((item) => {
        if (mediaType === "all") return true;
        return getNormalizedCategory(item) === mediaType;
      })
      .filter((item) => {
        const name = item?.original_file_name || item?.stored_file_name || "";
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((firstItem, secondItem) =>
        isDateReversed
          ? getItemDate(firstItem) - getItemDate(secondItem)
          : getItemDate(secondItem) - getItemDate(firstItem)
      );
    return result;
  }, [endDate, mediaType, scopedMediaItems, searchQuery, startDate, isDateReversed]);

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

    const result = grouped.sort((firstGroup, secondGroup) =>
      isDateReversed
        ? firstGroup.date - secondGroup.date
        : secondGroup.date - firstGroup.date
    );
    return result;
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

  const imageItemIndexMap = useMemo(() => {
    const refMap = new Map();
    const identityMap = new Map();

    imageItems.forEach((item, index) => {
      refMap.set(item, index);
      const key = getMediaItemIdentity(item);
      if (!identityMap.has(key)) {
        identityMap.set(key, index);
      }
    });

    return { refMap, identityMap };
  }, [imageItems]);

  const getAuthenticatedMediaSource = useCallback(
    (item) => getMediaSource(item, authToken),
    [authToken]
  );

  const mediaTileSize = useMemo(
    () =>
      (windowWidth -
        layout.screenPadding * 2 -
        GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [windowWidth]
  );

  const galleryListItems = useMemo(() => {
    const items = [];

    groupedMedia.forEach((group) => {
      items.push({
        type: "header",
        key: `group-header-${group.title}`,
        title: group.title,
        date: group.date,
        count: group.items.length,
      });

      for (let rowIndex = 0; rowIndex < group.items.length; rowIndex += GRID_COLUMNS) {
        const rowItems = group.items.slice(rowIndex, rowIndex + GRID_COLUMNS).map((mediaItem) => ({
          mediaItem,
          imageIndex:
            getNormalizedCategory(mediaItem) === "images"
              ? imageItemIndexMap.identityMap.get(getMediaItemIdentity(mediaItem))
              : undefined,
        }));

        items.push({
          type: "mediaRow",
          key: `group-row-${group.title}-${rowIndex}`,
          items: rowItems,
        });
      }
    });

    return items;
  }, [groupedMedia, imageItemIndexMap]);

  const openViewer = useCallback(
    (item, selectedIndex) => {
      let index = selectedIndex;

      if (index === undefined || index === null || index < 0) {
        index = imageItemIndexMap.refMap.get(item);
      }

      if (index === undefined || index === null || index < 0) {
        const itemKey = getMediaItemIdentity(item);
        index = imageItemIndexMap.identityMap.get(itemKey);
      }

      if (index === undefined || index === null || index < 0) {
        const targetUri = getMediaUri(item);
        index = imageItems.findIndex((currentItem) => {
          if (currentItem === item) {
            return true;
          }

          try {
            if (targetUri && getMediaUri(currentItem) === targetUri) {
              return true;
            }
          } catch (e) {
            // ignore
          }

          const currentId = getMediaItemId(currentItem);
          const itemId = getMediaItemId(item);
          return currentId && itemId && String(currentId) === String(itemId);
        });
      }

      setViewerIndex(index >= 0 ? index : 0);
      setViewerVisible(true);
    },
    [imageItems, imageItemIndexMap]
  );

  const openVideoViewer = useCallback((item) => {
    const videos = filteredMediaItems.filter(i => getNormalizedCategory(i) === "videos");
    const itemId = getMediaItemId(item);
    console.log("VIDEO ITEM:", item);
    const index = videos.findIndex(v => getMediaItemId(v) === itemId);
    navigation.navigate("FullScreenVideo", {
      mediaItems: videos,
      initialIndex: index >= 0 ? index : 0,
    });
  }, [filteredMediaItems, navigation]);

  const handleMediaPress = useCallback(
    (item, selectedIndex) => {
      const category = getNormalizedCategory(item);
      if (category === "images") {
        openViewer(item, selectedIndex);
      } else if (category === "videos") {
        openVideoViewer(item);
      } else {
        navigation.setParams({ mediaTab: "Files" });
      }
    },
    [navigation, openViewer, openVideoViewer]
  );

  const renderGalleryItem = useCallback(
    ({ item }) => {
      if (item.type === "header") {
        return (
          <FadeInView style={styles.group} delay={0}>
            <View style={styles.groupHeader}>
              <View style={styles.groupTitleWrap}>
                <Ionicons name="calendar-outline" size={13} color={theme.primary} />
                <Text style={[styles.groupTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.groupDate, { color: theme.subText }]}>
                  {formatShortDate(item.date)}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={theme.primary} />
            </View>
          </FadeInView>
        );
      }

      return (
        <View style={[styles.gridRow, { marginBottom: GRID_GAP }]}>
          {item.items.map(({ mediaItem, imageIndex }, index) => {
            const isLastItem = index === item.items.length - 1;
            const category = getNormalizedCategory(mediaItem);
            const isFile = category === "files";
            const fileName = mediaItem.original_file_name || mediaItem.stored_file_name || "Document";

            return (
              <TouchableOpacity
                key={getMediaItemKey(mediaItem, imageIndex ?? index, item.key)}
                activeOpacity={0.88}
                style={[
                  isFile ? styles.fileCard : styles.mediaTile,
                  {
                    width: mediaTileSize,
                    height: mediaTileSize,
                    marginRight: isLastItem ? 0 : GRID_GAP,
                    backgroundColor: theme.card,
                  },
                ]}
                onPress={() => handleMediaPress(mediaItem, imageIndex)}
              >
                {isFile ? (
                  <>
                    <View style={styles.cardPreview}>
                      <View style={[styles.iconLarge, { backgroundColor: getFileTone(fileName, mediaItem.content_type).bg }]}>
                        <Ionicons
                          name={getFileTone(fileName, mediaItem.content_type).icon}
                          size={moderateScale(32)}
                          color={getFileTone(fileName, mediaItem.content_type).color}
                        />
                      </View>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                        {getFriendlyTitle(mediaItem, "File")}
                      </Text>
                      <Text style={[styles.fileMeta, { color: theme.subText }]} numberOfLines={1}>
                        {getReadableSize(mediaItem)} • {formatShortDate(getItemDate(mediaItem))}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.mediaTileContent}>
                    {category === "images" && (
                      <CachedImage source={getAuthenticatedMediaSource(mediaItem)} style={styles.mediaPreview} />
                    )}
                    {category === "videos" && (
                      <VideoThumbnail item={mediaItem} style={styles.mediaPreview} small showDuration />
                    )}
                    {category === "images" ? (
                      <MediaBadge icon="image-outline" />
                    ) : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    },
    [getAuthenticatedMediaSource, handleMediaPress, mediaTileSize, theme]
  );

  const getGalleryListKey = useCallback((item) => item.key, []);

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

          Alert.alert("Exit App", "Are you sure you want to exit Family Media Hub?", [
            { text: "Cancel", style: "cancel", onPress: () => {} },
            { text: "Exit", onPress: () => BackHandler.exitApp() },
          ]);
          return true;
        }
      );

      return () => backSubscription.remove();
    }, [navigation, viewerVisible])
  );

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

      <FlashList
        data={galleryListItems}
        keyExtractor={getGalleryListKey}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        initialNumToRender={4}
        maxToRenderPerBatch={5}
        windowSize={7}
        estimatedItemSize={180}
        removeClippedSubviews
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
                  <TouchableOpacity onPress={() => navigation.setParams({ mediaTab: "Images" })}>
                    <Ionicons name="chevron-forward" size={17} color={theme.primary} />
                  </TouchableOpacity>
                </View>

                <FlashList
                  data={highlightItems}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => getMediaItemKey(item, index, "highlight")}
                  contentContainerStyle={styles.highlightsContent}
                  estimatedItemSize={96}
                  renderItem={({ item }) => (
                    <ImageTile
                      uri={getMediaUri(item)}
                      source={getAuthenticatedMediaSource(item)}
                      style={styles.highlightCard}
                      onPress={() => openViewer(item, imageItemIndexMap.identityMap.get(getMediaItemIdentity(item)))}
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
        renderItem={renderGalleryItem}

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
        getImageSource={getAuthenticatedMediaSource}
        getImageTitle={(item) => item?.original_file_name || item?.stored_file_name || "Image"}
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
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.lg,
  },
  highlightsContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xs,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
  },
  searchBox: {
    flex: 1,
    minHeight: moderateScale(46),
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  filterButton: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightCard: {
    width: moderateScale(72),
    height: moderateScale(72),
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.heading,
    fontWeight: "700",
  },
  statLabel: {
    marginTop: spacing.xs,
    color: "#6B7280",
  },
  sectionHeader: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    marginHorizontal: layout.screenPadding,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: typography.label,
    fontWeight: "800",
    color: "#111827",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  link: {
    color: "#2563EB",
    fontWeight: "600",
  },
  group: {
    marginBottom: spacing.md,
  },
  groupHeader: {
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  groupTitle: {
    color: ui.ink,
    fontSize: typography.label,
    fontWeight: "800",
  },
  groupDate: {
    fontSize: typography.caption,
    fontWeight: "700",
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: layout.screenPadding,
  },
  mediaTile: {
    borderRadius: borderRadius.sm,
    overflow: "hidden",
    backgroundColor: "#E9E7F5",
  },
  fileCard: {
    borderRadius: moderateScale(12),
    overflow: "hidden",
    ...softShadow,
  },
  cardPreview: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    padding: moderateScale(6),
  },
  fileName: {
    fontSize: moderateScale(10),
    fontWeight: "700",
  },
  fileMeta: {
    marginTop: 2,
    fontSize: moderateScale(8),
    fontWeight: "500",
  },
  iconLarge: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaList: {
    paddingHorizontal: layout.screenPadding,
  },
  mediaListItem: {
    minHeight: moderateScale(82),
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  mediaListPreview: {
    width: moderateScale(62),
    height: moderateScale(62),
    borderRadius: borderRadius.md,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  mediaListText: {
    flex: 1,
    marginLeft: spacing.md,
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
    marginHorizontal: layout.screenPadding,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  emptyTitle: {
    marginTop: spacing.sm,
    fontWeight: "700",
    fontSize: typography.title,
    color: "#111827",
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: typography.body * 1.25,
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
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  filterTitle: {
    fontSize: typography.title,
    fontWeight: "800",
  },
  iconButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: {
    marginBottom: spacing.xs,
    fontSize: typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dateRangeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dateButton: {
    flex: 1,
    minHeight: moderateScale(46),
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dateButtonText: {
    flex: 1,
    fontSize: typography.label,
    fontWeight: "700",
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  segmentButton: {
    flex: 1,
    minHeight: moderateScale(42),
    borderRadius: borderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  segmentText: {
    fontSize: typography.label,
    fontWeight: "800",
  },
  filterActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  clearButton: {
    flex: 1,
    minHeight: moderateScale(46),
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    fontWeight: "800",
  },
  applyButton: {
    flex: 1,
    minHeight: moderateScale(46),
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    fontWeight: "800",
  },
});
