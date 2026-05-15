import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AppHeader from "../../components/navigation/AppHeader";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { isChildAccount } from "../../utils/auth";

export default function EditProfileScreen({ navigation, onOpenMenu }) {
  const { currentUser, isSubmitting, profile, updateOwnChildProfile, updateProfile } = useProfile();
  const { theme } = useTheme();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [image, setImage] = useState(profile.image);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const childUser = isChildAccount(currentUser);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: "Profile" }],
    });
  };

  useEffect(() => {
    setName(profile.name);
    setUsername(profile.username);
    setEmail(profile.email);
    setPhone(profile.phone);
    setImage(profile.image);
    setPassword("");
    setConfirmPassword("");
    setImageChanged(false);
  }, [profile]);

  const handlePickFromFiles = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission Required", "Allow file access to choose a profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      setImage(result.assets[0].uri);
      setImageChanged(true);
      setPhotoModalVisible(false);
    }
  };

  const handleOpenCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission Required", "Allow camera access to take a profile photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      setImage(result.assets[0].uri);
      setImageChanged(true);
      setPhotoModalVisible(false);
    }
  };

  const handleChangePhoto = () => {
    setPhotoModalVisible(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert("Missing Details", "Name is required.");
      return;
    }

    if (childUser) {
      if (password && password !== confirmPassword) {
        Alert.alert("Password mismatch", "New password and confirm password must match.");
        return;
      }

      try {
        await updateOwnChildProfile({
          name: trimmedName,
          phone_number: trimmedPhone || undefined,
          password: password || undefined,
        });

        Alert.alert("Saved", "Your profile changes have been updated.", [
          {
            text: "OK",
            onPress: handleBack,
          },
        ]);
      } catch (error) {
        Alert.alert("Unable to save", error.message);
      }

      return;
    }

    if (!trimmedUsername || !trimmedEmail) {
      Alert.alert("Missing Details", "Name, username, and email are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert("Invalid Email", "Enter a valid email address.");
      return;
    }

    updateProfile({
      name: trimmedName,
      username: trimmedUsername,
      email: trimmedEmail,
      phone: trimmedPhone,
      image,
    });

    Alert.alert("Saved", "Your profile changes have been updated.", [
      {
        text: "OK",
        onPress: handleBack,
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AppHeader
          title="Profile"
          onOpenMenu={onOpenMenu}
          rightIcon="create-outline"
        />

        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.imageWrapper}
            onPress={handleChangePhoto}
            activeOpacity={0.85}
          >
            {image ? (
              <Image source={{ uri: image }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.placeholderImage]}>
                <Ionicons name="person" size={40} color={theme.subText} />
              </View>
            )}
            <View style={[styles.cameraIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleChangePhoto} style={styles.changePhotoBtn}>
            <Text style={[styles.changePhotoText, { color: theme.primary }]}>Change Photo</Text>
          </TouchableOpacity>

          {imageChanged ? (
            <TouchableOpacity onPress={handleSave} style={styles.savePhotoBtn} activeOpacity={0.88}>
              <Text style={[styles.savePhotoText, { color: theme.buttonText }]}>Save Photo</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={[styles.name, { color: theme.text }]}>{name || "Your Name"}</Text>
          <Text style={[styles.role, { color: theme.subText }]}>{profile.role}</Text>
        </View>

        <Modal
          visible={photoModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.photoModalOverlay}>
              <View style={[styles.photoModalContent, { backgroundColor: theme.surface }]}> 
                <Text style={[styles.photoModalTitle, { color: theme.text }]}>Profile Photo</Text>
                <Text style={[styles.photoModalSubtitle, { color: theme.subText }]}>Choose how you want to update your profile photo.</Text>

                <TouchableOpacity
                  style={[styles.photoModalButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={handleOpenCamera}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.photoModalButtonText, { color: theme.text }]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoModalButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={handlePickFromFiles}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.photoModalButtonText, { color: theme.text }]}>Choose Image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoModalButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => {
                    setImage(null);
                    setImageChanged(true);
                    setPhotoModalVisible(false);
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.photoModalButtonText, { color: theme.primary }]}>Remove Image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoModalCancelButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setPhotoModalVisible(false)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.photoModalCancelText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Member Information</Text>

          <Input label="Full Name" value={name} onChangeText={setName} theme={theme} />
          {!childUser ? (
            <Input label="Username" value={username} onChangeText={setUsername} theme={theme} />
          ) : null}
          {!childUser ? (
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              theme={theme}
            />
          ) : null}
          <Input
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            theme={theme}
          />
          {childUser ? (
            <>
              <Input
                label="New Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                theme={theme}
              />
              <Input
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                theme={theme}
              />
            </>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.button }, isSubmitting && styles.primaryBtnDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <Text style={[styles.primaryText, { color: theme.buttonText }]}>Save Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn}>
          <Ionicons name="log-out" size={16} color="red" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const Input = ({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize = "sentences",
  secureTextEntry = false,
  theme,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View style={styles.inputContainer}>
      <Text style={[styles.inputLabel, { color: theme.subText }]}>{label}</Text>
      <View style={[styles.inputRow, { borderColor: theme.border }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          placeholderTextColor={theme.subText}
          style={[styles.input, { color: theme.text }]}
        />
        {secureTextEntry ? (
          <TouchableOpacity onPress={() => setIsPasswordVisible((current) => !current)}>
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={theme.subText}
            />
          </TouchableOpacity>
        ) : (
          <Ionicons name="create-outline" size={16} color={theme.subText} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },

  profileSection: { alignItems: "center", marginTop: 10 },

  imageWrapper: { position: "relative" },

  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },

  placeholderImage: {
    backgroundColor: "#E1E1E1",
    justifyContent: "center",
    alignItems: "center",
  },

  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3B82F6",
    padding: 6,
    borderRadius: 15,
  },

  changePhotoBtn: {
    marginTop: 8,
  },

  changePhotoText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "500",
  },

  name: { fontWeight: "bold", marginTop: 10 },

  role: { color: "#777", fontSize: 12 },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginVertical: 15,
    borderRadius: 12,
    padding: 15,
  },

  sectionTitle: {
    fontWeight: "600",
    marginBottom: 10,
  },

  inputContainer: {
    marginBottom: 12,
  },

  inputLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 4,
  },

  inputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 6,
  },

  input: {
    flex: 1,
  },

  primaryBtn: {
    backgroundColor: "#3B82F6",
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "600",
  },

  logoutBtn: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 15,
    alignItems: "center",
    gap: 5,
  },

  savePhotoBtn: {
    marginTop: 8,
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },

  savePhotoText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  photoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  photoModalContent: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },

  photoModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  photoModalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },

  photoModalButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },

  photoModalButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  photoModalCancelButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },

  photoModalCancelText: {
    fontSize: 15,
    fontWeight: "700",
  },

  logoutText: {
    color: "red",
  },
});
