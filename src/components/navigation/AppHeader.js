import React, { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { useTheme } from "../../context/ThemeContext";
import logo from "../../../assets/logo.png";

const AppHeader = ({
  title,
  onOpenMenu,
  rightContent,
  rightIcon,
  onRightPress,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.header }]}>
      <TouchableOpacity style={styles.headerButton} onPress={onOpenMenu}>
        <Ionicons name="menu" size={22} color={theme.text} />
      </TouchableOpacity>

      <View style={styles.titleWrap}>
        <View style={styles.brandMark}>
          <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <View style={styles.titleCopy}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.subText }]} numberOfLines={1}>
            Your family. Your memories. Together.
          </Text>
        </View>
      </View>

      {rightContent ? (
        <View style={styles.rightSlot}>{rightContent}</View>
      ) : rightIcon ? (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onRightPress}
          disabled={!onRightPress}
        >
          <Ionicons name={rightIcon} size={20} color={theme.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerButton} />
      )}
    </View>
  );
};

export default memo(AppHeader);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingVertical: 14,
    paddingTop: 34,
    gap: 10,
  },

  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#4E1FDE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  brandLogo: {
    width: 18,
    height: 18,
  },

  titleCopy: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
    textAlign: "left",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: "500",
  },

  rightSlot: {
    minWidth: 36,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
