import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthFlowShell,
  FamilyHeroIllustration,
  FlowCard,
  FlowInput,
  InfoBanner,
  PrimaryAction,
  SecondaryAction,
  SectionTitle,
} from "../../components/auth/FlowPrimitives";
import { useAuth } from "../../hooks/useAuth";
import { authService } from "../../services/authService";

const passwordChecks = [
  { key: "length", label: "At least 8 characters" },
  { key: "lowercase", label: "One lowercase letter" },
  { key: "uppercase", label: "One uppercase letter" },
  { key: "symbol", label: "One number or symbol" },
];

export default function FirstLoginSetupScreen({ navigation }) {
  const { authToken, completeFirstLogin, currentUser, isSubmitting, logout } = useAuth();
  const [email, setEmail] = useState(currentUser?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const otpRefs = useRef([]);

  const emailError = useMemo(() => {
    if (!email.trim()) {
      return "Email is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim()) ? "" : "Enter a valid email address.";
  }, [email]);

  useEffect(() => {
    if (timer <= 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      setTimer((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const passwordState = useMemo(
    () => ({
      length: newPassword.length >= 8,
      lowercase: /[a-z]/.test(newPassword),
      uppercase: /[A-Z]/.test(newPassword),
      symbol: /[\d\W]/.test(newPassword),
    }),
    [newPassword]
  );

  const handleOtpChange = (value, index) => {
    const digits = value.replace(/\D/g, "");
    const nextOtp = [...otp];

    if (!digits) {
      nextOtp[index] = "";
      setOtp(nextOtp);
      return;
    }

    if (digits.length === 1) {
      nextOtp[index] = digits;
      setOtp(nextOtp);
      if (index < otp.length - 1) {
        otpRefs.current[index + 1]?.focus();
      }
      return;
    }

    let nextIndex = index;
    digits.split("").forEach((digit) => {
      if (nextIndex < nextOtp.length) {
        nextOtp[nextIndex] = digit;
        nextIndex += 1;
      }
    });
    setOtp(nextOtp);

    if (nextIndex < otp.length) {
      otpRefs.current[nextIndex]?.focus();
    }
  };

  const handleOtpKeyPress = ({ nativeEvent }, index) => {
    if (nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const sendOtp = async () => {
    if (!email.trim() || emailError) {
      Alert.alert("Email required", emailError || "Enter a valid email address.");
      return;
    }

    try {
      await authService.sendFirstLoginOtp(email.trim(), authToken);
      setIsOtpSent(true);
      setTimer(60);
      Alert.alert("Verification code sent", `A code was sent to ${email.trim()}.`);
    } catch (error) {
      Alert.alert("Unable to send code", error.message);
    }
  };

  const handleSubmit = async () => {
    if (!isOtpSent) {
      await sendOtp();
      return;
    }

    const otpValue = otp.join("");

    if (!email.trim() || emailError) {
      Alert.alert("Email required", emailError || "Enter a valid email address.");
      return;
    }

    if (otpValue.length !== 6) {
      Alert.alert("Verification required", "Enter the 6-digit code sent to your email.");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("Password required", "Create a new password to continue.");
      return;
    }

    if (!Object.values(passwordState).every(Boolean)) {
      Alert.alert("Weak password", "Please follow the password rules before continuing.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Password mismatch", "New password and confirm password must match.");
      return;
    }

    try {
      await completeFirstLogin({
        email: email.trim(),
        otp: otpValue,
        new_password: newPassword,
      });
      await logout();

      navigation.reset({
        index: 0,
        routes: [{ name: "AuthProfile" }],
      });
    } catch (error) {
      Alert.alert("Unable to finish setup", error.message);
    }
  };

  return (
    <AuthFlowShell>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <SectionTitle
            title={"Let’s set up\nyour account."}
            subtitle="Please update your email ID and password to continue."
          />
        </View>
        <FamilyHeroIllustration locked />
      </View>

      <FlowCard>
        <FlowInput
          label="Email ID"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email ID"
          keyboardType="email-address"
          icon="mail-outline"
          error={emailError}
          editable={!isOtpSent}
        />
        <Text style={styles.helpText}>
          This email will be used for notifications and account recovery.
        </Text>

        <FlowInput
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Enter new password"
          icon="lock-closed-outline"
          secureTextEntry
          secureVisible={passwordVisible}
          onToggleSecure={() => setPasswordVisible((current) => !current)}
        />

        <FlowInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          icon="checkmark-circle-outline"
          secureTextEntry
          secureVisible={confirmVisible}
          onToggleSecure={() => setConfirmVisible((current) => !current)}
        />

        {isOtpSent ? (
          <View style={styles.otpWrap}>
            <Text style={styles.otpLabel}>Verification Code</Text>
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={`otp-${index}`}
                  ref={(input) => {
                    otpRefs.current[index] = input;
                  }}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(event) => handleOtpKeyPress(event, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={styles.otpInput}
                  textAlign="center"
                  selectionColor="#5A23E5"
                />
              ))}
            </View>
          </View>
        ) : null}

        {isOtpSent ? (
          <View style={styles.codeBanner}>
            <Ionicons name="mail-open-outline" size={16} color="#6E4CDE" />
            <Text style={styles.codeBannerText}>
              Enter the 6-digit code we sent to your email.
            </Text>
          </View>
        ) : null}

        <View style={styles.rulesGrid}>
          {passwordChecks.map((rule) => {
            const isMet = passwordState[rule.key];
            return (
              <View key={rule.key} style={styles.ruleItem}>
                <Ionicons
                  name={isMet ? "checkmark-circle" : "ellipse-outline"}
                  size={14}
                  color={isMet ? "#7A4EFF" : "#CABEEB"}
                />
                <Text style={[styles.ruleText, isMet ? styles.ruleTextActive : null]}>
                  {rule.label}
                </Text>
              </View>
            );
          })}
        </View>

        <PrimaryAction
          label={isOtpSent ? "Update & Continue" : "Send Verification Code"}
          onPress={handleSubmit}
          loading={isSubmitting}
          icon={isOtpSent ? "arrow-forward" : "mail-outline"}
        />

        {isOtpSent ? (
          <View style={styles.secondaryActions}>
            <SecondaryAction
              label={timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
              onPress={sendOtp}
              disabled={timer > 0 || isSubmitting}
            />
          </View>
        ) : null}
      </FlowCard>

      <InfoBanner text="Your account will be fully activated after the email verification code is confirmed." />
    </AuthFlowShell>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 12,
  },
  helpText: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 10,
    lineHeight: 15,
    color: "#9B8FC5",
  },
  otpWrap: {
    marginBottom: 14,
  },
  otpLabel: {
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#4B2AA5",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  otpInput: {
    width: "15.2%",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6DCF9",
    backgroundColor: "#FCFBFF",
    color: "#24145B",
    fontSize: 18,
    fontWeight: "800",
    paddingVertical: 0,
  },
  codeBanner: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F5F0FF",
    flexDirection: "row",
    alignItems: "center",
  },
  codeBannerText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: "#7E72A8",
  },
  rulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginBottom: 18,
  },
  ruleItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
  },
  ruleText: {
    marginLeft: 6,
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    color: "#A79BCF",
  },
  ruleTextActive: {
    color: "#6E4CDE",
    fontWeight: "700",
  },
  secondaryActions: {
    marginTop: 10,
  },
});
