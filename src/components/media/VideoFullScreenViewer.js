import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CachedImage from "./CachedImage";
import VideoPlayer from "./VideoPlayer";
import ZoomableMedia from "./ZoomableMedia";
import useCachedVideoUri from "../../utils/videoCache";

export default function VideoFullScreenViewer({
  visible,
  sourceUri,
  thumbnailUri,
  canDelete = false,
  onClose,
  onDelete,
  onFirstFrame,
}) {
  const openedAtRef = useRef(0);
  const firstFrameLoggedRef = useRef(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const { uri: playbackUri, loading: cacheLoading, metric: cacheMetric } = useCachedVideoUri(
    visible ? sourceUri : null
  );

  useEffect(() => {
    if (!visible || !sourceUri) {
      openedAtRef.current = 0;
      firstFrameLoggedRef.current = false;
      setHasFirstFrame(false);
      setShowCover(false);
      return undefined;
    }

    openedAtRef.current = Date.now();
    firstFrameLoggedRef.current = false;
    setHasFirstFrame(false);
    setShowCover(true);

    const coverTimer = setTimeout(() => {
      setShowCover(false);
    }, 1200);

    return () => clearTimeout(coverTimer);
  }, [sourceUri, visible]);

  useEffect(() => {
    console.log("========== DIAGNOSTIC: VideoFullScreenViewer ==========");
    console.log("SOURCE URI:", sourceUri);
    console.log("PLAYBACK URI:", playbackUri);
    console.log("CACHE LOADING:", cacheLoading);
    console.log("VISIBLE:", visible);
    console.log("CACHE METRIC:", cacheMetric);
    console.log("shouldPlay will be:", visible && !cacheLoading);
    console.log("=========================================================");
  }, [playbackUri, cacheLoading, visible, sourceUri, cacheMetric]);

  const handleFirstFrame = useCallback(() => {
    setHasFirstFrame(true);
    setShowCover(false);

    if (!firstFrameLoggedRef.current) {
      firstFrameLoggedRef.current = true;
      const timeToFirstFrameMs = openedAtRef.current ? Date.now() - openedAtRef.current : 0;
      console.log("[VideoPerf]", {
        sourceUri,
        playbackUri,
        timeToFirstFrameMs,
        cacheHit: cacheMetric?.cacheHit,
        downloadMs: cacheMetric?.downloadMs || 0,
        cacheHitRate: cacheMetric?.cacheHitRate,
      });
      onFirstFrame?.({
        timeToFirstFrameMs,
        cacheMetric,
      });
    }
  }, [cacheMetric, onFirstFrame, playbackUri, sourceUri]);

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar hidden={visible} barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
          <Ionicons name="close-circle" size={36} color="#fff" />
        </TouchableOpacity>

        {canDelete ? (
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete} activeOpacity={0.85}>
            <Ionicons name="trash" size={22} color="#FCA5A5" />
          </TouchableOpacity>
        ) : null}

        {playbackUri ? (
          <>
            <ZoomableMedia resetKey={playbackUri} style={styles.fullScreenVideo}>
              <VideoPlayer
                key={playbackUri}
                source={playbackUri}
                style={styles.fullScreenVideo}
                contentFit="contain"
                nativeControls
                fullscreen
                shouldPlay={visible && Boolean(playbackUri)}
                surfaceType="textureView"
                posterSource={thumbnailUri ? { uri: thumbnailUri } : null}
                onFirstFrameRender={handleFirstFrame}
                onPlaybackMetric={(metric) => {
                  console.log("[VideoFullScreenViewer] Playback metric received:", {
                    sourceUri,
                    playbackUri,
                    cacheHit: cacheMetric?.cacheHit,
                    downloadMs: cacheMetric?.downloadMs || 0,
                    cacheHitRate: cacheMetric?.cacheHitRate,
                    bufferingMs: metric.bufferingMs,
                    startupMs: metric.startupMs,
                  });
                }}
              />
            </ZoomableMedia>

            {((cacheLoading || showCover) && !hasFirstFrame) ? (
              <View style={styles.videoLoadingCover} pointerEvents="none">
                {thumbnailUri ? (
                  <CachedImage
                    source={{ uri: thumbnailUri }}
                    style={styles.fullScreenVideo}
                    resizeMode="contain"
                  />
                ) : null}
                <ActivityIndicator size="large" color="#fff" style={styles.videoLoadingIndicator} />
                {cacheLoading ? <Text style={styles.loadingText}>Preparing video...</Text> : null}
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.fullScreenVideo, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={styles.noVideoText}>
              {sourceUri ? `Loading video...` : `No video available`}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenVideo: {
    width: "100%",
    height: "100%",
  },
  videoLoadingCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  videoLoadingIndicator: {
    position: "absolute",
  },
  loadingText: {
    position: "absolute",
    top: "55%",
    color: "#fff",
    fontSize: 13,
  },
  noVideoText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 2,
  },
  deleteButton: {
    position: "absolute",
    top: 42,
    left: 20,
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
