import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomInput from "../../components/CustomInput";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";
import { getDefaultAuthenticatedRoute } from "../../utils/auth";

export default function LoginScreen({ navigation }) {
  const { isSubmitting, login } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validateForm = () => {
    let isValid = true;

    if (!username.trim()) {
      setUsernameError("Username is required");
      isValid = false;
    } else {
      setUsernameError("");
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      isValid = false;
    } else {
      setPasswordError("");
    }

    return isValid;
  };

  const handleSignIn = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const response = await login({
        username: username.trim(),
        password,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: response?.route || getDefaultAuthenticatedRoute(response?.user) }],
      });
    } catch (error) {
      Alert.alert("Login failed", error.message);
    }
  };

  const handleUsernameChange = useCallback(
    (text) => {
      setUsername(text);
      if (usernameError) {
        setUsernameError("");
      }
    },
    [usernameError]
  );

  const handlePasswordChange = useCallback(
    (text) => {
      setPassword(text);
      if (passwordError) {
        setPasswordError("");
      }
    },
    [passwordError]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.primary }]}>
        <Ionicons name="camera" size={28} color="#fff" />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>Family Media Hub</Text>
      <Text style={[styles.subtitle, { color: theme.subText }]}>Memories Together, Anytime</Text>

      <Text style={[styles.welcome, { color: theme.text }]}>Welcome Back</Text>
      <Text style={[styles.desc, { color: theme.subText }]}>Sign in to access your family memories</Text>

      <CustomInput
        placeholder="User Name"
        value={username}
        error={usernameError}
        onChangeText={handleUsernameChange}
      />

      <CustomInput
        placeholder="Password"
        value={password}
        error={passwordError}
        secureTextEntry
        onChangeText={handlePasswordChange}
      />

      <TouchableOpacity
        style={styles.forgotContainer}
        onPress={() => navigation.navigate("VerifyIdentity")}
      >
        <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.button }, isSubmitting && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Sign In</Text>
        )}
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        {/* <View style={[styles.line, { backgroundColor: theme.border }]} /> */}
        {/* <Text style={[styles.orText, { color: theme.subText }]}>backend connected</Text> */}
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>

      {/* <TouchableOpacity style={[styles.emailButton, { backgroundColor: theme.card, borderColor: theme.border }]} activeOpacity={1}>
        <Ionicons
          name="server-outline"
          size={22}
          color={theme.text}
          style={styles.emailIcon}
        />
        <Text style={[styles.emailButtonText, { color: theme.text }]}>API: http://127.0.0.1:8000</Text>
      </TouchableOpacity> */}

      <Text style={[styles.terms, { color: theme.subText }]}>
        By continuing, you agree to our <Text style={[styles.link, { color: theme.primary }]}>Terms of Service</Text> and{" "}
        <Text style={[styles.link, { color: theme.primary }]}>Privacy Policy</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EDEDED",
    alignItems: "center",
    padding: 20,
    justifyContent: "center",
  },
  iconBox: {
    width: 70,
    height: 70,
    backgroundColor: "#5B7FFF",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#777",
    marginBottom: 25,
  },
  welcome: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
  },
  desc: {
    color: "#777",
    marginBottom: 20,
  },
  forgotContainer: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  forgotText: {
    color: "#4A90E2",
    fontSize: 13,
  },
  button: {
    width: "100%",
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffffff",
    backgroundColor: "#F5F8FF",
  },
  emailIcon: {
    marginRight: 8,
  },
  emailButtonText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
    width: "100%",
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  orText: {
    marginHorizontal: 10,
    color: "#777",
    fontSize: 12,
    textTransform: "uppercase",
  },
  terms: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginTop: 20,
  },
  link: {
    color: "#4A90E2",
  },
});
