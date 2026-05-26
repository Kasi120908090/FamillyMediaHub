import React from "react";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import StackNavigator from "./navigation/StackNavigator";
import { ProfileProvider, useProfile } from "./context/ProfileContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { useBackupAutoSync } from "./hooks/useBackupAutoSync";

function BackupAutoSyncController() {
  const { authToken, currentUser, parentDevices, refreshDevices } = useProfile();

  useBackupAutoSync({ authToken, currentUser, parentDevices, refreshDevices });

  return null;
}

function ThemedNavigation() {
  const { theme } = useTheme();
  const baseNavigationTheme = theme.isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNavigationTheme,
    dark: Boolean(theme.isDark),
    colors: {
      ...baseNavigationTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.header,
      text: theme.text,
      border: theme.border,
      notification: theme.accent,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StackNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ProfileProvider>
            <BackupAutoSyncController />
            <ThemedNavigation />
          </ProfileProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
