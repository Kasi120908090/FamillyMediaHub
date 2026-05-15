import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/authService";

export default function VerifyOTP({ navigation, route }) {
  const { login } = useAuth();
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [timer, setTimer] = useState(30);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputs = useRef([]);
  const email = route.params?.email || "";

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

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (value, index) => {
    const digits = value.replace(/\D/g, "");
    const newOtp = [...otp];

    if (!digits) {
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    if (digits.length === 1) {
      newOtp[index] = digits;
      setOtp(newOtp);
      if (index < 5) {
        inputs.current[index + 1]?.focus();
      }
      return;
    }

    let nextIndex = index;
    for (let i = 0; i < digits.length && nextIndex < 6; i += 1) {
      newOtp[nextIndex] = digits[i];
      nextIndex += 1;
    }
    setOtp(newOtp);
    if (nextIndex < 6) {
      inputs.current[nextIndex]?.focus();
    } else {
      inputs.current[5]?.blur();
    }
  };

  const handleKeyPress = ({ nativeEvent }, index) => {
    if (nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpValue = otp.join("");

    if (otpValue.length !== 6) {
      Alert.alert("Incomplete OTP", "Enter the 6-digit code you received.");
      return;
    }

    if (!newPassword.trim() || newPassword.trim().length < 6) {
      Alert.alert("Invalid password", "New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Password mismatch", "New password and confirm password must match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.verifyForgotPasswordOtp({ email, otp: otpValue });
      await authService.resetForgotPassword({
        email,
        otp: otpValue,
        new_password: newPassword,
      });
      await login({
        username: email.trim(),
        password: newPassword,
      });

      Alert.alert("Password reset", "Your password has been updated successfully.", [
        {
          text: "OK",
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: "AuthProfile" }],
            }),
        },
      ]);
    } catch (error) {
      Alert.alert("Unable to finish reset", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setTimer(30);
    try {
      await authService.forgotPassword(email);
    } catch (error) {
      Alert.alert("Unable to resend OTP", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify OTP</Text>
        </View>

        <View style={styles.stepContainer}>
          <View style={styles.stepCircleDone}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
          <View style={styles.line} />
          <View style={styles.stepCircleActive}>
            <Text style={styles.stepText}>2</Text>
          </View>
        </View>

        <View style={styles.iconWrapper}>
          <Ionicons name="key-outline" size={30} color="#3B82F6" />
        </View>

        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit OTP to {email || "your email"}.</Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(el) => (inputs.current[index] = el)}
              value={digit}
              onChangeText={(value) => handleChange(value, index)}
              onKeyPress={(event) => handleKeyPress(event, index)}
              style={styles.otpBox}
              keyboardType="numeric"
              selectTextOnFocus
              textContentType="oneTimeCode"
            />
          ))}
        </View>

        <View style={styles.passwordInputRow}>
          <TextInput
            placeholder="New password"
            style={styles.passwordInput}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!newPasswordVisible}
          />
          <TouchableOpacity
            onPress={() => setNewPasswordVisible((current) => !current)}
            style={styles.passwordToggle}
          >
            <Ionicons
              name={newPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.passwordInputRow}>
          <TextInput
            placeholder="Confirm new password"
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!confirmPasswordVisible}
          />
          <TouchableOpacity
            onPress={() => setConfirmPasswordVisible((current) => !current)}
            style={styles.passwordToggle}
          >
            <Ionicons
              name={confirmPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn&apos;t receive code? </Text>
          <TouchableOpacity disabled={timer > 0 || !email} onPress={handleResend}>
            <Text style={[styles.resendLink, timer > 0 && styles.resendDisabled]}>
              {timer > 0 ? `Resend in ${timer}s` : "Resend"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleVerify}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    fontWeight: "600",
  },
  stepContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  stepCircleDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    color: "#fff",
    fontSize: 12,
  },
  line: {
    width: 30,
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
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 10,
  },
  otpBox: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    textAlign: "center",
    fontSize: 20,
    backgroundColor: "#fff",
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  passwordToggle: {
    paddingLeft: 10,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  resendText: {
    textAlign: "center",
    color: "#666",
  },
  resendLink: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  resendDisabled: {
    color: "#999",
  },
  primaryBtn: {
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
  },
});
