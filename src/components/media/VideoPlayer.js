import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { getVideoSource } from "../../utils/media";

export default function VideoPlayer({
  source,
  style,
  contentFit = "cover",
  nativeControls = true,
  allowsFullscreen = true,
  fullscreen,
  surfaceType,
  loop = false,
  muted = false,
  posterSource = null,
  shouldPlay = false,
  onFirstFrameRender,
}) {
  const canFullscreen = fullscreen ?? allowsFullscreen;
  const videoSource = useMemo(() => getVideoSource(source), [source]);
  const player = useVideoPlayer(videoSource, (videoPlayer) => {
    videoPlayer.loop = loop;
    videoPlayer.muted = muted;
    videoPlayer.bufferOptions = {
      preferredForwardBufferDuration: 3,
      minBufferForPlayback: 1,
      waitsToMinimizeStalling: false,
    };
  });
  const [errorMessage, setErrorMessage] = React.useState("");

  useEffect(() => {
    player.loop = loop;
    player.muted = muted;

    if (shouldPlay && videoSource) {
      player.play();

      const playRetry = setTimeout(() => {
        player.play();
      }, 100);

      return () => clearTimeout(playRetry);
    } else {
      player.pause();
    }
  }, [loop, muted, player, shouldPlay, videoSource]);

  useEffect(() => {
    setErrorMessage("");

    const statusSubscription = player.addListener?.("statusChange", ({ status, error }) => {
      if (status === "readyToPlay" && shouldPlay) {
        player.play();
      }

      if (status === "error") {
        setErrorMessage(error?.message || "Unable to play this video.");
      }
    });

    return () => statusSubscription?.remove?.();
  }, [player, shouldPlay]);

  if (!videoSource) {
    return <View style={[styles.fallback, style]} />;
  }

  return (
    <View style={[styles.wrap, style]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        nativeControls={nativeControls}
        posterSource={posterSource}
        allowsFullscreen={canFullscreen}
        surfaceType={surfaceType}
        allowsPictureInPicture
        startsPictureInPictureAutomatically={false}
        useExoShutter={false}
        onFirstFrameRender={onFirstFrameRender}
      />
      {errorMessage ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#111827",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    backgroundColor: "#DBEAFE",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#000",
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
});
