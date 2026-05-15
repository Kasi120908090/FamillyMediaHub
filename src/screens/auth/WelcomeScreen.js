import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import familyImage from "../../../assets/img.png";
import {
  AuthFlowShell,
  PrimaryAction,
} from "../../components/auth/FlowPrimitives";

const bubbleSizes = [124, 108, 96, 118];

export default function WelcomeScreen({ navigation }) {
  return (
    <AuthFlowShell scroll={false}>
      <View style={styles.layout}>
        <View style={styles.copyColumn}>
          <Text style={styles.title}>
            All your{"\n"}family{"\n"}moments.
          </Text>
          <Text style={styles.subtitle}>One shared space for every memory.</Text>
          <Text style={styles.description}>
            Upload, store and share photos, videos and files together across all your devices.
          </Text>

          <View style={styles.buttonWrap}>
            <PrimaryAction
              label="Continue"
              onPress={() => navigation.navigate("AuthProfile")}
            />
          </View>
        </View>

        <View style={styles.visualColumn}>
          {bubbleSizes.map((size, index) => (
            <View
              key={size}
              style={[
                styles.memoryBubble,
                {
                  width: size,
                  height: size,
                  marginLeft: index % 2 === 0 ? 12 : 0,
                  marginTop: index === 0 ? 8 : 12,
                },
              ]}
            >
              <View style={styles.memoryGlow} />
              <Image source={familyImage} style={styles.memoryImage} resizeMode="cover" />
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.floatingPrompt}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("AuthProfile")}
      >
        <Text style={styles.floatingPromptText}>Start your family hub</Text>
        <Ionicons name="arrow-forward" size={15} color="#5A23E5" />
      </TouchableOpacity>
    </AuthFlowShell>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  copyColumn: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "900",
    color: "#271287",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#F39B47",
  },
  description: {
    marginTop: 18,
    fontSize: 11,
    lineHeight: 18,
    color: "#6E6396",
    maxWidth: 170,
  },
  buttonWrap: {
    marginTop: 28,
    width: 116,
  },
  visualColumn: {
    width: 148,
    alignItems: "center",
  },
  memoryBubble: {
    borderRadius: 999,
    backgroundColor: "#F5EEFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6E42F5",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.95)",
  },
  memoryGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(139, 103, 255, 0.10)",
  },
  memoryImage: {
    width: "100%",
    height: "100%",
  },
  floatingPrompt: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "#ECE2FF",
  },
  floatingPromptText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D5AA4",
  },
});
