import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ZoomableMedia from "./ZoomableMedia";

const { width, height } = Dimensions.get("window");

const getImageKey = (item, index) => {
  const stablePart =
    item?.id ??
    item?.file_path ??
    item?.previewUri ??
    item?.stored_file_name ??
    item?.original_file_name ??
    "image";

  return `image-${stablePart}-${index}`;
};

export default function ImageViewer({
  images,
  initialIndex = 0,
  visible,
  onClose,
  onDelete,
  getImageUri,
  getImageTitle,
}) {
  const listRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const activeImage = images[activeIndex];
  const canDelete = Boolean(onDelete);

  const scrollToImage = (index, animated = false) => {
    if (!images.length) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, images.length - 1));
    listRef.current?.scrollToIndex({
      index: safeIndex,
      animated,
    });
  };

  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      requestAnimationFrame(() => {
        scrollToImage(initialIndex);
      });
    } else {
      setMenuVisible(false);
    }
  }, [initialIndex, visible, images.length]);

  const handleMomentumEnd = (event) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
    setMenuVisible(false);
    setIsZoomed(false);
  };

  const handleScrollToIndexFailed = ({ index }) => {
    setTimeout(() => scrollToImage(index), 80);
  };

  const handleShare = async () => {
    if (!activeImage) {
      return;
    }

    try {
      await Share.share({
        title: getImageTitle(activeImage),
        message: getImageUri(activeImage),
        url: Platform.OS === "ios" ? getImageUri(activeImage) : undefined,
      });
    } catch {
      Alert.alert("Share unavailable", "This image could not be shared right now.");
    }
  };

  const showComingSoon = (label) => {
    setMenuVisible(false);
    Alert.alert(label, `${label} option will be available soon.`);
  };

  const handleDelete = () => {
    if (!activeImage || !onDelete) {
      return;
    }

    setMenuVisible(false);
    Alert.alert("Move to Recycle Bin", "This image will be moved to Recycle Bin.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Move",
        style: "destructive",
        onPress: () => {
          onDelete(activeImage);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {getImageTitle(images[activeIndex])}
            </Text>
            <Text style={styles.headerSubtitle}>
              {images.length ? `${activeIndex + 1} of ${images.length}` : ""}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setMenuVisible((current) => !current)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {menuVisible ? (
          <View style={styles.overflowMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.menuText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => showComingSoon("Details")}>
              <Ionicons name="information-circle-outline" size={18} color="#fff" />
              <Text style={styles.menuText}>Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => showComingSoon("Edit")}>
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={styles.menuText}>Edit</Text>
            </TouchableOpacity>
            {canDelete ? (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                <Text style={[styles.menuText, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          keyExtractor={getImageKey}
          scrollEnabled={!isZoomed}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          onTouchStart={() => setMenuVisible(false)}
          renderItem={({ item, index }) => (
            <View style={styles.slide}>
              <ZoomableMedia
                resetKey={getImageKey(item, index)}
                onZoomChange={(scale) => setIsZoomed(scale > 1)}
              >
                <Image
                  source={{ uri: getImageUri(item) }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </ZoomableMedia>
            </View>
          )}
        />

        <View style={styles.actionBar}>
          <ActionButton icon="share-social-outline" label="Share" onPress={handleShare} />
          <ActionButton icon="create-outline" label="Edit" onPress={() => showComingSoon("Edit")} />
          <ActionButton icon="heart-outline" label="Favorite" onPress={() => showComingSoon("Favorite")} />
          {canDelete ? (
            <ActionButton
              icon="trash-outline"
              label="Delete"
              onPress={handleDelete}
              danger
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const ActionButton = ({ icon, label, onPress, danger }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.78}>
    <Ionicons name={icon} size={22} color={danger ? "#FCA5A5" : "#fff"} />
    <Text style={[styles.actionLabel, danger && styles.deleteText]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    position: "absolute",
    top: 36,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#D1D5DB",
    fontSize: 12,
    marginTop: 2,
  },
  slide: {
    width,
    height,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width,
    height: height * 0.82,
  },
  overflowMenu: {
    position: "absolute",
    top: 82,
    right: 12,
    zIndex: 3,
    width: 164,
    borderRadius: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(17,24,39,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  menuItem: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  menuText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 2,
    minHeight: 72,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  actionButton: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  deleteText: {
    color: "#FCA5A5",
  },
});
