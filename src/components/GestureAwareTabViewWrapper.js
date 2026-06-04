import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Dimensions } from 'react-native';

/**
 * GestureAwareTabViewWrapper
 * 
 * This wrapper prevents TabView from being too sensitive to vertical scrolls
 * by detecting gesture direction and dynamically controlling swipe behavior.
 * 
 * How it works:
 * 1. Tracks touch events at the wrapper level
 * 2. Measures gesture direction as the user's finger moves
 * 3. If movement is predominantly vertical (>1.5x ratio), disables horizontal swipe
 * 4. Restores swipe for intentional horizontal gestures (>30px horizontal movement)
 * 5. Resets state when gesture ends
 */
export const GestureAwareTabViewWrapper = React.forwardRef(
  ({ children, onSwipeEnabledChange }, ref) => {
    const [swipeEnabled, setSwipeEnabled] = useState(true);
    const gestureRef = useRef({
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      isTracking: false,
    });

    const resetGesture = useCallback(() => {
      gestureRef.current = {
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        isTracking: false,
      };
      setSwipeEnabled(true);
    }, []);

    const handleTouchStart = useCallback((e) => {
      const { pageX, pageY } = e.nativeEvent;
      gestureRef.current.startX = pageX;
      gestureRef.current.startY = pageY;
      gestureRef.current.currentX = pageX;
      gestureRef.current.currentY = pageY;
      gestureRef.current.isTracking = true;
      setSwipeEnabled(true);
    }, []);

    const handleTouchMove = useCallback((e) => {
      if (!gestureRef.current.isTracking) return;

      const { pageX, pageY } = e.nativeEvent;
      gestureRef.current.currentX = pageX;
      gestureRef.current.currentY = pageY;

      const dx = Math.abs(pageX - gestureRef.current.startX);
      const dy = Math.abs(pageY - gestureRef.current.startY);

      // IMPORTANT: Detect gesture direction
      // If vertical movement is significantly larger than horizontal, 
      // disable swipe to let child components (FlatList, ScrollView) handle vertical scrolling
      if (dy > dx * 1.5 && dy > 10) {
        // This is a vertical scroll - disable TabView swipe
        setSwipeEnabled(false);
      } else if (dx > 30) {
        // Deliberate horizontal movement - enable swipe
        setSwipeEnabled(true);
      }
    }, []);

    const handleTouchEnd = useCallback((e) => {
      // On touch end, reset and re-enable swipe for next gesture
      setTimeout(() => {
        resetGesture();
      }, 50);
    }, [resetGesture]);

    // Notify parent when swipe enabled state changes
    useEffect(() => {
      onSwipeEnabledChange?.(swipeEnabled);
    }, [swipeEnabled, onSwipeEnabledChange]);

    // Clone children and pass swipeEnabled state
    const enhancedChildren = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, {
          swipeEnabled,
        });
      }
      return child;
    });

    return (
      <View
        ref={ref}
        style={{ flex: 1 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {enhancedChildren}
      </View>
    );
  }
);

GestureAwareTabViewWrapper.displayName = 'GestureAwareTabViewWrapper';

export default GestureAwareTabViewWrapper;
