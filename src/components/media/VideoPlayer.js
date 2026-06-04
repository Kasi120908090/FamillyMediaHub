import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { getVideoSource } from "../../utils/media";
import { Ionicons } from "@expo/vector-icons";

export default function VideoPlayer({
  source,
  style,
  contentFit = "cover",
  nativeControls = true,
  allowsFullscreen = true,
  fullscreen,
  fullscreenOptions,
  surfaceType,
  loop = false,
  muted = false,
  posterSource = null,
  shouldPlay = false,
  onFirstFrameRender,
  onPlaybackMetric,
}) {
  const playbackStartedAtRef = React.useRef(0);
  const bufferingStartedAtRef = React.useRef(0);
  const bufferingMsRef = React.useRef(0);
  const resolvedFullscreenOptions =
    fullscreenOptions ?? { enable: fullscreen ?? allowsFullscreen };
  const videoSource = useMemo(() => getVideoSource(source), [source]);
  const player = useVideoPlayer(videoSource, (videoPlayer) => {
    videoPlayer.loop = loop;
    videoPlayer.muted = muted;
    videoPlayer.bufferOptions = {
      preferredForwardBufferDuration: 3,
      minBufferForPlayback: 1,
      waitsToMinimizeStalling: false,
    };
    videoPlayer.timeUpdateEventInterval = 0.5;
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    console.log("========== DIAGNOSTIC: VideoPlayer ==========");
    console.log("VIDEO SOURCE (input):", source);
    console.log("RESOLVED VIDEO SOURCE:", videoSource);
    console.log("SHOULD PLAY:", shouldPlay);
    console.log("==========================================");
  }, [videoSource, source, shouldPlay]);

  useEffect(() => {
    player.loop = loop;
    player.muted = muted;

    if (shouldPlay && videoSource) {
      playbackStartedAtRef.current = Date.now();
      bufferingStartedAtRef.current = Date.now();
      bufferingMsRef.current = 0;
      
      console.log("[VideoPlayer] shouldPlay=true, attempting playback", { videoSource });

      // Try to start playback immediately and retry a few times if it doesn't start.
      // This helps on Android when the player may not be attached to the view yet
      // when the modal opens.
      try {
        console.log("[VideoPlayer] Initial play() call");
        player.play();
      } catch (e) {
        console.log("[VideoPlayer] Initial play() error:", e?.message);
      }

      let attempts = 0;
      const maxAttempts = 8;
      const retryInterval = setInterval(() => {
        attempts += 1;
        try {
          if (player.playing) {
            console.log("[VideoPlayer] Player is now playing, stopping retries");
            clearInterval(retryInterval);
            return;
          }
          console.log(`[VideoPlayer] Retry attempt ${attempts}/${maxAttempts} to play()`);
          player.play();
        } catch (e) {
          console.log(`[VideoPlayer] Retry ${attempts} failed:`, e?.message);
        }

        if (attempts >= maxAttempts) {
          console.log("[VideoPlayer] Max retries reached");
          clearInterval(retryInterval);
        }
      }, 200);

      return () => {
        clearInterval(retryInterval);
      };
    } else {
      console.log("[VideoPlayer] shouldPlay=false or no videoSource, pausing", { shouldPlay, videoSource });
      player.pause();
    }
  }, [loop, muted, player, shouldPlay, videoSource]);

  useEffect(() => {
    setErrorMessage("");
    setIsPlaying(Boolean(player.playing));
    console.log("[VideoPlayer] useEffect - Initial player state", { videoSource, shouldPlay, isPlaying: player.playing });

    const playingSubscription = player.addListener?.("playingChange", ({ isPlaying: nextIsPlaying }) => {
      console.log("[VideoPlayer] playingChange event:", nextIsPlaying);
      setIsPlaying(Boolean(nextIsPlaying));
    });

    const statusSubscription = player.addListener?.("statusChange", ({ status, error }) => {
      console.log("========== DIAGNOSTIC: Player Status Change ==========");
      console.log("PLAYER STATUS:", status);
      console.log("PLAYER ERROR:", error);
      console.log("PLAYER PLAYING:", player.playing);
      console.log("SHOULD PLAY:", shouldPlay);
      console.log("====================================================");

      if (status === "readyToPlay" && shouldPlay) {
        if (bufferingStartedAtRef.current) {
          bufferingMsRef.current += Date.now() - bufferingStartedAtRef.current;
          bufferingStartedAtRef.current = 0;
        }
        onPlaybackMetric?.({
          type: "readyToPlay",
          bufferingMs: bufferingMsRef.current,
          startupMs: playbackStartedAtRef.current ? Date.now() - playbackStartedAtRef.current : 0,
        });
        player.play();
      }

      if (status === "loading" && !bufferingStartedAtRef.current) {
        console.log("[VideoPlayer] Loading started");
        bufferingStartedAtRef.current = Date.now();
      }

      if (status === "error") {
        console.log("[VideoPlayer] Video playback error", error?.message || error);
        setErrorMessage(error?.message || "Unable to play this video.");
      }
    });

    return () => {
      playingSubscription?.remove?.();
      statusSubscription?.remove?.();
    };
  }, [player, shouldPlay]);

  if (!videoSource) {
    console.log("[VideoPlayer] Rendering fallback - no videoSource", { source });
    return <View style={[styles.fallback, style]} />;
  }

  console.log("[VideoPlayer] Rendering VideoView", { videoSource, shouldPlay });

  return (
    <View style={[styles.wrap, style]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        nativeControls={nativeControls}
        posterSource={posterSource}
        fullscreenOptions={resolvedFullscreenOptions}
        surfaceType={surfaceType}
        allowsPictureInPicture
        startsPictureInPictureAutomatically={false}
        useExoShutter={false}
        onFirstFrameRender={onFirstFrameRender}
      />

      {!nativeControls && (
        <View style={styles.controlsOverlay}>
          <TouchableOpacity
            onPress={() => isPlaying ? player.pause() : player.play()}
            style={styles.controlButton}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={42}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      )}

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
    flex: 1,
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
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
});
