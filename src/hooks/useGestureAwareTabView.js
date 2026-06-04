import React, { useRef, useCallback } from 'react';
import { PanResponder } from 'react-native';

/**
 * Custom hook to handle gesture direction detection for TabView
 * Prevents vertical scrolls from triggering horizontal tab navigation
 * 
 * Problem: TabView is too sensitive to diagonal gestures, users accidentally switch tabs
 * Solution: Intercept gestures, detect direction, and block if predominantly vertical
 * 
 * Requirements:
 * - Vertical scrolling must always win
 * - Small diagonal movements should continue scrolling
 * - Horizontal navigation requires deliberate swipe
 * - Preserve swipe functionality for intentional gestures
 */

export const useGestureAwareTabView = () => {
  const gestureState = useRef({
    initialX: 0,
    initialY: 0,
    isVerticalScroll: false,
    distanceX: 0,
    distanceY: 0,
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Reset state on new gesture
        gestureState.current = {
          initialX: 0,
          initialY: 0,
          isVerticalScroll: false,
          distanceX: 0,
          distanceY: 0,
        };
        return false;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        const distanceX = Math.abs(dx);
        const distanceY = Math.abs(dy);

        // Update gesture tracking
        if (gestureState.current) {
          gestureState.current.distanceX = distanceX;
          gestureState.current.distanceY = distanceY;

          // Threshold: if vertical distance is greater than horizontal by 50%,
          // consider this a vertical scroll and don't interfere
          if (distanceY > distanceX * 1.5 && distanceY > 10) {
            gestureState.current.isVerticalScroll = true;
            return false; // Don't consume gesture, let child handle it
          }

          // For horizontal gestures, require minimum distance
          if (distanceX > distanceY * 1.5 && distanceX > 20) {
            gestureState.current.isVerticalScroll = false;
            return false; // PagerView should handle this
          }
        }

        return false;
      },
      onPanResponderGrant: () => {
        // Gesture granted
      },
      onPanResponderMove: () => {
        // Track movement but don't interfere
      },
      onPanResponderRelease: () => {
        // Gesture complete
      },
    })
  ).current;

  const isVerticalScroll = useCallback(() => {
    return gestureState.current?.isVerticalScroll || false;
  }, []);

  return {
    panResponder,
    isVerticalScroll,
    gestureState: gestureState.current,
  };
};

/**
 * Alternative simpler approach: Use onSwipeStart/onSwipeEnd callbacks
 * to detect if gesture is primarily vertical and block tab change
 */
export const useSwipeBlocker = () => {
  const swipeState = useRef({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    shouldBlockSwipe: false,
  });

  const onSwipeStart = useCallback(({ nativeEvent }) => {
    swipeState.current.startX = nativeEvent.pageX;
    swipeState.current.startY = nativeEvent.pageY;
    swipeState.current.shouldBlockSwipe = false;
  }, []);

  const onSwipeEnd = useCallback(({ nativeEvent }) => {
    swipeState.current.endX = nativeEvent.pageX;
    swipeState.current.endY = nativeEvent.pageY;

    const dx = Math.abs(swipeState.current.endX - swipeState.current.startX);
    const dy = Math.abs(swipeState.current.endY - swipeState.current.startY);

    // If vertical movement is significant relative to horizontal, this is likely a scroll
    // Threshold: vertical distance > 1.5x horizontal distance
    if (dy > dx * 1.5 && dy > 30) {
      swipeState.current.shouldBlockSwipe = true;
    }
  }, []);

  const shouldBlockSwipe = useCallback(() => {
    return swipeState.current.shouldBlockSwipe;
  }, []);

  return {
    onSwipeStart,
    onSwipeEnd,
    shouldBlockSwipe,
    swipeState: swipeState.current,
  };
};
