import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { getThemedAvatarUri } from "../../utils/avatar";

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "FH";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getTextColor = (hex = "#2563EB") => {
  const safeHex = hex.replace("#", "");
  const r = parseInt(safeHex.substring(0, 2), 16);
  const g = parseInt(safeHex.substring(2, 4), 16);
  const b = parseInt(safeHex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7 ? "#000" : "#fff";
};

export default function ThemedAvatar({ uri, name, style }) {
  const { theme } = useTheme();
  const showInitials = !uri || uri.includes("ui-avatars.com/api");
  const initials = getInitials(name);
  const initialsColor = getTextColor(theme.primary);

  if (showInitials) {
    return (
      <View style={[styles.avatar, { backgroundColor: theme.primary }, style]}>
        <Text style={[styles.initials, { color: initialsColor }]}>{initials}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: getThemedAvatarUri(uri, name, theme.primary) }}
      style={[styles.avatar, { backgroundColor: theme.primary }, style]}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontWeight: "700",
    fontSize: 24,
  },
});
