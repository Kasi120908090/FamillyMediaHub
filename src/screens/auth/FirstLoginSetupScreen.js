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

export default function FirstLoginSetupScreen({ navigation }) {
  const { authToken, completeFirstLogin, currentUser, isSubmitting, logout } = useAuth();
  const [step, setStep] = useState("email"); // email -> otp-password
  const [email, setEmail] = useState(currentUser?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
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
    if (timer <= 0) return undefined;
    const interval = setInterval(() => {
      setTimer((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

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

  // STEP 1: Send OTP to email
  const handleSendOtp = async () => {
    if (!email.trim() || emailError) {
      Alert.alert("Email required", emailError || "Enter a valid email address.");
      return;
    }
    try {
      console.log("[FirstLogin] Sending OTP to:", email.trim());
      console.log("[FirstLogin] Auth token:", authToken ? "present" : "MISSING");
      
      await authService.sendFirstLoginOtp(email.trim(), authToken);
      
      console.log("[FirstLogin] OTP sent successfully");
      setStep("otp");
      setTimer(60);
      Alert.alert("Verification code sent", `A code was sent to ${email.trim()}.`);
    } catch (error) {
      console.error("[FirstLogin] OTP sending failed:", error);
      console.error("[FirstLogin] Error message:", error.message);
      console.error("[FirstLogin] Error status:", error.status);
      console.error("[FirstLogin] Error code:", error.code);
      
      const errorMsg = error.message || "Unable to send verification code";
      Alert.alert("Unable to send code", errorMsg);
    }
  };

  // STEP 2: Complete setup (Verify OTP and Set Password)
  const handleSetPassword = async () => {
    const otpValue = otp.join("");
    if (otpValue.length !== 6) {
      Alert.alert("Verification required", "Enter the 6-digit code sent to your email.");
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert("Password required", "Create a new password to continue.");
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

  const getTitle = () => {
    if (step === "email") return "Let's set up\nyour account.";
    return "Verify & Set\nPassword";
  };

  const getSubtitle = () => {
    if (step === "email") return "Enter your email address to get started.";
    return "Check your email for the code and create your password.";
  };

  return (
    <AuthFlowShell>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <SectionTitle
            title={getTitle()}
            subtitle={getSubtitle()}
          />
        </View>
        <FamilyHeroIllustration locked />
      </View>

      <FlowCard>
        {/* STEP 1: Email Input */}
        {step === "email" && (
          <>
            <FlowInput
              label="Email ID"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email ID"
              keyboardType="email-address"
              icon="mail-outline"
              error={emailError}
              editable={true}
            />
            <Text style={styles.helpText}>
              This email will be used for notifications and account recovery.
            </Text>

            <PrimaryAction
              label="Send Verification Code"
              onPress={handleSendOtp}
              loading={isSubmitting}
              icon="mail-outline"
            />
          </>
        )}

        {/* STEP 2: OTP Verification */}
        {step === "otp" && (
          <>
            <View style={styles.emailDisplay}>
              <Ionicons name="mail-outline" size={16} color="#7A4EFF" />
              <Text style={styles.emailDisplayText}>{email}</Text>
            </View>

            <View style={styles.otpWrap}>
              <Text style={styles.otpLabel}>Enter 6-digit Code</Text>
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

            <View style={styles.codeBanner}>
              <Ionicons name="info-circle-outline" size={16} color="#6E4CDE" />
              <Text style={styles.codeBannerText}>
                Check your email for the verification code.
              </Text>
            </View>

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

            <PrimaryAction
              label="Complete Setup"
              onPress={handleSetPassword}
              loading={isSubmitting}
              icon="checkmark"
            />

            <View style={styles.secondaryActions}>
              <SecondaryAction
                label={timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
                onPress={handleSendOtp}
                disabled={timer > 0 || isSubmitting}
              />
              <SecondaryAction
                label="Change Email"
                onPress={() => {
                  setStep("email");
                  setOtp(Array(6).fill(""));
                  setTimer(0);
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordVisible(false);
                  setConfirmVisible(false);
                }}
                disabled={isSubmitting}
              />
            </View>
          </>
        )}
      </FlowCard>

      <InfoBanner text={
        step === "email" 
          ? "Enter your email to receive a verification code."
          : "Your account will be activated after you verify your email and set a new password."
      } />
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
  emailDisplay: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F5F0FF",
    marginBottom: 14,
  },
  emailDisplayText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#7A4EFF",
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
