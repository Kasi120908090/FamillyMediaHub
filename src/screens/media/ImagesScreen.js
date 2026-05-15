import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import ImageViewer from "../../components/media/ImageViewer";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { resolveMediaUri } from "../../services/api";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

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

  const images = useMemo(
    () =>
      mediaItems
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
        ),
    [endDate, isChildAccount, mediaItems, searchQuery, selectedChildId, startDate, isDateReversed]
  );

  const groupedImages = useMemo(() => {
    const groups = {};

    images.forEach((item) => {
      const key = formatGroupTitle(item.created_at || item.createdAt || new Date().toISOString());
      if (!groups[key]) {
        groups[key] = { title: key, data: [], date: getItemDate(item) };
      }
      groups[key].data.push(item);
    });

    return Object.values(groups).sort((a, b) =>
      isDateReversed ? a.date - b.date : b.date - a.date
    );
  }, [images, isDateReversed]);

  const layoutSections = useMemo(
    () =>
      groupedImages.map((section) => {
        const rows = [];

        const itemsPerRow = isGridView ? 2 : 1;

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
      }),
    [groupedImages, isGridView]
  );

  const featuredImages = useMemo(() => images.slice(0, 3), [images]);
  const latestImage = featuredImages[0];

  const openViewer = (item) => {
    const index = images.findIndex((currentItem) => currentItem.id === item.id);
    setViewerIndex(index >= 0 ? index : 0);
    setViewerVisible(true);
  };

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

      <FlatList
        data={layoutSections}
        keyExtractor={getImageSectionKey}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={4}
        maxToRenderPerBatch={5}
        windowSize={7}
        ListHeaderComponent={
          <>
            <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.eyebrow, { color: theme.primary }]}>Photo Library</Text>
                  <Text style={[styles.heroTitle, { color: theme.text }]}>
                    {selectedChild?.name || viewerProfile.name}
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
                    {images.length} photo{images.length === 1 ? "" : "s"} across{" "}
                    {groupedImages.length} day{groupedImages.length === 1 ? "" : "s"}
                  </Text>
                </View>

                <View style={styles.heroPreviewWrap}>
                  {featuredImages.length ? (
                    featuredImages.map((item, index) => (
                      <Image
                        key={getImageTileKey(item, index, "featured")}
                        source={{ uri: getImageUri(item) }}
                        style={[
                          styles.heroPreview,
                          index === 0 && styles.heroPreviewMain,
                          index === 1 && styles.heroPreviewSecond,
                          index === 2 && styles.heroPreviewThird,
                        ]}
                      />
                    ))
                  ) : (
                    <View style={[styles.heroEmptyPreview, { backgroundColor: theme.iconBg }]}>
                      <Ionicons name="images" size={26} color={theme.primary} />
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.heroBottomRow}>
                <View style={[styles.statPill, { backgroundColor: theme.iconBg }]}>
                  <Ionicons name="image" size={16} color={theme.primary} />
                  <Text style={[styles.statPillText, { color: theme.primary }]}>
                    {images.length} Photos
                  </Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: theme.iconBg }]}>
                  <Ionicons name="calendar" size={16} color={theme.primary} />
                  <Text style={[styles.statPillText, { color: theme.primary }]}>
                    {latestImage ? formatImageDate(latestImage.created_at || latestImage.createdAt) : "No Photos"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.toolbarRow}>
              <View style={[styles.searchShell, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Ionicons name="search" size={18} color={theme.subText} />
                <TextInput
                  placeholder="Search images..."
                  placeholderTextColor={theme.subText}
                  style={[styles.searchInput, { color: theme.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.8}>
                    <Ionicons name="close-circle" size={18} color={theme.subText} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: hasActiveFilters ? theme.primary : theme.card,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setFilterVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="options-outline"
                  size={22}
                  color={hasActiveFilters ? theme.buttonText : theme.text}
                />
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                <Text style={[styles.sectionSubTitle, { color: theme.subText }]}>
                  Memories from this day
                </Text>
              </View>
              <View style={[styles.sectionCount, { backgroundColor: theme.iconBg }]}>
                <Text style={[styles.sectionMeta, { color: theme.primary }]}>
                  {section.data.length}
                </Text>
              </View>
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
                    ]}
                  >
                    {isGridView ? (
                      <>
                        <Image source={{ uri: getImageUri(item) }} style={styles.tileImage} />
                        <View style={styles.tileShade} />
                        <View style={styles.tileTopOverlay}>
                          <View style={styles.tileIconBubble}>
                            <Ionicons name="image" size={13} color="#fff" />
                          </View>
                        </View>
                        <View style={styles.tileFooter}>
                          <Text style={styles.tileTitle} numberOfLines={1}>
                            {item.original_file_name || item.stored_file_name || "Photo"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.listTileContent}>
                        <Image source={{ uri: getImageUri(item) }} style={styles.listTileImage} />
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

                {isGridView && row.items.length === 1 ? <View style={styles.pairTileSpacer} /> : null}
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
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
    backgroundColor: "#F4F6FB",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  content: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 28,
  },
  heroCard: {
    marginTop: 8,
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#0F172A",
    overflow: "hidden",
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    minHeight: 124,
  },
  eyebrow: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
  },
  heroSubtitle: {
    marginTop: 8,
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
  },
  heroPreviewWrap: {
    width: 112,
    height: 124,
    position: "relative",
  },
  heroPreview: {
    position: "absolute",
    width: 78,
    height: 96,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "#DCE5F3",
  },
  heroPreviewMain: {
    right: 0,
    top: 8,
    zIndex: 3,
  },
  heroPreviewSecond: {
    left: 14,
    top: 22,
    zIndex: 2,
    transform: [{ rotate: "-7deg" }],
    opacity: 0.9,
  },
  heroPreviewThird: {
    left: 0,
    top: 38,
    zIndex: 1,
    transform: [{ rotate: "7deg" }],
    opacity: 0.78,
  },
  heroEmptyPreview: {
    width: 104,
    height: 104,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBottomRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flexWrap: "wrap",
  },
  statPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toolbarRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#E5EAF3",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#111827",
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubTitle: {
    marginTop: 3,
    color: "#6B7280",
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
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "800",
  },
  pairRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pairTile: {
    width: "48.5%",
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#DCE5F3",
  },
  pairTileSpacer: {
    width: "48.5%",
    aspectRatio: 1,
  },
  listTile: {
    width: "100%",
    minHeight: 88,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  listTileContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  listTileImage: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: "#DCE5F3",
  },
  listTileText: {
    flex: 1,
    marginLeft: 12,
  },
  listTileTitle: {
    fontWeight: "800",
    fontSize: 14,
  },
  listTileMeta: {
    marginTop: 4,
    fontSize: 12,
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
    top: 10,
    right: 10,
  },
  tileIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  tileFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 44,
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  tileTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    marginTop: 42,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EDF5",
  },
  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 16,
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 8,
    color: "#6B7280",
    lineHeight: 20,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 18,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 18,
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
