import React, { memo, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CachedImage from "./CachedImage";

export const ui = {
  bg: "#FBFAFF",
  purple: "#4C1DFF",
  purpleSoft: "#F1ECFF",
  ink: "#101445",
  muted: "#7377A0",
  line: "#ECE9F7",
  card: "#FFFFFF",
  danger: "#EF4444",
  success: "#22C55E",
  amber: "#F59E0B",
  cyan: "#14B8A6",
  radius: 10,
};

export const softShadow = {
  shadowColor: "#3519A8",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const formatDuration = (seconds = 0) => {
  if (!seconds || Number.isNaN(Number(seconds))) {
    return "00:30";
  }

  const total = Math.max(0, Math.floor(Number(seconds)));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
};

export const getReadableSize = (item) => {
  const bytes = Number(
    item?.size || item?.file_size || item?.fileSize || item?.bytes || 0
  );

  if (!bytes) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export const getFriendlyTitle = (item, fallback = "Memory") => {
  const raw = item?.original_file_name || item?.stored_file_name || fallback;
  return String(raw)
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || fallback;
};

export const getFileTone = (name = "", type = "") => {
  const value = `${name} ${type}`.toLowerCase();

  if (value.includes("pdf")) {
    return { icon: "document-text", color: "#EF4444", bg: "#FEE2E2", label: "PDF" };
  }
  if (value.includes("xls") || value.includes("sheet")) {
    return { icon: "grid", color: "#16A34A", bg: "#DCFCE7", label: "XLS" };
  }
  if (value.includes("doc") || value.includes("word")) {
    return { icon: "document", color: "#2563EB", bg: "#DBEAFE", label: "DOC" };
  }
  if (value.includes("zip") || value.includes("archive")) {
    return { icon: "folder", color: "#F59E0B", bg: "#FEF3C7", label: "ZIP" };
  }
  if (value.includes("ppt") || value.includes("presentation")) {
    return { icon: "easel", color: "#F97316", bg: "#FFEDD5", label: "PPT" };
  }

  return { icon: "document", color: ui.purple, bg: ui.purpleSoft, label: "FILE" };
};

export const FadeInView = memo(({ children, delay = 0, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
});

export const SearchFilterBar = memo(
  ({
    value,
    onChangeText,
    onClear,
    onFilterPress,
    placeholder = "Search memories, files, and more...",
    active = false,
  }) => (
    <View style={sharedStyles.searchRow}>
      <View style={[sharedStyles.searchBox, softShadow]}>
        <Ionicons name="search" size={15} color={ui.purple} />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#9A9CBD"
          style={sharedStyles.searchInput}
          value={value}
          onChangeText={onChangeText}
        />
        {value ? (
          <TouchableOpacity onPress={onClear} activeOpacity={0.78}>
            <Ionicons name="close-circle" size={17} color="#A6A8C6" />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={[
          sharedStyles.filterPill,
          softShadow,
          active && { backgroundColor: ui.purple },
        ]}
        onPress={onFilterPress}
        activeOpacity={0.84}
      >
        <Ionicons
          name="options-outline"
          size={16}
          color={active ? "#FFFFFF" : ui.purple}
        />
        <Text style={[sharedStyles.filterText, active && { color: "#FFFFFF" }]}>
          Filter & Sort
        </Text>
        <Ionicons
          name="chevron-down"
          size={12}
          color={active ? "#FFFFFF" : ui.purple}
        />
      </TouchableOpacity>
    </View>
  )
);

export const PlayButton = memo(({ small = false }) => (
  <View style={[sharedStyles.playButton, small && sharedStyles.playButtonSmall]}>
    <Ionicons name="play" size={small ? 11 : 15} color="#FFFFFF" />
  </View>
));

export const MediaBadge = memo(({ children, icon = "time-outline" }) => (
  <View style={sharedStyles.mediaBadge}>
    {icon ? <Ionicons name={icon} size={9} color="#FFFFFF" /> : null}
    <Text style={sharedStyles.mediaBadgeText}>{children}</Text>
  </View>
));

export const FileChip = memo(({ name, type, size, compact = false }) => {
  const tone = getFileTone(name, type);

  return (
    <View
      style={[
        compact ? sharedStyles.fileChipCompact : sharedStyles.fileChip,
        { backgroundColor: tone.bg },
      ]}
    >
      <Ionicons name={tone.icon} size={compact ? 16 : 22} color={tone.color} />
      {!compact ? (
        <>
          <Text style={[sharedStyles.fileChipName, { color: ui.ink }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={sharedStyles.fileChipSize} numberOfLines={1}>
            {size || tone.label}
          </Text>
        </>
      ) : null}
    </View>
  );
});

export const ImageTile = memo(({ uri, style, onPress, title, meta, children }) => (
  <Pressable style={[sharedStyles.imageTile, softShadow, style]} onPress={onPress}>
    <CachedImage source={{ uri }} style={sharedStyles.tileImage} resizeMode="cover" />
    <View style={sharedStyles.tileShade} />
    {title ? (
      <View style={sharedStyles.tileText}>
        <Text style={sharedStyles.tileTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? <Text style={sharedStyles.tileMeta}>{meta}</Text> : null}
      </View>
    ) : null}
    {children}
  </Pressable>
));

export const sharedStyles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: ui.line,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: ui.ink,
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 0,
  },
  filterPill: {
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: ui.line,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterText: {
    color: ui.purple,
    fontSize: 11,
    fontWeight: "800",
  },
  playButton: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.54)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginTop: -13,
  },
  mediaBadge: {
    position: "absolute",
    right: 5,
    bottom: 5,
    minHeight: 17,
    borderRadius: 5,
    paddingHorizontal: 5,
    backgroundColor: "rgba(0,0,0,0.64)",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  mediaBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  fileChip: {
    minHeight: 96,
    borderRadius: 10,
    padding: 10,
    justifyContent: "space-between",
  },
  fileChipCompact: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  fileChipName: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
  },
  fileChipSize: {
    marginTop: 4,
    color: ui.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  imageTile: {
    overflow: "hidden",
    backgroundColor: "#E7E9F5",
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  tileShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,20,69,0.08)",
  },
  tileText: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
  },
  tileTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 4,
  },
  tileMeta: {
    marginTop: 1,
    color: "rgba(255,255,255,0.82)",
    fontSize: 9,
    fontWeight: "700",
  },
});
