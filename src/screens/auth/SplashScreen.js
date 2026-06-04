import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FamilyHeroIllustration } from "../../components/auth/FlowPrimitives";
import { useProfile } from "../../context/ProfileContext";

/**
 * SplashScreen - Persistent Login Entry Point
 * 
 * This screen appears during app startup while ProfileContext validates
 * the stored session (token & user data). It waits for bootstrap to complete
 * before routing to the appropriate screen.
 * 
 * Persistent Login Flow:
 * 1. App starts
 * 2. SplashScreen renders
 * 3. ProfileContext.bootstrapSession runs in parallel:
 *    - Reads token & user from AsyncStorage
 *    - Validates token with backend (authService.getMe)
 *    - Updates authentication state
 *    - Sets isBootstrapping = false when done
 * 4. SplashScreen waits for isBootstrapping = false
 * 5. Routes based on isAuthenticated:
 *    - ✅ Valid session → MainTabs (authenticated area)
 *    - ❌ No session or invalid → Welcome (login)
 */
export default function SplashScreen({ navigation }) {
  const { isBootstrapping, isAuthenticated, currentUser } = useProfile();

  useEffect(() => {
    // Still bootstrapping, don't navigate yet
    if (isBootstrapping) {
      console.log("[SplashScreen] Bootstrapping session...");
      return;
    }

    // Bootstrap complete, determine route based on auth state
    console.log("[SplashScreen] Bootstrap complete", {
      isAuthenticated,
      hasUser: !!currentUser?.id,
      userId: currentUser?.id,
      username: currentUser?.username,
    });

    let targetRoute = "Welcome"; // Default: show login

    if (isAuthenticated && currentUser?.id) {
      // Valid session exists - go to main app
      targetRoute = "MainTabs";
      console.log("[SplashScreen] ✅ Session valid, routing to MainTabs");
    } else {
      // No session or invalid - go to login
      console.log("[SplashScreen] ❌ No valid session, routing to Welcome");
    }

    navigation.reset({
      index: 0,
      routes: [{ name: targetRoute }],
    });
  }, [isBootstrapping, isAuthenticated, currentUser, navigation]);

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
