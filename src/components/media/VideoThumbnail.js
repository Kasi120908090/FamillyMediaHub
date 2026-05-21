import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { getMediaUri, getVideoSource, getVideoThumbnailUri } from "../../utils/media";

function VideoFrameThumbnail({ item }) {
  const [hasFrame, setHasFrame] = useState(false);
  const videoUri = getMediaUri(item);
  const source = useMemo(() => getVideoSource(videoUri), [videoUri]);
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.muted = true;
    videoPlayer.loop = false;
  });

  useEffect(() => {
    const subscription = player.addListener?.("statusChange", ({ status }) => {
      if (status === "readyToPlay") {
        player.currentTime =
          Number.isFinite(player.duration) && player.duration > 0.1 ? 0.1 : 0;
      }
    });

    return () => subscription?.remove?.();
  }, [player]);

  if (!source) {
    return <VideoFallback />;
  }

  return (
    <>
      <VideoView
        player={player}
        style={styles.media}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        surfaceType="textureView"
        useExoShutter={false}
        onFirstFrameRender={() => setHasFrame(true)}
      />
      {!hasFrame ? <VideoFallback style={styles.absoluteFill} /> : null}
    </>
  );
}

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
        <Image source={{ uri: resolvedThumbnailUri }} style={styles.media} resizeMode="cover" />
      ) : (
        <VideoFrameThumbnail item={item} />
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
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
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
