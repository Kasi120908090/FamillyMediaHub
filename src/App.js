import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableFreeze, enableScreens } from "react-native-screens";
import StackNavigator from "./navigation/StackNavigator";
import { ProfileProvider, useProfile } from "./context/ProfileContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { useBackupAutoSync } from "./hooks/useBackupAutoSync";
import {
  discoverBackend,
  watchBackendNetworkChanges,
} from "./services/backendDiscoveryService";

enableScreens(true);
enableFreeze(true);

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

function BackendGate({ children }) {
  const [status, setStatus] = React.useState("scanning");
  const [message, setMessage] = React.useState("Scanning this Wi-Fi for backend...");
  const [progress, setProgress] = React.useState({ checked: 0, total: 254 });
  const [networkDetails, setNetworkDetails] = React.useState({ ipAddress: "", subnet: "" });

  const runDiscovery = React.useCallback(async () => {
    setStatus("scanning");
    setMessage("Scanning this Wi-Fi for backend...");
    setProgress({ checked: 0, total: 254 });

    try {
      const result = await discoverBackend({
        force: true,
        onProgress: (nextProgress) => setProgress(nextProgress),
      });

      if (result.baseUrl) {
        setStatus("found");
        setMessage("");
      } else {
        setStatus("not-found");
        setMessage(result.message || "Backend not found on this Wi-Fi");
      }

      setNetworkDetails({
        ipAddress: result.ipAddress || "",
        subnet: result.subnet || "",
      });
    } catch {
      setStatus("not-found");
      setMessage("Backend not found on this Wi-Fi");
    }
  }, []);

  React.useEffect(() => {
    runDiscovery();

    const unsubscribe = watchBackendNetworkChanges(
      (result) => {
        if (result?.baseUrl) {
          setStatus("found");
          setMessage("");
        } else {
          setStatus("not-found");
          setMessage("Backend not found on this Wi-Fi");
        }

        setNetworkDetails({
          ipAddress: result?.ipAddress || "",
          subnet: result?.subnet || "",
        });
      },
      () => {
        setStatus("scanning");
        setMessage("Wi-Fi changed. Scanning again...");
        setProgress({ checked: 0, total: 254 });
      },
      (nextProgress) => setProgress(nextProgress)
    );

    return unsubscribe;
  }, [runDiscovery]);

  if (status === "found") {
    return children;
  }

  return (
    <View style={styles.backendGate}>
      <View style={styles.backendCard}>
        {status === "scanning" ? (
          <ActivityIndicator size="large" color="#5A23E5" />
        ) : null}
        <Text style={styles.backendTitle}>
          {status === "scanning" ? "Finding backend" : "Backend not found on this Wi-Fi"}
        </Text>
        <Text style={styles.backendMessage}>
          {status === "scanning"
            ? `${message} ${Math.min(progress.checked || 0, progress.total || 254)}/${
                progress.total || 254
              }`
            : message}
        </Text>
        {networkDetails.ipAddress || progress.subnet ? (
          <Text style={styles.backendDetails}>
            Phone IP: {networkDetails.ipAddress || "checking..."}{"\n"}
            Scanning: {networkDetails.subnet || progress.subnet || "checking..."}.1-254:8000
          </Text>
        ) : null}
        {status === "not-found" ? (
          <TouchableOpacity style={styles.retryButton} onPress={runDiscovery} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Scan Again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <BackendGate>
            <ProfileProvider>
              <BackupAutoSyncController />
              <ThemedNavigation />
            </ProfileProvider>
          </BackendGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  backendGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FCF9FF",
  },
  backendCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F2EAFF",
  },
  backendTitle: {
    marginTop: 14,
    color: "#2D158B",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  backendMessage: {
    marginTop: 8,
    color: "#8C80B8",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  backendDetails: {
    marginTop: 10,
    color: "#5F5488",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5A23E5",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
