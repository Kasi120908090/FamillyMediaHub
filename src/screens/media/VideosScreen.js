import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  InteractionManager,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import VideoThumbnail from "../../components/media/VideoThumbnail";
import {
  FadeInView,
  SearchFilterBar,
  getFriendlyTitle,
  softShadow,
  ui,
} from "../../components/media/MediaDesign";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

const getVideoItemKey = (item, index) => {
  const stablePart =
    item?.id ??
    item?.file_path ??
    item?.previewUri ??
    item?.stored_file_name ??
    item?.original_file_name ??
    "video";

  return `video-${stablePart}-${index}`;
};

const getVideoSectionKey = (section, index) => `video-section-${section.title}-${index}`;

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

const formatSectionTitle = (date) => {
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

const getMediaChildId = (item) =>
  item?.child_id ??
  item?.childId ??
  item?.child_profile_id ??
  item?.childProfileId ??
  null;

export default function VideosScreen({ navigation, onOpenMenu }) {
  const {
    viewerProfile,
    mediaItems = [],
    selectedChildId,
    isChildAccount,
  } = useProfile();

  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isGridView, setIsGridView] = useState(true);
  const [isDateReversed, setIsDateReversed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setSceneReady(true);
    });
    return () => task.cancel();
  }, []);

  const videos = useMemo(() => {
    const items = Array.isArray(mediaItems) ? mediaItems : [];
    return (sceneReady ? items : [])
      .filter(
        (item) => {
          if (!isChildAccount || !selectedChildId) {
            return true;
          }

          const itemChildId = getMediaChildId(item);
          return itemChildId !== null && String(itemChildId) === String(selectedChildId);
        }
      )
        .filter(
          (item) => item.category === "videos" || item.content_type?.startsWith("video/")
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

  const groupedVideos = useMemo(() => {
    const groups = {};

    videos.forEach((item) => {
      const itemDate = getItemDate(item);
      const groupTitle = formatSectionTitle(itemDate);

      if (!groups[groupTitle]) {
        groups[groupTitle] = {
          title: groupTitle,
          date: itemDate,
          data: [],
        };
      }

      groups[groupTitle].data.push(item);
    });

    const grouped = Object.values(groups).map((group) => ({
      ...group,
      data: [...group.data].sort((firstItem, secondItem) =>
        isDateReversed
          ? getItemDate(firstItem) - getItemDate(secondItem)
          : getItemDate(secondItem) - getItemDate(firstItem)
      ),
    }));

    return grouped.sort((firstGroup, secondGroup) =>
      isDateReversed
        ? firstGroup.date - secondGroup.date
        : secondGroup.date - firstGroup.date
    );
  }, [videos, isDateReversed]);

  const hasActiveFilters = Boolean(startDate || endDate || isGridView || isDateReversed);

  const openVideo = useCallback((item) => {
    const index = videos.findIndex((v) => v.id === item.id);
    navigation.navigate("FullScreenVideo", {
      mediaItems: videos,
      initialIndex: index >= 0 ? index : 0,
    });
  }, [navigation, videos]);

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

  const renderVideoCard = useCallback(
    (item, index, sectionTitle) => {
      if (isGridView) {
        return (
          <TouchableOpacity
          key={getVideoItemKey(item, index)}
          style={[
            styles.gridCard,
            (index + 1) % 3 !== 0 && styles.gridCardGap,
            { backgroundColor: theme.card },
          ]}
          onPress={() => openVideo(item)}
          activeOpacity={0.88}
        >
          <View style={styles.gridPreviewWrap}>
            <VideoThumbnail item={item} style={styles.gridPreview} small showDuration />
          </View>
          <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={1}>
            {getFriendlyTitle(item, "Video")}
          </Text>
          <Text style={[styles.videoMeta, { color: theme.subText }]} numberOfLines={1}>
            {sectionTitle}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={getVideoItemKey(item, index)}
        style={[styles.videoCard, softShadow, { backgroundColor: theme.card }]}
        onPress={() => openVideo(item)}
        activeOpacity={0.88}
      >
        <View style={styles.videoPreviewWrap}>
          <VideoThumbnail item={item} style={styles.videoPreview} showDuration />
        </View>
        <View style={styles.videoText}>
          <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={1}>
            {getFriendlyTitle(item, "Video")}
          </Text>
          <Text style={[styles.videoMeta, { color: theme.subText }]}>
            {item.content_type || "video"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [isGridView, openVideo, theme]);

  const renderVideoSection = useCallback(
    ({ item: section, index }) => (
    <FadeInView style={styles.section} delay={Math.min(index * 30, 150)}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
          <Text style={[styles.sectionSubTitle, { color: theme.subText }]}>
            {section.data.length} video{section.data.length === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={[styles.sectionCount, { backgroundColor: theme.iconBg }]}>
          <Text style={[styles.sectionMeta, { color: theme.primary }]}>
            {section.data.length}
          </Text>
        </View>
      </View>

      {isGridView ? (
        <View style={styles.gridWrap}>
          {section.data.map((item, idx) => renderVideoCard(item, idx, section.title))}
        </View>
      ) : (
        section.data.map((item, idx) => renderVideoCard(item, idx, section.title))
      )}
    </FadeInView>
  ),
  [isGridView, renderVideoCard, theme]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Videos"
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
        placeholder="Search videos..."
        active={hasActiveFilters}
      />

      <FlashList
        data={groupedVideos}
        keyExtractor={getVideoSectionKey}
        contentContainerStyle={styles.listContent}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={7}
        estimatedItemSize={260}
        removeClippedSubviews
        renderItem={renderVideoSection}
        ListEmptyComponent={
          !sceneReady ? null :
          <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No videos available</Text>
            <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
              Upload a video from the Backup tab to see it here.
            </Text>
          </View>
        }
      />

      <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.filterOverlay}>
          <TouchableOpacity
            style={styles.filterScrim}
            activeOpacity={1}
            onPress={() => setFilterVisible(false)}
          />
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
                value={
                  datePickerTarget === "start"
                    ? startDate || new Date()
                    : endDate || startDate || new Date()
                }
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

            <Text style={[styles.filterLabel, { color: theme.subText }]}>View</Text>
            <View style={[styles.segmentedControl, { backgroundColor: theme.card }]}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  !isGridView && { backgroundColor: theme.primary },
                ]}
                onPress={() => setIsGridView(false)}
              >
                <Ionicons
                  name="list"
                  size={18}
                  color={!isGridView ? theme.buttonText : theme.subText}
                />
                <Text style={[styles.segmentText, { color: !isGridView ? theme.buttonText : theme.subText }]}>
                  List
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  isGridView && { backgroundColor: theme.primary },
                ]}
                onPress={() => setIsGridView(true)}
              >
                <Ionicons
                  name="grid"
                  size={18}
                  color={isGridView ? theme.buttonText : theme.subText}
                />
                <Text style={[styles.segmentText, { color: isGridView ? theme.buttonText : theme.subText }]}>
                  Grid
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.clearButton, { borderColor: theme.border }]}
                onPress={clearFilters}
              >
                <Text style={[styles.clearButtonText, { color: theme.text }]}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: theme.primary }]}
                onPress={() => setFilterVisible(false)}
              >
                <Text style={[styles.applyButtonText, { color: theme.buttonText }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    paddingBottom: 12,
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
  searchInput: {
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
  listContent: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 28,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  sectionSubTitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "500",
  },
  sectionCount: {
    minWidth: 34,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: "800",
  },
  videoCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  videoPreviewWrap: {
    borderRadius: 8,
    overflow: "hidden",
  },
  videoPreview: {
    width: "100%",
    height: 150,
  },
  videoText: {
    marginTop: 12,
  },
  videoTitle: {
    fontWeight: "700",
    color: "#111827",
  },
  videoMeta: {
    marginTop: 4,
    color: "#6B7280",
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  gridCard: {
    width: "30.5%",
    borderRadius: 8,
    padding: 0,
    marginBottom: 10,
    overflow: "hidden",
  },
  gridCardGap: {
    marginRight: "2.75%",
  },
  gridPreviewWrap: {
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  gridPreview: {
    width: "100%",
    height: "100%",
  },
  gridTitle: {
    marginTop: 5,
    paddingHorizontal: 2,
    fontSize: 10,
    fontWeight: "800",
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
    top: 40,
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
