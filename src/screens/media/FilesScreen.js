import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  InteractionManager,
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
import FileViewer from "../../components/media/FileViewer";
import AppHeader from "../../components/navigation/AppHeader";
import {
  FileChip,
  SearchFilterBar,
  getFileTone,
  getFriendlyTitle,
  getReadableSize,
  softShadow,
  ui,
} from "../../components/media/MediaDesign";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { resolveMediaUri } from "../../services/api";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

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
    item?.path
  );

  return serverPath ? resolveMediaUri(serverPath) : item?.previewUri || item?.uri || null;
};

const getMediaChildId = (item) =>
  item?.child_id ??
  item?.childId ??
  item?.child_profile_id ??
  item?.childProfileId ??
  null;

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
    mediaItems,
    selectedChildId,
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    setSceneReady(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setSceneReady(true);
    });

    return () => task.cancel();
  }, []);

  const files = useMemo(
    () =>
      (sceneReady ? mediaItems : [])
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
          (item) =>
            item.category !== "images" &&
            item.category !== "videos" &&
            !item.content_type?.startsWith("image/") &&
            !item.content_type?.startsWith("video/")
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
    [endDate, isChildAccount, mediaItems, sceneReady, searchQuery, selectedChildId, startDate, isDateReversed]
  );

  const hasActiveFilters = Boolean(startDate || endDate || isGridView || isDateReversed);

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

  const renderFileItem = ({ item, index }) => {
    const fileName = item.original_file_name || item.stored_file_name || "Document";

    if (isGridView) {
      return (
        <TouchableOpacity
          style={[
            styles.fileGridCard,
            (index + 1) % 3 !== 0 && styles.fileGridCardGap,
            softShadow,
            { backgroundColor: theme.card },
          ]}
          onPress={() => setSelectedFile(item)}
          activeOpacity={0.86}
        >
          <FileChip compact name={fileName} type={item.content_type} />
          <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={2}>
            {getFriendlyTitle(item, "Document")}
          </Text>
          <Text style={[styles.fileMeta, { color: theme.subText }]} numberOfLines={1}>
            {getReadableSize(item) || formatShortDate(getItemDate(item))}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.fileCard, softShadow, { backgroundColor: theme.card }]}
        onPress={() => setSelectedFile(item)}
        activeOpacity={0.86}
      >
        <View style={styles.fileLeft}>
          <View style={[styles.iconBox, { backgroundColor: getFileTone(fileName, item.content_type).bg }]}>
            <Ionicons
              name={getFileTone(fileName, item.content_type).icon}
              size={18}
              color={getFileTone(fileName, item.content_type).color}
            />
          </View>
          <View style={styles.fileText}>
            <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
              {getFriendlyTitle(item, "Document")}
            </Text>
            <Text style={[styles.fileMeta, { color: theme.subText }]}>
              {getReadableSize(item) || item.content_type || "file"} - {formatShortDate(getItemDate(item))}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Files"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
            <ThemedAvatar uri={viewerProfile.image} name={viewerProfile.name} style={styles.avatar} />
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

      <FlatList
        data={files}
        keyExtractor={getFileItemKey}
        key={isGridView ? "files-grid" : "files-list"}
        numColumns={isGridView ? 3 : 1}
        columnWrapperStyle={isGridView ? styles.gridRow : null}
        contentContainerStyle={styles.listContent}
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

            <Text style={[styles.filterLabel, { color: theme.subText }]}>View</Text>
            <View style={[styles.segmentedControl, { backgroundColor: theme.card }]}>
              <TouchableOpacity
                style={[styles.segmentButton, !isGridView && { backgroundColor: theme.primary }]}
                onPress={() => setIsGridView(false)}
              >
                <Ionicons name="list" size={18} color={!isGridView ? theme.buttonText : theme.subText} />
                <Text style={[styles.segmentText, { color: !isGridView ? theme.buttonText : theme.subText }]}>List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, isGridView && { backgroundColor: theme.primary }]}
                onPress={() => setIsGridView(true)}
              >
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

      <FileViewer
        file={selectedFile}
        visible={Boolean(selectedFile)}
        onClose={() => setSelectedFile(null)}
        onDelete={canManageMedia ? moveMediaToRecycleBin : null}
        getFileUri={getFileUri}
        getFileTitle={(item) => item?.original_file_name || item?.stored_file_name || "Document"}
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
  listContent: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 28,
  },
  gridRow: {
    justifyContent: "flex-start",
  },
  fileCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  fileGridCard: {
    width: "31.5%",
    minHeight: 116,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    justifyContent: "space-between",
  },
  fileGridCardGap: {
    marginRight: "2.75%",
  },
  fileLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  gridIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  fileText: {
    flex: 1,
  },
  fileName: {
    fontWeight: "800",
    color: "#111827",
    fontSize: 11,
  },
  fileMeta: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
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
