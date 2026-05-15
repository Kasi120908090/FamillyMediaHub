import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/navigation/AppHeader";
import { useTheme } from "../../context/ThemeContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

export default function AppearanceScreen({ onOpenMenu }) {
  const { theme, themes, themeName, changeTheme } = useTheme();
  const activeTheme = themes[themeName] || theme;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView showsVerticalScrollIndicator={false}>
        <AppHeader title="Appearance" onOpenMenu={onOpenMenu} />

        <View style={styles.content}>
          <Text style={[styles.description, { color: theme.subText }]}>Select the theme you want to apply for the app.</Text>

          <View style={[styles.card, { backgroundColor: theme.card }]}> 
            {Object.values(themes).map((option) => {
              const selected = themeName === option.id;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? theme.iconBg : theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                  activeOpacity={0.78}
                  onPress={() => changeTheme(option.id)}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.themePreview, { backgroundColor: option.background }]}>
                      <View style={[styles.themePreviewCard, { backgroundColor: option.card }]} />
                      <View style={[styles.themePreviewAccent, { backgroundColor: option.primary }]} />
                    </View>
                    <View>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>{option.name || option.id}</Text>
                      <Text style={[styles.optionSub, { color: theme.subText }]}>Tap to apply the {option.name || option.id} theme</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={selected ? theme.primary : theme.subText}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.currentThemeRow}>
            <Text style={[styles.currentThemeLabel, { color: theme.subText }]}>Current theme</Text>
            <Text style={[styles.currentThemeValue, { color: theme.text }]}>{activeTheme.name || activeTheme.id}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SCREEN_HORIZONTAL_PADDING, paddingTop: 10, paddingBottom: 20 },
  description: { marginBottom: 14, fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 16, padding: 14, gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  themePreview: {
    width: 40,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  themePreviewCard: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    height: 10,
    borderRadius: 4,
  },
  themePreviewAccent: {
    position: "absolute",
    top: 6,
    left: 8,
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  optionTitle: { fontSize: 15, fontWeight: "700" },
  optionSub: { fontSize: 12, marginTop: 4 },
  currentThemeRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  currentThemeLabel: { fontSize: 13 },
  currentThemeValue: { fontSize: 14, fontWeight: "700" },
});
