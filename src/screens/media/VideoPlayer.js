import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { VideoView } from "expo-video";

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
  const videoSourceUri =
    typeof source === "string"
      ? source
      : source?.uri;

  if (!videoSourceUri) {
    return (
      <View style={[styles.video, style, styles.errorContainer]}>
        <Text style={styles.errorText}>
          Invalid video source
        </Text>
      </View>
    );
  }

  return (
    <VideoView
      source={videoSourceUri}
      style={[styles.video, style]}

      shouldPlay={shouldPlay}
      nativeControls={nativeControls}

      contentFit={contentFit}
      surfaceType={surfaceType}

      posterSource={posterSource}

      onFirstFrameRender={onFirstFrameRender}

      {...rest}
    />
  );
};

const styles = StyleSheet.create({
  video: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
  },

  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
  },

  errorText: {
    color: "#fff",
  },
});

export default VideoPlayer;