import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
  TapGestureHandler,
} from "react-native-gesture-handler";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP_SCALE = 0.75;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function ZoomableMedia({
  children,
  style,
  contentStyle,
  resetKey,
  onZoomChange,
  controls = true,
}) {
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const doubleTapRef = useRef(null);
  const baseScale = useRef(new Animated.Value(MIN_SCALE)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(MIN_SCALE);
  const lastTranslate = useRef({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(MIN_SCALE);

  const setZoom = (nextScale) => {
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    lastScale.current = scale;
    setZoomLevel(scale);
    onZoomChange?.(scale);

    Animated.spring(baseScale, {
      toValue: scale,
      useNativeDriver: true,
      speed: 18,
      bounciness: 0,
    }).start();

    pinchScale.setValue(1);

    if (scale <= MIN_SCALE) {
      lastTranslate.current = { x: 0, y: 0 };
      translateX.setOffset(0);
      translateY.setOffset(0);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 0,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 0,
        }),
      ]).start();
    }
  };

  useEffect(() => {
    setZoom(MIN_SCALE);
  }, [resetKey]);

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPanGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
          translationY: translateY,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const handlePinchStateChange = ({ nativeEvent }) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      setZoom(lastScale.current * nativeEvent.scale);
    }
  };

  const handlePanStateChange = ({ nativeEvent }) => {
    if (nativeEvent.oldState !== State.ACTIVE) {
      return;
    }

    if (lastScale.current <= MIN_SCALE) {
      lastTranslate.current = { x: 0, y: 0 };
      translateX.setValue(0);
      translateY.setValue(0);
      return;
    }

    lastTranslate.current = {
      x: lastTranslate.current.x + nativeEvent.translationX,
      y: lastTranslate.current.y + nativeEvent.translationY,
    };
    translateX.setOffset(lastTranslate.current.x);
    translateX.setValue(0);
    translateY.setOffset(lastTranslate.current.y);
    translateY.setValue(0);
  };

  const handleDoubleTap = ({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      setZoom(lastScale.current > MIN_SCALE ? MIN_SCALE : 2);
    }
  };

  const scale = Animated.multiply(baseScale, pinchScale).interpolate({
    inputRange: [MIN_SCALE, MAX_SCALE],
    outputRange: [MIN_SCALE, MAX_SCALE],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, style]}>
      <PinchGestureHandler
        ref={pinchRef}
        simultaneousHandlers={[panRef, doubleTapRef]}
        onGestureEvent={onPinchGestureEvent}
        onHandlerStateChange={handlePinchStateChange}
      >
        <Animated.View style={styles.fill}>
          <PanGestureHandler
            ref={panRef}
            enabled={zoomLevel > MIN_SCALE}
            simultaneousHandlers={[pinchRef]}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={handlePanStateChange}
          >
            <Animated.View style={styles.fill}>
              <TapGestureHandler
                ref={doubleTapRef}
                numberOfTaps={2}
                simultaneousHandlers={[pinchRef]}
                onHandlerStateChange={handleDoubleTap}
              >
                <Animated.View
                  style={[
                    styles.content,
                    contentStyle,
                    {
                      transform: [
                        { translateX },
                        { translateY },
                        { scale },
                      ],
                    },
                  ]}
                >
                  {children}
                </Animated.View>
              </TapGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>

      {controls ? (
        <View style={styles.controls}>
          <ZoomButton icon="remove" onPress={() => setZoom(zoomLevel - STEP_SCALE)} />
          <ZoomButton icon="scan" onPress={() => setZoom(MIN_SCALE)} />
          <ZoomButton icon="add" onPress={() => setZoom(zoomLevel + STEP_SCALE)} />
        </View>
      ) : null}
    </View>
  );
}

const ZoomButton = ({ icon, onPress }) => (
  <TouchableOpacity style={styles.controlButton} onPress={onPress} activeOpacity={0.78}>
    <Ionicons name={icon} size={18} color="#fff" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    position: "absolute",
    right: 14,
    bottom: 106,
    zIndex: 4,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(17,24,39,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  controlButton: {
    width: 44,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
});
