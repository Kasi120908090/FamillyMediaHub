import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  InteractionManager,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import CachedImage from "../../components/media/CachedImage";
import ImageViewer from "../../components/media/ImageViewer";
import {
  FadeInView,
  MediaBadge,
  SearchFilterBar,
  getFriendlyTitle,
  softShadow,
  ui,
} from "../../components/media/MediaDesign";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { resolveMediaUri } from "../../services/api";
import { borderRadius, layout, spacing, typography } from "../../theme/designSystem";
import { moderateScale } from "../../theme/responsive";

const formatGroupTitle = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

const formatImageDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const getImageUri = (item) => item?.previewUri || resolveMediaUri(item?.file_path);

const getMediaChildId = (item) =>
  item?.child_id ??
  item?.childId ??
  item?.child_profile_id ??
  item?.childProfileId ??
  null;

const getImageSectionKey = (section, index) => `image-section-${section.title}-${index}`;

const getImageTileKey = (item, index, rowId) => {
  const stablePart =
    item?.id ??
    item?.file_path ??
    item?.previewUri ??
    item?.stored_file_name ??
    item?.original_file_name ??
    "image";

  return `${rowId}-${stablePart}-${index}`;
};

export default function ImagesScreen({ navigation, onOpenMenu }) {
  const {
    viewerProfile,
    mediaItems,
    selectedChildId,
    selectedChild,
    canManageMedia,
    isChildAccount,
    moveMediaToRecycleBin,
  } = useProfile();
  const renderCounter = useRef(0);
  renderCounter.current += 1;

  useEffect(() => {
    console.log("[Perf] ImagesScreen mount", {
      renderCount: renderCounter.current,
      mediaItemsCount: mediaItems.length,
      selectedChildId,
    });
    return () => console.log("[Perf] ImagesScreen unmount");
  }, []);
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isGridView, setIsGridView] = useState(true);
  const [isDateReversed, setIsDateReversed] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    setSceneReady(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setSceneReady(true);
    });

    return () => task.cancel();
  }, []);

  const images = useMemo(() => {
    console.time("[Perf] Images filteredImages");
    const result = (sceneReady ? mediaItems : [])
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
          (item) => item.category === "images" || item.content_type?.startsWith("image/")
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
    console.timeEnd("[Perf] Images filteredImages");
    return result;
  }, [endDate, isChildAccount, mediaItems, sceneReady, searchQuery, selectedChildId, startDate, isDateReversed]);

  const groupedImages = useMemo(() => {
    console.time("[Perf] Images groupedImages");
    const groups = {};

    images.forEach((item) => {
      const key = formatGroupTitle(item.created_at || item.createdAt || new Date().toISOString());
      if (!groups[key]) {
        groups[key] = { title: key, data: [], date: getItemDate(item) };
      }
      groups[key].data.push(item);
    });

    const result = Object.values(groups).sort((a, b) =>
      isDateReversed ? a.date - b.date : b.date - a.date
    );
    console.timeEnd("[Perf] Images groupedImages");
    return result;
  }, [images, isDateReversed]);

  const layoutSections = useMemo(
    () => {
      console.time("[Perf] Images layoutSections");
      const result = groupedImages.map((section) => {
        const rows = [];

        const itemsPerRow = isGridView ? 4 : 1;

        for (let index = 0; index < section.data.length; index += itemsPerRow) {
          const rowItems = section.data.slice(index, index + itemsPerRow);
          rows.push({
            id: `${section.title}-pair-${rows.length}`,
            items: rowItems,
          });
        }

        return {
          ...section,
          rows,
        };
      });
      console.timeEnd("[Perf] Images layoutSections");
      return result;
    },
    [groupedImages, isGridView]
  );

  const featuredImages = useMemo(() => images.slice(0, 3), [images]);
  const latestImage = featuredImages[0];

  const openViewer = useCallback(
    (item) => {
      const index = images.findIndex((currentItem) => currentItem.id === item.id);
      setViewerIndex(index >= 0 ? index : 0);
      setViewerVisible(true);
    },
    [images]
  );

  const renderImageSection = useCallback(
    ({ item: section, index }) => (
      <FadeInView style={styles.section} delay={Math.min(index * 30, 150)}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
          </View>
          <Text style={[styles.sectionMeta, { color: theme.subText }]}>
            {section.data.length} Photos
          </Text>
        </View>

        {section.rows.map((row) => (
          <View key={row.id} style={styles.pairRow}>
            {row.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={getImageTileKey(item, itemIndex, row.id)}
                activeOpacity={0.9}
                onPress={() => openViewer(item)}
                style={[
                  isGridView ? styles.pairTile : styles.listTile,
                  { backgroundColor: theme.card },
                  isGridView && softShadow,
                ]}
              >
                {isGridView ? (
                  <>
                    <CachedImage source={{ uri: getImageUri(item) }} style={styles.tileImage} />
                    <View style={styles.tileShade} />
                    <MediaBadge icon="image-outline" />
                  </>
                ) : (
                  <View style={styles.listTileContent}>
                    <CachedImage source={{ uri: getImageUri(item) }} style={styles.listTileImage} />
                    <View style={styles.listTileText}>
                      <Text style={[styles.listTileTitle, { color: theme.text }]} numberOfLines={1}>
                        {item.original_file_name || item.stored_file_name || "Photo"}
                      </Text>
                      <Text style={[styles.listTileMeta, { color: theme.subText }]}> 
                        {formatShortDate(getItemDate(item))}
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {isGridView
              ? Array.from({ length: 4 - row.items.length }).map((_, spacerIndex) => (
                  <View key={`spacer-${row.id}-${spacerIndex}`} style={styles.pairTileSpacer} />
                ))
              : null}
          </View>
        ))}
      </FadeInView>
    ),
    [isGridView, openViewer, theme]
  );

  const hasActiveFilters = Boolean(startDate || endDate || !isGridView || isDateReversed);

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
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Images"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
            <ThemedAvatar uri={viewerProfile.image} name={viewerProfile.name} style={styles.avatar} />
          </TouchableOpacity>
        }
      />

      <FlashList
        data={layoutSections}
        keyExtractor={getImageSectionKey}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={4}
        maxToRenderPerBatch={5}
        windowSize={7}
        estimatedItemSize={240}
        removeClippedSubviews
        renderItem={renderImageSection}
        ListHeaderComponent={
          <>
            <SearchFilterBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery("")}
              onFilterPress={() => setFilterVisible(true)}
              placeholder="Search images..."
              active={hasActiveFilters}
            />
            <View style={styles.librarySummary}>
              <Text style={[styles.summaryMonth, { color: theme.text }]}>April 2025</Text>
              <Text style={[styles.summaryCount, { color: theme.subText }]}>
                {images.length} Photos
              </Text>
            </View>
          </>
        }
        renderItem={({ item: section, index }) => (
          <FadeInView style={styles.section} delay={Math.min(index * 30, 150)}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              </View>
              <Text style={[styles.sectionMeta, { color: theme.subText }]}>
                {section.data.length} Photos
              </Text>
            </View>

            {section.rows.map((row) => (
              <View key={row.id} style={styles.pairRow}>
                {row.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={getImageTileKey(item, itemIndex, row.id)}
                    activeOpacity={0.9}
                    onPress={() => openViewer(item)}
                    style={[
                      isGridView ? styles.pairTile : styles.listTile,
                      { backgroundColor: theme.card },
                      isGridView && softShadow,
                    ]}
                  >
                    {isGridView ? (
                      <>
                        <CachedImage source={{ uri: getImageUri(item) }} style={styles.tileImage} />
                        <View style={styles.tileShade} />
                        <MediaBadge icon="image-outline"></MediaBadge>
                      </>
                    ) : (
                      <View style={styles.listTileContent}>
                        <CachedImage source={{ uri: getImageUri(item) }} style={styles.listTileImage} />
                        <View style={styles.listTileText}>
                          <Text style={[styles.listTileTitle, { color: theme.text }]} numberOfLines={1}>
                            {item.original_file_name || item.stored_file_name || "Photo"}
                          </Text>
                          <Text style={[styles.listTileMeta, { color: theme.subText }]}>
                            {formatShortDate(getItemDate(item))}
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                {isGridView
                  ? Array.from({ length: 4 - row.items.length }).map((_, spacerIndex) => (
                      <View key={`spacer-${row.id}-${spacerIndex}`} style={styles.pairTileSpacer} />
                    ))
                  : null}
              </View>
            ))}
          </FadeInView>
        )}
        ListEmptyComponent={
          !sceneReady ? null :
          <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.iconBg }]}>
              <Ionicons name="image-outline" size={42} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No images available</Text>
            <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
              Upload an image from the Backup tab to see it here.
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate("Upload")}
              activeOpacity={0.85}
            >
              <Text style={[styles.emptyButtonText, { color: theme.buttonText }]}>
                Upload Photo
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ImageViewer
        images={images}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        onDelete={canManageMedia ? moveMediaToRecycleBin : null}
        getImageUri={getImageUri}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  avatar: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(19),
  },
  content: {
    paddingBottom: spacing.xl,
  },
  librarySummary: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryMonth: {
    fontSize: typography.label,
    fontWeight: "900",
  },
  summaryCount: {
    fontSize: typography.caption,
    fontWeight: "800",
  },
  heroCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    backgroundColor: "#0F172A",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    minHeight: moderateScale(124),
  },
  eyebrow: {
    color: "#93C5FD",
    fontSize: typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: "#FFFFFF",
    fontSize: typography.heading,
    fontWeight: "800",
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    color: "#CBD5E1",
    fontSize: typography.body,
    lineHeight: typography.body * 1.35,
  },
  heroPreviewWrap: {
    width: moderateScale(112),
    height: moderateScale(124),
    position: "relative",
  },
  heroPreview: {
    position: "absolute",
    width: moderateScale(78),
    height: moderateScale(96),
    borderRadius: borderRadius.lg,
    borderWidth: moderateScale(3),
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "#DCE5F3",
  },
  heroPreviewMain: {
    right: 0,
    top: moderateScale(8),
    zIndex: 3,
  },
  heroPreviewSecond: {
    left: moderateScale(14),
    top: moderateScale(22),
    zIndex: 2,
    transform: [{ rotate: "-7deg" }],
    opacity: 0.9,
  },
  heroPreviewThird: {
    left: 0,
    top: moderateScale(38),
    zIndex: 1,
    transform: [{ rotate: "7deg" }],
    opacity: 0.78,
  },
  heroEmptyPreview: {
    width: moderateScale(104),
    height: moderateScale(104),
    borderRadius: borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBottomRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  statPill: {
    minHeight: moderateScale(34),
    borderRadius: moderateScale(17),
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statPillText: {
    fontSize: typography.label,
    fontWeight: "700",
  },
  toolbarRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: moderateScale(50),
    borderWidth: 1,
    borderColor: "#E5EAF3",
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.body,
    color: "#111827",
  },
  filterButton: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: layout.screenPadding,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: typography.label,
    fontWeight: "900",
  },
  sectionSubTitle: {
    marginTop: spacing.xs,
    color: "#6B7280",
    fontSize: typography.caption,
    fontWeight: "500",
  },
  sectionCount: {
    minWidth: moderateScale(34),
    height: moderateScale(28),
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  sectionMeta: {
    color: "#6B7280",
    fontSize: typography.label,
    fontWeight: "800",
  },
  pairRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  pairTile: {
    width: "23.4%",
    aspectRatio: 1,
    borderRadius: borderRadius.sm,
    overflow: "hidden",
    backgroundColor: "#DCE5F3",
  },
  pairTileSpacer: {
    width: "23.4%",
    aspectRatio: 1,
  },
  listTile: {
    width: "100%",
    minHeight: moderateScale(88),
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  listTileContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  listTileImage: {
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: borderRadius.md,
    backgroundColor: "#DCE5F3",
  },
  listTileText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  listTileTitle: {
    fontWeight: "800",
    fontSize: typography.body,
  },
  listTileMeta: {
    marginTop: spacing.xs,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  tileShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.10)",
  },
  tileTopOverlay: {
    position: "absolute",
    top: moderateScale(10),
    right: moderateScale(10),
  },
  tileIconBubble: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  tileFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: moderateScale(44),
    justifyContent: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  tileTitle: {
    color: "#fff",
    fontSize: typography.caption,
    fontWeight: "700",
  },
  emptyState: {
    marginTop: spacing.lg,
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EDF5",
  },
  emptyIcon: {
    width: moderateScale(82),
    height: moderateScale(82),
    borderRadius: borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: spacing.md,
    color: "#111827",
    fontSize: typography.title,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    color: "#6B7280",
    lineHeight: typography.body * 1.25,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: spacing.lg,
    minHeight: moderateScale(44),
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: {
    fontWeight: "700",
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
