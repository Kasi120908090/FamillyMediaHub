import React, { useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet, Image, StatusBar } from "react-native";
import logo from "../../../assets/logo.png";
import { useAuth } from "../../hooks/useAuth";

export default function SplashScreen({ navigation }) {
  const { isBootstrapping } = useAuth();

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const timer = setTimeout(() => {
      navigation.replace("AuthProfile");
    }, 600);

    return () => clearTimeout(timer);
  }, [isBootstrapping, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Image
        source={logo}
        style={styles.logo}
        fadeDuration={0} // Performance: Prevents fade-in delay on Android
        resizeMode="contain"
      />
      <Text style={styles.text}>Photos App</Text>
      <ActivityIndicator style={styles.loader} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#c4ced9",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  text: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  loader: {
    marginTop: 16,
  },
});
