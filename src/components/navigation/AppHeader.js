import React, { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { useTheme } from "../../context/ThemeContext";
import { softShadow } from "../media/MediaDesign";
import logo from "../../../assets/logo.png";

const AppHeader = ({
  title,
  onOpenMenu,
  rightContent,
  rightIcon,
  onRightPress,
}) => {
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.header, { backgroundColor: theme.header }]}>
      <TouchableOpacity style={styles.headerButton} onPress={onOpenMenu}>
        <Ionicons name="menu" size={19} color={theme.primary} />
      </TouchableOpacity>

      <View style={styles.titleWrap}>
        <View style={[styles.brandMark, softShadow]}>
          <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <View style={styles.titleCopy}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      {rightContent ? (
        <View style={styles.rightCluster}>
          <TouchableOpacity
            style={[styles.headerButton, styles.bellButton]}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.82}
          >
            <Ionicons name="notifications-outline" size={18} color={theme.primary} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          <View style={styles.rightSlot}>{rightContent}</View>
        </View>
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
    paddingBottom: 10,
    paddingTop: 42,
    gap: 8,
  },

  headerButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },

  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#4C1DFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  brandLogo: {
    width: 22,
    height: 22,
  },

  titleCopy: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    textAlign: "left",
  },

  rightSlot: {
    minWidth: 30,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bellButton: {
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    right: 6,
    top: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF3D7F",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});
