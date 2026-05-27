import React, { useMemo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import CachedImage from "../../components/media/CachedImage";
import VideoThumbnail from "../../components/media/VideoThumbnail";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { getMediaUri } from "../../utils/media";

const getNormalizedCategory = (item) => {
  if (item?.category === "images" || item?.content_type?.startsWith("image/")) {
    return "image";
  }

  if (item?.category === "videos" || item?.content_type?.startsWith("video/")) {
    return "video";
  }

  return "file";
};

const getRecycleItemKey = (item, index) => {
  const stablePart =
    item?.id ??
    item?.file_path ??
    item?.previewUri ??
    item?.stored_file_name ??
    item?.original_file_name ??
    "media";

  return `recycle-${stablePart}-${index}`;
};

const formatDeletedDate = (dateString) => {
  const date = new Date(dateString || Date.now());

  if (Number.isNaN(date.getTime())) {
    return "Recently deleted";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function RecycleBinScreen({ navigation, onOpenMenu }) {
  const { viewerProfile, recycleBinItems, canManageMedia, restoreMediaFromRecycleBin } = useProfile();
  const { theme } = useTheme();

  const items = useMemo(
    () =>
      [...recycleBinItems].sort(
        (first, second) =>
          new Date(second.deleted_at || 0).getTime() -
          new Date(first.deleted_at || 0).getTime()
      ),
    [recycleBinItems]
  );

  const renderPreview = (item) => {
    const category = getNormalizedCategory(item);

    if (category === "image") {
      return <CachedImage source={{ uri: getMediaUri(item) }} style={styles.preview} />;
    }

    if (category === "video") {
      return <VideoThumbnail item={item} style={styles.preview} />;
    }

    return (
      <View style={[styles.preview, styles.filePreview]}>
        <Ionicons name="document-text" size={24} color="#2563EB" />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Recycle Bin"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
            <ThemedAvatar uri={viewerProfile.image} name={viewerProfile.name} style={styles.avatar} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={items}
        keyExtractor={getRecycleItemKey}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const category = getNormalizedCategory(item);

          return (
            <View style={[styles.itemCard, { backgroundColor: theme.card }]}>
              <View style={styles.previewWrap}>{renderPreview(item)}</View>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>
                  Deleted {category}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.subText }]}>
                  {formatDeletedDate(item.deleted_at)}
                </Text>
              </View>
              {canManageMedia ? (
                <TouchableOpacity
                  style={[styles.restoreButton, { backgroundColor: theme.primary }]}
                  onPress={() => restoreMediaFromRecycleBin(item)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={17} color={theme.buttonText} />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
            <Ionicons name="trash-outline" size={42} color={theme.primary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Recycle Bin is empty</Text>
            <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
              Deleted media will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  content: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 24,
  },
  itemCard: {
    minHeight: 82,
    borderRadius: 15,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  previewWrap: {
    width: 62,
    height: 62,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  filePreview: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },
  itemText: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  restoreButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginTop: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontWeight: "800",
    fontSize: 18,
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: "center",
  },
});
