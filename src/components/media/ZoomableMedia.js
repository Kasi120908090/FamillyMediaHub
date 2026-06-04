import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import {
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from "react-native-gesture-handler";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
const SWIPE_DOWN_THRESHOLD = 120;
const SWIPE_DOWN_MAX_X_DELTA = 100;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function ZoomableMedia({
  children,
  style,
  contentStyle,
  resetKey,
  onZoomChange,
  onSwipeDown,
  controls = true,
}) {
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = useRef(
    Animated.multiply(baseScale, pinchScale).interpolate({
      inputRange: [MIN_SCALE, MAX_SCALE],
      outputRange: [MIN_SCALE, MAX_SCALE],
      extrapolate: "clamp",
    })
  ).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastScale = useRef(1);
  const lastPan = useRef({ x: 0, y: 0 });
  const containerSize = useRef({ width: 0, height: 0 }).current;
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const doubleTapRef = useRef(null);

  useEffect(() => {
    baseScale.setValue(1);
    pinchScale.setValue(1);
    lastScale.current = 1;
    lastPan.current = { x: 0, y: 0 };
    Animated.parallel([
      Animated.spring(pan.x, { toValue: 0, useNativeDriver: true }),
      Animated.spring(pan.y, { toValue: 0, useNativeDriver: true }),
    ]).start();

    onZoomChange?.(1);
  }, [resetKey, onZoomChange]);

  const onLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    containerSize.width = width;
    containerSize.height = height;
  };

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = ({ nativeEvent }) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      const { focalX, focalY, scale: gestureScale } = nativeEvent;
      const nextScale = clamp(lastScale.current * gestureScale, MIN_SCALE, MAX_SCALE);

      // Calculate the focal point relative to the center of the view
      // This allows us to adjust the pan so the zoom follows the fingers
      if (nextScale > MIN_SCALE && containerSize.width > 0 && focalX !== undefined) {
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;

        // Offset the pan by the distance from center * the change in scale
        lastPan.current.x += (focalX - centerX) * (1 - gestureScale);
        lastPan.current.y += (focalY - centerY) * (1 - gestureScale);

        pan.setOffset(lastPan.current);
        pan.setValue({ x: 0, y: 0 });
      }

      lastScale.current = nextScale;
      baseScale.setValue(nextScale);
      pinchScale.setValue(1);

      if (nextScale <= MIN_SCALE) {
        lastPan.current = { x: 0, y: 0 };
        Animated.parallel([
          Animated.spring(pan.x, { toValue: 0, useNativeDriver: true }),
          Animated.spring(pan.y, { toValue: 0, useNativeDriver: true }),
        ]).start(() => {
          pan.setOffset({ x: 0, y: 0 });
          pan.setValue({ x: 0, y: 0 });
        });
      }

      onZoomChange?.(nextScale > MIN_SCALE ? nextScale : 1);
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: pan.x, translationY: pan.y } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.BEGAN) {
      pan.setOffset(lastPan.current);
      pan.setValue({ x: 0, y: 0 });
    }

    if (nativeEvent.oldState === State.ACTIVE) {
      const translationX = nativeEvent.translationX;
      const translationY = nativeEvent.translationY;
      const totalX = lastPan.current.x + translationX;
      const totalY = lastPan.current.y + translationY;

      if (lastScale.current <= MIN_SCALE) {
        if (
          onSwipeDown &&
          translationY > SWIPE_DOWN_THRESHOLD &&
          Math.abs(translationX) < SWIPE_DOWN_MAX_X_DELTA
        ) {
          onSwipeDown();
          return;
        }

        lastPan.current = { x: 0, y: 0 };
        Animated.parallel([
          Animated.spring(pan.x, { toValue: 0, useNativeDriver: true }),
          Animated.spring(pan.y, { toValue: 0, useNativeDriver: true }),
        ]).start(() => {
          pan.setOffset({ x: 0, y: 0 });
          pan.setValue({ x: 0, y: 0 });
        });
      } else {
        lastPan.current = { x: totalX, y: totalY };
        pan.setOffset(lastPan.current);
        pan.setValue({ x: 0, y: 0 });
      }
    }
  };

  const onDoubleTapStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state !== State.ACTIVE) {
      return;
    }

    const nextScale = lastScale.current > MIN_SCALE ? MIN_SCALE : DOUBLE_TAP_SCALE;
    lastScale.current = nextScale;
    Animated.spring(baseScale, { toValue: nextScale, useNativeDriver: true }).start(() => {
      if (nextScale <= MIN_SCALE) {
        lastPan.current = { x: 0, y: 0 };
        Animated.parallel([
          Animated.spring(pan.x, { toValue: 0, useNativeDriver: true }),
          Animated.spring(pan.y, { toValue: 0, useNativeDriver: true }),
        ]).start(() => {
          pan.setOffset({ x: 0, y: 0 });
          pan.setValue({ x: 0, y: 0 });
        });
      }
    });

    onZoomChange?.(nextScale > MIN_SCALE ? nextScale : 1);
  };

  const animatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale },
    ],
  };

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <PinchGestureHandler
        ref={pinchRef}
        simultaneousHandlers={[panRef, doubleTapRef]}
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
        minPointers={2}
      >
        <Animated.View style={styles.fill}>
          <PanGestureHandler
            ref={panRef}
            simultaneousHandlers={[pinchRef, doubleTapRef]}
            onGestureEvent={onPanEvent}
            onHandlerStateChange={onPanStateChange}
            minPointers={1}
            maxPointers={2}
            activeOffsetX={[-10, 10]}
            activeOffsetY={[-10, 10]}
          >
            <Animated.View style={styles.fill}>
              <TapGestureHandler
                ref={doubleTapRef}
                numberOfTaps={2}
                simultaneousHandlers={[pinchRef, panRef]}
                onHandlerStateChange={onDoubleTapStateChange}
              >
                <Animated.View style={[styles.content, contentStyle, animatedStyle]}>
                  {children}
                </Animated.View>
              </TapGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>
      {controls ? <View style={styles.controls} /> : null}
    </View>
  );
}

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
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    overflow: "hidden",
    backgroundColor: "rgba(17,24,39,0.78)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.16)",
  },
});
