import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CachedImage from "./CachedImage";
import ZoomableMedia from "./ZoomableMedia";

const getImageKey = (item, index) => {
  const stablePart =
    item?.id ??
    item?.file_path ??
    item?.previewUri ??
    item?.stored_file_name ??
    item?.original_file_name ??
    item?.uri ??
    item?.local_uri ??
    item?.localUri ??
    String(index);

  return `image-${stablePart}`;
};

export default function MediaViewer({
  images,
  initialIndex = 0,
  visible,
  onClose,
  onDelete,
  getImageUri,
  getImageTitle,
}) {
  const pagerRef = useRef(null);
  const autoHideTimer = useRef(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [menuVisible, setMenuVisible] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);

  const activeImage = images[Math.max(0, Math.min(activeIndex, images.length - 1))] || null;
  const title = useMemo(
    () => getImageTitle(activeImage) || "Image",
    [activeImage, getImageTitle]
  );
  const subtitle = useMemo(
    () => (images.length ? `${activeIndex + 1} of ${images.length}` : ""),
    [activeIndex, images.length]
  );

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    setActiveIndex(initialIndex);
    setControlsVisible(true);
    setMenuVisible(false);
    setIsZoomed(false);

    if (pagerRef.current && typeof pagerRef.current.setPage === "function") {
      pagerRef.current.setPage(initialIndex);
    }

    autoHideTimer.current = setTimeout(() => {
      setControlsVisible(false);
      setMenuVisible(false);
    }, 3000);

    return () => {
      clearTimeout(autoHideTimer.current);
    };
  }, [initialIndex, visible]);

  const resetAutoHide = () => {
    clearTimeout(autoHideTimer.current);
    setControlsVisible(true);
    setMenuVisible(false);
    autoHideTimer.current = setTimeout(() => {
      setControlsVisible(false);
      setMenuVisible(false);
    }, 3000);
  };

  const handleClose = () => {
    clearTimeout(autoHideTimer.current);
    onClose?.();
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
          handleClose();
        },
      },
    ]);
  };

  const handleMenuToggle = () => {
    setMenuVisible((current) => !current);
    resetAutoHide();
  };

  const handlePageSelected = ({ nativeEvent }) => {
    setActiveIndex(nativeEvent.position);
    setMenuVisible(false);
    resetAutoHide();
  };

  const onZoomChange = (scale) => {
    setIsZoomed(scale > 1);
    if (scale <= 1) {
      resetAutoHide();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <StatusBar hidden={visible} barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.container}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={initialIndex}
          onPageSelected={handlePageSelected}
          scrollEnabled={!isZoomed}
          offscreenPageLimit={1}
        >
          {images.map((item, index) => (
            <View key={getImageKey(item, index)} style={[styles.page, { width, height }]}> 
              <View style={styles.pageContent} onTouchStart={resetAutoHide}>
                <ZoomableMedia
                  resetKey={getImageKey(item, index)}
                  onZoomChange={onZoomChange}
                  onSwipeDown={handleClose}
                >
                  <CachedImage
                    source={{ uri: getImageUri(item) }}
                    style={[styles.image, { width, height }]}
                    resizeMode="contain"
                  />
                </ZoomableMedia>
              </View>
            </View>
          ))}
        </PagerView>

        {controlsVisible ? (
          <View style={[styles.topOverlay, { paddingTop: insets.top + 14 }]}> 
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.iconButton} onPress={handleClose}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={styles.titleWrap}>
                <Text style={styles.titleText} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.subtitleText}>{subtitle}</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={handleMenuToggle}>
                <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {menuVisible ? (
              <View style={styles.menuSheet}>
                <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={18} color="#fff" />
                  <Text style={styles.menuText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Info", "Details will be available soon.") }>
                  <Ionicons name="information-circle-outline" size={18} color="#fff" />
                  <Text style={styles.menuText}>Info</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Favorite", "Favorite will be available soon.") }>
                  <Ionicons name="heart-outline" size={18} color="#fff" />
                  <Text style={styles.menuText}>Favorite</Text>
                </TouchableOpacity>
                {onDelete ? (
                  <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                    <Text style={[styles.menuText, styles.deleteText]}>Delete</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {controlsVisible ? (
          <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 14 }]}> 
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color="#fff" />
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert("Favorite", "Favorite will be available soon.")}
            >
              <Ionicons name="heart-outline" size={22} color="#fff" />
              <Text style={styles.actionLabel}>Favorite</Text>
            </TouchableOpacity>
            {onDelete ? (
              <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color="#FCA5A5" />
                <Text style={[styles.actionLabel, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert("Info", "Image details will be available soon.")}
            >
              <Ionicons name="information-circle-outline" size={22} color="#fff" />
              <Text style={styles.actionLabel}>Info</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  pager: {
    flex: 1,
    backgroundColor: "#000",
  },
  page: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  pageContent: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  topOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    marginHorizontal: 6,
  },
  titleText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  subtitleText: {
    color: "#D1D5DB",
    fontSize: 12,
    marginTop: 2,
  },
  menuSheet: {
    marginTop: 10,
    marginHorizontal: 14,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(17,24,39,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  menuItem: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  bottomOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 0,
    zIndex: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.64)",
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
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
