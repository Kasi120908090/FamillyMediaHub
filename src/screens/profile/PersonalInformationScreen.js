import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/navigation/AppHeader";
import { useProfile } from "../../context/ProfileContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { useTheme } from "../../context/ThemeContext";

export default function PersonalInformationScreen({ navigation }) {
  const { profile } = useProfile();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Personal Information"
        showBackButton={true}
        navigation={navigation}
        navigateTo="Profile"
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          {profile?.image ? (
            <Image source={{ uri: profile.image }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage, { backgroundColor: theme.muted }]}>
              <Ionicons name="person" size={40} color={theme.mutedText} />
            </View>
          )}
          <Text style={[styles.name, { color: theme.text }]}>{profile.name}</Text>
          <Text style={[styles.role, { color: theme.subText }]}>{profile.role}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          <InfoItem label="Full Name" value={profile.name} icon="person-outline" />
          <InfoItem label="Username" value={profile.username} icon="at-outline" />
          <InfoItem label="Email" value={profile.email} icon="mail-outline" />
          <InfoItem label="Phone Number" value={profile.phone || "Not provided"} icon="call-outline" isLast />
        </View>
      </ScrollView>
    </View>
  );
}

const InfoItem = ({ label, value, icon, isLast }) => (
  <InfoItemContent label={label} value={value} icon={icon} isLast={isLast} />
);

const InfoItemContent = ({ label, value, icon, isLast }) => {
  const { theme } = useTheme();

  return (
  <View style={[styles.infoItem, { borderBottomColor: theme.border }, isLast && styles.lastItem]}>
    <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
      <Ionicons name={icon} size={20} color={theme.primary} />
    </View>
    <View style={styles.textContainer}>
      <Text style={[styles.label, { color: theme.subText }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
    </View>
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
  },
  role: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    borderRadius: 12,
    padding: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: "500",
  },
});
