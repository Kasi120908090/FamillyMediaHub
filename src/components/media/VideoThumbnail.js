import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CachedImage from "./CachedImage";
import { getVideoThumbnailUri } from "../../utils/media";
import { getOrCreateVideoThumbnailUri } from "../../utils/videoThumbnails";
import { formatDuration, MediaBadge } from "./MediaDesign";

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
  showDuration = false,
  small = false,
}) {
  const remoteThumb = thumbnailUri || getVideoThumbnailUri(item);
  const [generatedThumb, setGeneratedThumb] = useState(null);

  useEffect(() => {
    let isMounted = true;

    setGeneratedThumb(null);

    if (remoteThumb) {
      return () => {
        isMounted = false;
      };
    }

    getOrCreateVideoThumbnailUri(item).then((uri) => {
      if (isMounted) {
        setGeneratedThumb(uri);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [item, remoteThumb]);

  const displayUri = remoteThumb || generatedThumb;

  return (
    <View style={[styles.container, style]}>
      {displayUri ? (
        <CachedImage source={{ uri: displayUri }} style={styles.media} resizeMode="cover" />
      ) : (
        <VideoFallback />
      )}

      <View style={styles.overlay}>
        <View style={[styles.playBadge, small && styles.playBadgeSmall]}>
          <Ionicons name={small ? "play" : "play-sharp"} size={small ? 12 : 20} color="#fff" />
        </View>
      </View>

      {showDuration && item?.duration > 0 && (
        <MediaBadge icon="time-outline">
          {formatDuration(item.duration)}
        </MediaBadge>
      )}
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
  playBadgeSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
});
