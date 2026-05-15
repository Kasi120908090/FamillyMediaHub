import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthFlowShell,
  FlowCard,
  FlowInput,
  InfoBanner,
  PrimaryAction,
  SectionTitle,
} from "../../components/auth/FlowPrimitives";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import { useAuth } from "../../hooks/useAuth";

const relationships = [
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Other",
];

const DATE_LIMITS = {
  min: new Date(1920, 0, 1),
  max: new Date(),
  default: new Date(2000, 0, 1), // Default to a central date for easier scrolling
};

const genders = ["Male", "Female", "Other"];

const formatDisplayDate = (date) => {
  if (!date) {
    return "";
  }
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};

const normalizeDate = (date) => {
  if (!date) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
};

const formatBackendDate = (date) => {
  if (!date) {
    return undefined;
  }

  const normalizedDate = normalizeDate(date);
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
  const day = String(normalizedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AddFamilyMember({ navigation, route }) {
  const { createChild, currentUser, isSubmitting, profile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(DATE_LIMITS.default);

  const adminPassword = route?.params?.adminPassword || "";

  const openDatePicker = () => {
    const initialValue = dateOfBirth || DATE_LIMITS.default;

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: initialValue,
        mode: "date",
        display: "calendar",
        maximumDate: DATE_LIMITS.max,
        minimumDate: DATE_LIMITS.min,
        onChange: (event, selectedDate) => {
          if (event.type !== "set" || !selectedDate) {
            return;
          }

          const normalizedDate = normalizeDate(selectedDate);
          setPickerValue(normalizedDate);
          setDateOfBirth(normalizedDate);
        },
      });

      return;
    }

    setPickerValue(initialValue);
    setShowDatePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
  };

  const confirmPickerDate = () => {
    setDateOfBirth(normalizeDate(pickerValue));
    setShowDatePicker(false);
  };

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

  const errors = useMemo(() => {
    const nextErrors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    } else if (fullName.trim().length < 3) {
      nextErrors.fullName = "Use at least 3 characters.";
    }

    if (!relationship) {
      nextErrors.relationship = "Relationship is required.";
    }

    if (!email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!username.trim()) {
      nextErrors.username = "Username is required.";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,}$/.test(password)) {
      nextErrors.password = "Use 8+ chars with upper, lower and number or symbol.";
    }

    return nextErrors;
  }, [email, fullName, password, relationship, username]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!adminPassword) {
      Alert.alert(
        "Verification required",
        "Please return to the previous screen and verify the admin password again."
      );
      return;
    }

    if (Object.keys(errors).length) {
      Alert.alert("Missing details", "Please complete the required fields before continuing.");
      return;
    }

    try {
      await createChild({
        name: fullName.trim(),
        relationship,
        email: email.trim(),
        username: username.trim(),
        password: password.trim(),
        admin_password: adminPassword,
        date_of_birth: formatBackendDate(dateOfBirth),
        gender: gender || undefined,
        profile_image: profileImage || undefined,
      });

      Alert.alert("Member added", "The new family profile has been created successfully.", [
        {
          text: "Continue",
          onPress: handleBack,
        },
      ]);
    } catch (error) {
      Alert.alert("Unable to add member", error.message);
    }
  };

  const rightSlot = (
    <View style={styles.headerRight}>
      <ThemedAvatar uri={profile.image} name={profile.name} style={styles.headerAvatar} />
    </View>
  );

  const displayDateOfBirth = formatDisplayDate(dateOfBirth);

  return (
    <AuthFlowShell rightSlot={rightSlot}>
      <TouchableOpacity style={styles.backRow} activeOpacity={0.85} onPress={handleBack}>
        <Ionicons name="arrow-back" size={18} color="#5A23E5" />
        <Text style={styles.backText}>Add New Member</Text>
      </TouchableOpacity>

      <SectionTitle
        title="Create a new profile"
        subtitle="Add a new family member to give them access to Family Media Hub."
        centered
      />

      <View style={styles.avatarWrap}>
        <TouchableOpacity style={styles.avatarButton} activeOpacity={0.9} onPress={pickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={34} color="#7A4EFF" />
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Add Profile Picture</Text>
        <Text style={styles.avatarMeta}>JPG, PNG or GIF. Max size 5MB.</Text>
      </View>

      <FlowCard>
        <FlowInput
          label="Full Name *"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter full name"
          icon="person-outline"
          error={errors.fullName}
          autoCapitalize="words"
        />

        <FlowInput
          label="Relationship *"
          value={relationship}
          onChangeText={() => {}}
          placeholder="Select relationship"
          icon="people-outline"
          error={errors.relationship}
          editable={false}
          rightContent={
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowRelationshipPicker(true)}
              style={styles.trailingAction}
            >
              <Ionicons name="chevron-down" size={18} color="#8B7FC3" />
            </TouchableOpacity>
          }
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <View style={styles.fieldWrap}>
              <Text style={styles.dateFieldLabel}>Date of Birth</Text>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={openDatePicker}
                style={styles.dateFieldButton}
              >
                <View style={styles.dateFieldLeft}>
                  <Ionicons name="calendar-outline" size={17} color="#8D76E8" />
                  <Text
                    style={[
                      styles.dateFieldValue,
                      !displayDateOfBirth ? styles.dateFieldPlaceholder : null,
                    ]}
                  >
                    {displayDateOfBirth || "Select date of birth"}
                  </Text>
                </View>
                <Ionicons name="calendar-clear-outline" size={18} color="#8B7FC3" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.halfField}>
            <Text style={styles.genderLabel}>Gender (Optional)</Text>
            <View style={styles.genderRow}>
              {genders.map((item) => {
                const active = gender === item;
                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.88}
                    style={[styles.genderChip, active ? styles.genderChipActive : null]}
                    onPress={() => setGender(item)}
                  >
                    <Text style={[styles.genderChipText, active ? styles.genderChipTextActive : null]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <FlowInput
          label="Email Address *"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter email address"
          icon="mail-outline"
          keyboardType="email-address"
          error={errors.email}
        />

        <FlowInput
          label="Username *"
          value={username}
          onChangeText={setUsername}
          placeholder="Choose a username"
          icon="at-outline"
          error={errors.username}
        />

        <FlowInput
          label="Password *"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a password"
          icon="lock-closed-outline"
          secureTextEntry
          secureVisible={passwordVisible}
          onToggleSecure={() => setPasswordVisible((current) => !current)}
          error={errors.password}
        />

        <InfoBanner text="All fields marked with * are required. Date of birth and gender are optional." style={styles.inlineBanner} />

        <PrimaryAction
          label="Add Member"
          onPress={handleSubmit}
          loading={isSubmitting}
          icon="person-add"
        />
      </FlowCard>

      {showDatePicker ? (
        Platform.OS === "ios" ? (
          <Modal visible transparent animationType="fade" onRequestClose={closeDatePicker}>
            <Pressable style={styles.modalOverlay} onPress={closeDatePicker}>
              <FlowCard style={styles.dateModal}>
                <Pressable>
                  <Text style={styles.relationshipTitle}>Select Date of Birth</Text>
                  <DateTimePicker
                    value={pickerValue}
                    mode="date"
                    display="spinner"
                    maximumDate={DATE_LIMITS.max}
                    minimumDate={DATE_LIMITS.min}
                    onChange={(_, selectedDate) => {
                      if (selectedDate) {
                        setPickerValue(normalizeDate(selectedDate));
                      }
                    }}
                  />
                  <View style={styles.dateActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={styles.dateActionSecondary}
                      onPress={closeDatePicker}
                    >
                      <Text style={styles.dateActionSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={styles.dateActionPrimary}
                      onPress={confirmPickerDate}
                    >
                      <Text style={styles.dateActionPrimaryText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </FlowCard>
            </Pressable>
          </Modal>
        ) : null
      ) : null}

      <Modal visible={showRelationshipPicker} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setShowRelationshipPicker(false)}
        >
          <FlowCard style={styles.relationshipModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.relationshipTitle}>Select Relationship</Text>
              {relationships.map((item) => (
                <TouchableOpacity
                  key={item}
                  activeOpacity={0.88}
                  style={styles.relationshipOption}
                  onPress={() => {
                    setRelationship(item);
                    setShowRelationshipPicker(false);
                  }}
                >
                  <Text style={styles.relationshipOptionText}>{item}</Text>
                  {relationship === item ? (
                    <Ionicons name="checkmark-circle" size={18} color="#5A23E5" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </FlowCard>
        </TouchableOpacity>
      </Modal>
    </AuthFlowShell>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  backText: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#5A23E5",
  },
  avatarWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  avatarButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "#ECE1FF",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF8FF",
    position: "relative",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F2ECFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7A4EFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarHint: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "800",
    color: "#5A23E5",
  },
  avatarMeta: {
    marginTop: 4,
    fontSize: 10,
    color: "#A092CB",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  dateFieldLabel: {
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "800",
    color: "#4B2AA5",
  },
  dateFieldButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6DCF9",
    backgroundColor: "#FCFBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  dateFieldLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dateFieldValue: {
    marginLeft: 10,
    fontSize: 13,
    color: "#2D158B",
    fontWeight: "700",
  },
  dateFieldPlaceholder: {
    color: "#B1A8D8",
    fontWeight: "500",
  },
  trailingAction: {
    paddingLeft: 6,
    paddingVertical: 8,
  },
  genderLabel: {
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "800",
    color: "#4B2AA5",
  },
  genderRow: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6DCF9",
    backgroundColor: "#FCFBFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
  },
  genderChip: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
  },
  genderChipActive: {
    backgroundColor: "#F2ECFF",
  },
  genderChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A092CB",
  },
  genderChipTextActive: {
    color: "#5A23E5",
  },
  inlineBanner: {
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(32, 21, 88, 0.34)",
    justifyContent: "center",
    padding: 24,
  },
  relationshipModal: {
    maxHeight: "60%",
    paddingVertical: 18,
  },
  dateModal: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  relationshipTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2D158B",
    textAlign: "center",
    marginBottom: 12,
  },
  dateActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  dateActionSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F3EEFF",
  },
  dateActionSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6A54A3",
  },
  dateActionPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#7A4EFF",
  },
  dateActionPrimaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  relationshipOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E7FF",
  },
  relationshipOptionText: {
    fontSize: 14,
    color: "#3D267F",
    fontWeight: "700",
  },
});
