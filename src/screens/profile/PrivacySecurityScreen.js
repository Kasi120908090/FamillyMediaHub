import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/navigation/AppHeader";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";
import { useTheme } from "../../context/ThemeContext";

export default function PrivacySecurityScreen({ navigation, onOpenMenu }) {
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [locationSharing, setLocationSharing] = useState(true);
  const { theme } = useTheme();

  const handlePasswordChange = () => {
    Alert.alert("Change Password", "Navigate to password change flow.");
  };

  const handleBlockedUsers = () => {
    Alert.alert("Blocked Users", "Navigate to blocked users list.");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => console.log("Account Deleted") },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Privacy & Security"
        showBackButton={true}
        navigation={navigation}
        navigateTo="Profile"
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* SECURITY SETTINGS */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Security</Text>

          <SimpleItem
            title="Change Password"
            subtitle="Update your account password"
            onPress={handlePasswordChange}
          />

          <ToggleItem
            title="Two-Factor Authentication"
            subtitle="Add an extra layer of security"
            value={twoFactorAuth}
            onChange={setTwoFactorAuth}
          />
        </View>

        {/* PRIVACY SETTINGS */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Privacy</Text>

          <ToggleItem
            title="Private Profile"
            subtitle="Only approved followers can see your content"
            value={privateProfile}
            onChange={setPrivateProfile}
          />

          <ToggleItem
            title="Location Sharing"
            subtitle="Allow sharing your location with family"
            value={locationSharing}
            onChange={setLocationSharing}
          />

          <SimpleItem
            title="Blocked Users"
            subtitle="Manage users you have blocked"
            onPress={handleBlockedUsers}
          />
        </View>

        {/* DATA & ACCOUNT */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Data & Account</Text>

          <SimpleItem
            title="Download Your Data"
            subtitle="Request a copy of your account data"
          />

          <SimpleItem
            title="Delete Account"
            subtitle="Permanently delete your account and data"
            danger
            onPress={handleDeleteAccount}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const ToggleItem = ({ title, subtitle, value, onChange }) => {
  const { theme } = useTheme();

  return (
  <View style={[styles.toggleRow, { borderBottomColor: theme.border }]}>
    <View>
      <Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.itemSub, { color: theme.subText }]}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: theme.border, true: theme.secondary }}
      thumbColor={value ? theme.primary : theme.surface}
      ios_backgroundColor={theme.border}
    />
  </View>
  );
};

const SimpleItem = ({ title, subtitle, danger, onPress }) => {
  const { theme } = useTheme();

  return (
  <TouchableOpacity
    style={[styles.simpleItem, { borderBottomColor: theme.border }]}
    onPress={onPress}
    activeOpacity={0.78}
  >
    <View>
      <Text style={[styles.itemTitle, { color: danger ? theme.danger : theme.text }]}>
        {title}
      </Text>
      {subtitle && <Text style={[styles.itemSub, { color: theme.subText }]}>{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
  </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  card: {
    marginHorizontal: SCREEN_HORIZONTAL_PADDING,
    marginVertical: 10,
    borderRadius: 12,
    padding: 15,
  },

  sectionTitle: {
    fontWeight: "600",
    marginBottom: 10,
    fontSize: 16,
  },

  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  simpleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  itemTitle: {
    fontWeight: "500",
    fontSize: 14,
  },

  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
