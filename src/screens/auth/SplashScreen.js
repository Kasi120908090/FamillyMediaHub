import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FamilyHeroIllustration } from "../../components/auth/FlowPrimitives";

const PROFILE_CACHE_KEY = "@family-media-hub/profile-options";
const TOKEN_STORAGE_KEY = "@family-media-hub/token";
const USER_STORAGE_KEY = "@family-media-hub/user";

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const [[, cachedProfiles], [, storedToken], [, storedUser]] = await AsyncStorage.multiGet([
          PROFILE_CACHE_KEY,
          TOKEN_STORAGE_KEY,
          USER_STORAGE_KEY,
        ]);

        if (!isMounted) {
          return;
        }

        const parsedProfiles = JSON.parse(cachedProfiles || "[]");
        const hasCachedProfiles = Array.isArray(parsedProfiles) && parsedProfiles.length > 0;
        const hasSession = Boolean(storedToken && storedUser);

        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: hasCachedProfiles || hasSession ? "AuthProfile" : "Welcome" }],
          });
        }, 900);
      } catch {
        if (!isMounted) {
          return;
        }

        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: "Welcome" }],
          });
        }, 900);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <View style={styles.card}>
        <FamilyHeroIllustration />
        <Text style={styles.title}>Family Media Hub</Text>
        <Text style={styles.subtitle}>Loading your family space...</Text>
        <ActivityIndicator size="small" color="#5A23E5" style={styles.loader} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FCF9FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(129, 99, 255, 0.12)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#F2EAFF",
    shadowColor: "#7C4DFF",
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: "900",
    color: "#2D158B",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: "#8C80B8",
  },
  loader: {
    marginTop: 18,
  },
});
