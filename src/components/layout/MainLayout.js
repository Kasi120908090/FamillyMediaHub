import React from "react";
import { StyleSheet, View } from "react-native";
import BottomNav from "../navigation/BottomNav";
import { useTheme } from "../../context/ThemeContext";

/**
 * MainLayout provides a consistent wrapper for screens,
 * ensuring the BottomNav is always present and correctly positioned.
 */
export default function MainLayout({ children }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>{children}</View>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },
  content: {
    flex: 1, // Occupies all available space above the BottomNav
  },
});
