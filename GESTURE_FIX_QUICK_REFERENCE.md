# TabView Gesture Fix - Quick Reference

## What Was Fixed

TabView in Gallery/Images/Videos/Files screens was too sensitive to vertical scrolling. Users accidentally switched tabs when scrolling through media lists.

**Solution**: Implemented intelligent gesture direction detection that:
- Disables horizontal swipe during vertical scrolling
- Enables horizontal swipe for deliberate lateral movements  
- Preserves all swipe navigation functionality

## How to Test

### Vertical Scroll Test (Should NOT switch tabs)
1. Open Gallery, Images, Videos, or Files screen
2. Scroll vertically up/down through media
3. ✅ Verify tabs remain on current tab
4. ✅ Media list scrolls normally

### Horizontal Swipe Test (Should still switch tabs)
1. On any media tab, swipe deliberately left or right
2. ✅ Verify tab switches smoothly
3. ✅ Animation plays normally

### Edge Cases
1. **Fast vertical swipe**: Swipe up/down quickly - tabs should not switch
2. **Diagonal movement**: Move diagonally - should prioritize vertical if more vertical than horizontal
3. **Slow horizontal drag**: Drag slowly left/right - should still switch tabs if >30px horizontal movement
4. **Touch and hold**: Touch and hold on media - should not switch tabs

## Technical Details

### Configuration Constants

Located in [src/navigation/StackNavigator.js](src/navigation/StackNavigator.js) in the `MediaTabs` component.

**Gesture thresholds** (lines ~345-355):

```javascript
const dy = Math.abs(pageY - gestureStateRef.current.startY);
const dx = Math.abs(pageX - gestureStateRef.current.startX);

if (dy > dx * 1.5 && dy > 10) {
  // VERTICAL SCROLL (current values: ratio=1.5, min=10px)
  setSwipeEnabledState(false);
}
else if (dx > dy * 1.5 && dx > 30) {
  // HORIZONTAL SWIPE (current values: ratio=1.5, min=30px)  
  setSwipeEnabledState(true);
}
```

### Adjusting Sensitivity

To make vertical scroll detection **more aggressive** (block swipes more easily):
- Decrease `dy > dx * 1.5` ratio (e.g., `1.2` requires only 120% vertical)
- Decrease `dy > 10` minimum (e.g., `5` triggers on smaller movements)

To make vertical scroll detection **more lenient** (allow more diagonal swipes):
- Increase `dy > dx * 1.5` ratio (e.g., `2.0` requires 200% vertical)
- Increase `dy > 10` minimum (e.g., `20` requires larger movements)

## Debug Information

### Console Logs

The implementation logs all gesture events. In React Native debugger, look for:

```
[Gesture] Vertical scroll detected, disabling swipe {dx: 50, dy: 250, ratio: 5}
[Gesture] Horizontal swipe detected, enabling swipe {dx: 150, dy: 40}
```

**Enable logging**:
- Remote debug: `react-native log-android` or `react-native log-ios`
- Or view in React Native Debugger console

### Disabled Debug Logs

To remove logging for production:

In [src/navigation/StackNavigator.js](src/navigation/StackNavigator.js), comment out or remove:

```javascript
// Line ~210
// console.log("[Gesture] Swipe start at", { x: pageX, y: pageY });

// Lines ~233-238
// console.log("[Gesture] Swipe end", { dx, dy, isVertical, ratio: ... });

// Lines ~341-342
// console.log("[Gesture] Vertical scroll detected, disabling swipe", { dx, dy, ... });

// Lines ~347-348
// console.log("[Gesture] Horizontal swipe detected, enabling swipe", { dx, dy });
```

## Key Implementation Points

### 1. Touch Handler Priority
```
User Touch
  ↓
Parent View (StackNavigator.js)
  ├─ onTouchStart (capture coordinates)
  ├─ onTouchMove (analyze direction)
  └─ onTouchEnd (reset state)
  ↓
TabView
  ├─ Receives swipeEnabled={swipeEnabledState}
  └─ Gesture processed based on enabled state
```

### 2. State Management
- `gestureStateRef`: Tracks coordinates during touch (ref for performance)
- `swipeEnabledState`: Controls TabView swipe prop (state for re-rendering)
- Both are reset after touch ends to prepare for next gesture

### 3. Why This Approach Works
- **Early interception**: Touch handlers run before TabView gestures
- **Stateful control**: TabView respects `swipeEnabled` prop throughout gesture
- **Performance**: Simple math calculations, no expensive computations
- **Compatibility**: Works with existing child components (FlatList, ScrollView)

## Troubleshooting

### Issue: Tabs still switching accidentally
1. Check React Native debugger - are `[Gesture]` logs showing?
2. Verify `swipeEnabledState` is being set to `false`
3. Reduce ratio from `1.5` to `1.2` for more aggressive vertical detection
4. Increase minimum vertical distance from `10` to `15` or `20`

### Issue: Can't swipe between tabs
1. Check if `swipeEnabled={swipeEnabledState}` is correctly passed to TabView
2. Verify horizontal swipe distance is > 30px (increase from device borders)
3. Check `[Gesture]` logs - should show "Horizontal swipe detected"
4. Reduce minimum horizontal distance from `30` to `20`

### Issue: Performance issues / frame drops
1. Gesture handling uses touch event listeners - typically <1ms per event
2. If issue persists, check other performance bottlenecks
3. Consider removing console.log statements for production

## Related Files

- Main implementation: [src/navigation/StackNavigator.js](src/navigation/StackNavigator.js)
- Reference implementations (not used):
  - [src/hooks/useGestureAwareTabView.js](src/hooks/useGestureAwareTabView.js)
  - [src/components/GestureAwareTabViewWrapper.js](src/components/GestureAwareTabViewWrapper.js)
- Analysis: [GESTURE_FIX_ANALYSIS.md](GESTURE_FIX_ANALYSIS.md)

## Questions?

Refer to:
1. Console logs with `[Gesture]` prefix for real-time behavior
2. Distance metrics to understand what triggered enable/disable
3. Adjust thresholds based on observed behavior
