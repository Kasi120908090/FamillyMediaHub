import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import BottomNav from "../navigation/BottomNav";
import MenuDrawer from "../navigation/MenuDrawer";
import { useTheme } from "../../context/ThemeContext";

export default function AppScreenLayout({ ScreenComponent, screenProps }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const { theme } = useTheme();

  return (
    <View style={[styles.mainScreen, { backgroundColor: theme.background }]}>
      <View style={[styles.mainContent, { backgroundColor: theme.background }]}>
        <ScreenComponent
          {...screenProps}
          onOpenMenu={() => setMenuVisible(true)}
        />
      </View>
      <BottomNav activeTab={screenProps.route?.name} />
      <MenuDrawer
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainScreen: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },

  mainContent: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },
});
