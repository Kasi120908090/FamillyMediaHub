import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../../services/authService";

export default function VerifyIdentity({ navigation }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: "AuthProfile" }],
    });
  };

  const handleContinue = async () => {
    if (!email.trim()) {
      Alert.alert("Email required", "Enter the email address for the account.");
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.forgotPassword(email.trim());
      navigation.navigate("VerifyOTP", { email: email.trim() });
    } catch (error) {
      Alert.alert("Unable to send OTP", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Forgot Password</Text>
        </View>

        <View style={styles.stepContainer}>
          <View style={styles.stepCircleActive}>
            <Ionicons name="mail" size={14} color="#fff" />
          </View>
          <View style={styles.line} />
          <View style={styles.stepCircle}>
            <Text style={styles.stepText}>2</Text>
          </View>
        </View>

        <View style={styles.iconWrapper}>
          <Ionicons name="shield-checkmark" size={30} color="#3B82F6" />
        </View>

        <Text style={styles.title}>Request OTP</Text>
        <Text style={styles.subtitle}>
          Enter your account email and we will send a verification code to reset the password.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            placeholder="Enter your email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleContinue}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Send OTP</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleBack}
        >
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EDEFF5",
  },
  scroll: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "600",
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stepCircleActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    color: "#111827",
    fontSize: 12,
  },
  line: {
    width: 40,
    height: 2,
    backgroundColor: "#3B82F6",
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCE6F9",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 15,
  },
  title: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    marginVertical: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
  },
  label: {
    fontSize: 13,
    color: "#555",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    marginTop: 25,
    backgroundColor: "#3B82F6",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: "#D1D5DB",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryText: {
    color: "#333",
    fontWeight: "500",
  },
});
