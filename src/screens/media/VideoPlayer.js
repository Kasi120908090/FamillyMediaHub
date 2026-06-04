import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, Text } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { getVideoSource } from "../../utils/media";

const VideoPlayer = ({
  source,
  style,

  // player props
  shouldPlay = false,
  nativeControls = true,
  contentFit = "contain",
  surfaceType = "textureView",

  // thumbnail
  posterSource = null,

  // callbacks
  onFirstFrameRender,

  // other props
  ...rest
}) => {
  const videoSource = useMemo(() => getVideoSource(source), [source]);

  // Diagnostic Logs
  console.log("VIDEO SOURCE:", source);
  console.log("RESOLVED VIDEO SOURCE:", videoSource);
  console.log("SOURCE URI:", videoSource?.uri || videoSource);
  console.log("PLAYBACK URI:", videoSource?.uri || videoSource);
  console.log("CACHE LOADING:", false);

  const player = useVideoPlayer(videoSource, (p) => {
    if (shouldPlay) {
      p.play();
    }
    p.loop = true;
  });

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  useEffect(() => {
    const statusSubscription = player.addListener?.("statusChange", ({ status, error }) => {
      console.log("PLAYER STATUS:", status);
      if (error) console.log("PLAYER ERROR:", error);
      
      if (status === "readyToPlay" && shouldPlay) {
        player.play();
      }
    });
    return () => statusSubscription?.remove?.();
  }, [player, shouldPlay]);

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      nativeControls={nativeControls}
      contentFit={contentFit}
      surfaceType={surfaceType}
      {...rest}
    />
  );
};

const styles = StyleSheet.create({
  video: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
});

export default VideoPlayer;