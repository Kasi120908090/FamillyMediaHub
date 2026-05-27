import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CachedImage from "./CachedImage";
import { getVideoThumbnailUri } from "../../utils/media";

function VideoFallback({ style }) {
  return (
    <View style={[styles.media, styles.fallback, style]}>
      <Ionicons name="videocam" size={26} color="#BFDBFE" />
    </View>
  );
}

export default function VideoThumbnail({
  item,
  style,
  thumbnailUri,
}) {
  const resolvedThumbnailUri = thumbnailUri || getVideoThumbnailUri(item);

  return (
    <View style={[styles.container, style]}>
      {resolvedThumbnailUri ? (
        <CachedImage source={{ uri: resolvedThumbnailUri }} style={styles.media} resizeMode="cover" />
      ) : (
        <VideoFallback />
      )}

      <View style={styles.overlay}>
        <View style={styles.playBadge}>
          <Ionicons name="play" size={18} color="#fff" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  playBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
  },
});
