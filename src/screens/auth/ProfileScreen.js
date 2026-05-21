import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
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
import { isChildAccount, isParentAdminReady } from "../../utils/auth";

const PROFILE_CACHE_KEY = "@family-media-hub/profile-options";

const getLoggedInChildId = (user) =>
  user?.child_id ||
  user?.childId ||
  user?.child_profile_id ||
  user?.childProfileId ||
  user?.child?.id ||
  user?.child_profile?.id ||
  user?.childProfile?.id ||
  user?.profile?.id ||
  user?.id ||
  null;

const getProfileIdentity = (item, index = 0) => {
  const type = item?.isAddCard ? "add" : item?.isParent ? "parent" : "profile";
  const idPart = item?.id ?? "no-id";
  const loginPart = item?.loginId || item?.name || `item-${index}`;
  return `${type}:${idPart}:${loginPart}`;
};

const uniqueProfiles = (profiles = []) => {
  const seen = new Set();

  return profiles.filter((item, index) => {
    const identity = getProfileIdentity(item, index);

    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
};

export default function ProfileScreen({ navigation }) {
  const {
    authToken,
    children,
    currentUser,
    isAuthenticated,
    isBootstrapping,
    isSubmitting,
    login,
    profile,
    refreshChildren,
  } = useAuth();
  const { width } = useWindowDimensions();
  const [cachedProfiles, setCachedProfiles] = useState([]);
  const [isLoadingCachedProfiles, setIsLoadingCachedProfiles] = useState(true);
  const [selectedGuestProfile, setSelectedGuestProfile] = useState(null);
  const [selectedActionMode, setSelectedActionMode] = useState("open-profile");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestPasswordVisible, setGuestPasswordVisible] = useState(false);
  const [guestPasswordError, setGuestPasswordError] = useState("");
  const [isGuestSigningIn, setIsGuestSigningIn] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordVisible, setAdminPasswordVisible] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [showParentImportModal, setShowParentImportModal] = useState(false);
  const [parentLoginId, setParentLoginId] = useState("");
  const [parentImportPassword, setParentImportPassword] = useState("");
  const [parentImportPasswordVisible, setParentImportPasswordVisible] = useState(false);
  const [parentImportError, setParentImportError] = useState("");
  const [isImportingParent, setIsImportingParent] = useState(false);
  const childUser = isChildAccount(currentUser);
  const parentReady = isParentAdminReady(currentUser);
  const cardWidth = Math.min(84, Math.max(74, (width - 74) / 4));

  useEffect(() => {
    let isMounted = true;

    const loadCachedProfiles = async () => {
      try {
        const saved = await AsyncStorage.getItem(PROFILE_CACHE_KEY);

        if (!isMounted || !saved) {
          if (isMounted) {
            setCachedProfiles([]);
          }
          return;
        }

        const parsed = JSON.parse(saved);
        setCachedProfiles(uniqueProfiles(Array.isArray(parsed) ? parsed : []));
      } catch {
        if (isMounted) {
          setCachedProfiles([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCachedProfiles(false);
        }
      }
    };

    loadCachedProfiles();

    return () => {
      isMounted = false;
    };
  }, []);

  const parentAccount = useMemo(
    () =>
      currentUser?.parent ||
      currentUser?.parent_profile ||
      currentUser?.parentProfile ||
      currentUser?.parent_user ||
      currentUser?.parentUser ||
      null,
    [currentUser]
  );

  const familyProfiles = useMemo(() => {
    const loggedInChildId = childUser ? getLoggedInChildId(currentUser) : null;
    const selfProfile = {
      id: loggedInChildId || currentUser?.id || "self",
      name: profile.name || "Admin",
      role: childUser ? "Member" : "Administrator",
      loginId:
        profile.username ||
        profile.email ||
        currentUser?.username ||
        currentUser?.email ||
        "",
      image: profile.image,
      isParent: !childUser,
      isSelf: true,
    };

    const childProfiles = children.map((child) => ({
      id: child.id,
      name: child.name || child.full_name || child.username || "Member",
      role: child.relationship || "Member",
      loginId: child.username || child.email || "",
      image: child.avatar_url || child.profile_image || child.image || "",
      isParent: false,
      isSelf: false,
    }));

    if (childUser) {
      const parentProfile = parentAccount
        ? {
            id: parentAccount.id || "parent",
            name:
              parentAccount.name ||
              parentAccount.full_name ||
              parentAccount.username ||
              "Admin",
            role: "Owner",
            loginId: parentAccount.username || parentAccount.email || "",
            image: parentAccount.avatar_url || parentAccount.image || "",
            isParent: true,
            isSelf: false,
          }
        : null;

      const siblingProfiles = childProfiles.filter(
        (item) => String(item.id) !== String(selfProfile.id)
      );

      return uniqueProfiles([
        ...(parentProfile ? [parentProfile] : []),
        selfProfile,
        ...siblingProfiles,
      ]);
    }

    return uniqueProfiles([selfProfile, ...childProfiles]);
  }, [childUser, children, currentUser, parentAccount, profile]);

  const visibleProfiles = useMemo(() => {
    const baseProfiles = isAuthenticated ? familyProfiles : cachedProfiles;

    if (!baseProfiles.length && !isAuthenticated) {
      return [];
    }

    const parentProfiles = baseProfiles.filter((p) => p.isParent);
    const memberProfiles = baseProfiles.filter((p) => !p.isParent);

    const addCard = {
      id: "add-user-card",
      name: "Add User",
      role: isAuthenticated && parentReady ? "Create profile" : "Admin only",
      image: "",
      loginId: "",
      isAddCard: true,
    };

    return uniqueProfiles([...parentProfiles, ...memberProfiles, addCard]);
  }, [cachedProfiles, familyProfiles, isAuthenticated, parentReady]);

  const showCachedProfilesLoader =
    isBootstrapping || (!isAuthenticated && isLoadingCachedProfiles);
  const needsParentImport = !isAuthenticated && !cachedProfiles.length;

  const adminCandidateProfile = useMemo(
    () =>
      visibleProfiles.find(
        (item) =>
          !item?.isAddCard &&
          item?.isParent &&
          item?.loginId
      ) || null,
    [visibleProfiles]
  );

  useEffect(() => {
    if (!isAuthenticated || !familyProfiles.length) {
      return;
    }

    const profilesToStore = familyProfiles.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      image: item.image,
      loginId: item.loginId || "",
      isParent: Boolean(item.isParent),
    }));

    const uniqueStoredProfiles = uniqueProfiles(profilesToStore);
    setCachedProfiles(uniqueStoredProfiles);
    AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(uniqueStoredProfiles)).catch(() => {});
  }, [familyProfiles, isAuthenticated]);

  const getPostLoginRoute = (routeName) =>
    routeName === "FirstLoginSetup" ? "FirstLoginSetup" : "Gallery";

  const closeParentImportModal = () => {
    setShowParentImportModal(false);
    setParentLoginId("");
    setParentImportPassword("");
    setParentImportPasswordVisible(false);
    setParentImportError("");
  };

  const handleParentImport = async () => {
    if (!parentLoginId.trim()) {
      setParentImportError("Parent username or email is required.");
      return;
    }

    if (!parentImportPassword.trim()) {
      setParentImportError("Parent password is required.");
      return;
    }

    try {
      setIsImportingParent(true);
      setParentImportError("");
      const response = await login({
        username: parentLoginId.trim(),
        password: parentImportPassword.trim(),
      });

      closeParentImportModal();

      if (response?.route === "FirstLoginSetup") {
        navigation.reset({
          index: 0,
          routes: [{ name: "FirstLoginSetup" }],
        });
        return;
      }

      Alert.alert(
        "Profiles synced",
        "The family profiles are now available on this device. Tap the parent profile card to continue into the app."
      );
    } catch (error) {
      setParentImportError(error.message || "Unable to sync the parent profile.");
    } finally {
      setIsImportingParent(false);
    }
  };

  const handleGuestContinue = async () => {
    if (!selectedGuestProfile?.loginId) {
      return;
    }

    if (!guestPassword.trim()) {
      setGuestPasswordError("Password is required.");
      return;
    }

    try {
      setIsGuestSigningIn(true);
      const enteredPassword = guestPassword.trim();
      const currentActionMode = selectedActionMode;
      const response = await login({
        username: selectedGuestProfile.loginId,
        password: enteredPassword,
      });

      setSelectedGuestProfile(null);
      setSelectedActionMode("open-profile");
      setGuestPassword("");
      setGuestPasswordError("");

      if (currentActionMode === "add-user") {
        const nextRoute = response?.route === "FirstLoginSetup" ? "FirstLoginSetup" : "AddFamilyMember";
        navigation.reset({
          index: 0,
          routes:
            nextRoute === "AddFamilyMember"
              ? [{ name: "AddFamilyMember", params: { adminPassword: enteredPassword } }]
              : [{ name: "FirstLoginSetup" }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: getPostLoginRoute(response?.route) }],
        });
      }
    } catch (error) {
      Alert.alert("Login failed", error.message);
    } finally {
      setIsGuestSigningIn(false);
    }
  };

  const handleVerifyAdminPassword = async () => {
    if (!adminPassword.trim()) {
      setAdminPasswordError("Admin password is required.");
      return;
    }

    try {
      setIsVerifyingPassword(true);
      setAdminPasswordError("");
      await authService.verifyPassword(adminPassword.trim(), authToken);

      const verifiedPassword = adminPassword.trim();
      setShowAdminPasswordModal(false);
      setAdminPassword("");

      navigation.navigate("AddFamilyMember", {
        adminPassword: verifiedPassword,
      });
    } catch {
      setAdminPasswordError("Incorrect admin password. Please try again.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleProfilePress = async (item) => {
    if (item.isAddCard) {
      if (isAuthenticated && parentReady) {
        setAdminPassword("");
        setAdminPasswordError("");
        setShowAdminPasswordModal(true);
      } else if (adminCandidateProfile) {
        setSelectedGuestProfile(adminCandidateProfile);
        setSelectedActionMode("add-user");
        setGuestPassword("");
        setGuestPasswordError("");
      } else {
        setShowAccessDeniedModal(true);
      }
      return;
    }

    if (!item.loginId) {
      Alert.alert("Profile unavailable", "This profile does not have a saved login id yet.");
      return;
    }

    setSelectedGuestProfile(item);
    // Default action mode is open-profile
    setSelectedActionMode("open-profile"); 
    setGuestPassword("");
    setGuestPasswordError("");
  };

  const rightSlot = isAuthenticated ? (
    <View style={styles.rightHeaderRow}>
      <View style={styles.smallIconButton}>
        <Ionicons name="notifications-outline" size={28} color="#5A35F0" />
      </View>
      <ThemedAvatar uri={profile.image} name={profile.name} style={styles.headerAvatar} />
    </View>
  ) : (
    <View style={styles.smallIconButton}>
      <Ionicons name="notifications-outline" size={28} color="#5A35F0" />
    </View>
  );

  return (
    <AuthFlowShell rightSlot={rightSlot}>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <SectionTitle
            title={"Who's using\nFamily Media Hub?"}
            subtitle="Choose a profile to continue. Every profile requires its password before opening the account."
            titleStyle={styles.heroTitle}
          />
        </View>
        <FamilyHeroIllustration />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Profiles</Text>
        {isAuthenticated ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => refreshChildren().catch(() => {})}
            disabled={isSubmitting}
            style={styles.editPill}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#5A23E5" />
            ) : (
              <>
                <Text style={styles.editPillText}>Refresh</Text>
                <Ionicons name="refresh-outline" size={12} color="#6E4CDE" />
              </>
            )}
          </TouchableOpacity>
        ) : needsParentImport ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowParentImportModal(true)}
            style={styles.editPill}
          >
            <Text style={styles.editPillText}>Import Parent</Text>
            <Ionicons name="cloud-download-outline" size={12} color="#6E4CDE" />
          </TouchableOpacity>
        ) : null}
      </View>

      {showCachedProfilesLoader ? (
        <FlowCard style={styles.loadingStateCard}>
          <ActivityIndicator size="small" color="#5A23E5" />
          <Text style={styles.loadingStateTitle}>Loading family profiles</Text>
          <Text style={styles.loadingStateText}>
            Checking this device for the saved parent and child profiles.
          </Text>
        </FlowCard>
      ) : visibleProfiles.length ? (
        <View style={styles.profileGrid}>
          {visibleProfiles.map((item, index) => (
            <TouchableOpacity
              key={getProfileIdentity(item, index)}
              style={[
                styles.profileCard,
                { width: cardWidth },
                item.isAddCard ? styles.profileCardAdd : null,
              ]}
              activeOpacity={0.9}
              onPress={() => handleProfilePress(item)}
              disabled={isSubmitting && !item.isAddCard}
            >
              <View style={[styles.profileVisual, item.isAddCard ? styles.profileVisualAdd : null]}>
                {item.isAddCard ? (
                  <Ionicons name="add" size={24} color="#7B58F8" />
                ) : item.image && !String(item.image).includes("ui-avatars.com") ? (
                  <ThemedAvatar uri={item.image} name={item.name} style={styles.profileAvatar} />
                ) : (
                  <Ionicons
                    name={item.isParent ? "person" : "person-outline"}
                    size={34}
                    color={item.isParent ? "#5A23E5" : "#5B8EFF"}
                  />
                )}
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.profileRole} numberOfLines={1}>
                {item.role}
              </Text>
              {item.isSelf ? (
                <Text style={styles.profileBadge}>Owner</Text>
              ) : (
                <View style={styles.profileBadgeSpacer} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlowCard style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>No saved family profiles yet</Text>
          <Text style={styles.emptyStateText}>
            Import the parent account once on this device. After that, the parent and child
            profiles will appear here whenever the app starts.
          </Text>
          <PrimaryAction
            label="Import Parent Profile"
            onPress={() => setShowParentImportModal(true)}
            icon="cloud-download-outline"
          />
        </FlowCard>
      )}

      <InfoBanner
        text={
          isAuthenticated
            ? "Tap any parent or child profile, enter the password, and then the app will open that account."
            : needsParentImport
            ? "Import the parent account once on this device. After that, the saved parent profiles will open from this screen directly."
            : "Tap the saved parent profile, enter the password, and continue into the app."
        }
      />

      <Modal visible={showParentImportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardWrap}
          >
            <FlowCard style={styles.modalCard}>
              <View style={styles.modalIllustrationWrap}>
                <FamilyHeroIllustration />
              </View>
              <Text style={styles.modalTitle}>Import Parent Profile</Text>
              <Text style={styles.modalSubtitle}>
                Use the parent account once to load the saved family profiles from the database to
                this device. After that, this screen becomes your main entry flow.
              </Text>
              <FlowInput
                value={parentLoginId}
                onChangeText={(value) => {
                  setParentLoginId(value);
                  if (parentImportError) {
                    setParentImportError("");
                  }
                }}
                placeholder="Enter parent username or email"
                icon="person-outline"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <FlowInput
                value={parentImportPassword}
                onChangeText={(value) => {
                  setParentImportPassword(value);
                  if (parentImportError) {
                    setParentImportError("");
                  }
                }}
                placeholder="Enter parent password"
                icon="lock-closed-outline"
                secureTextEntry
                secureVisible={parentImportPasswordVisible}
                onToggleSecure={() => setParentImportPasswordVisible((current) => !current)}
                error={parentImportError}
              />
              <PrimaryAction
                label="Import Profiles"
                onPress={handleParentImport}
                loading={isImportingParent}
                icon="cloud-download-outline"
              />
              <SecondaryAction label="Cancel" onPress={closeParentImportModal} />
            </FlowCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedGuestProfile)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardWrap}
          >
            <FlowCard style={styles.modalCard}>
              <View style={styles.modalIllustrationWrap}>
                <FamilyHeroIllustration locked />
              </View>
              <Text style={styles.modalTitle}>
                {selectedActionMode === "add-user" ? "Verify Admin Password" : "Enter Password"}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedActionMode === "add-user"
                  ? `Enter the admin password for ${selectedGuestProfile?.name || "the admin account"} to continue adding a family member.`
                  : `Enter your password to continue as ${selectedGuestProfile?.name || "this user"}.`}
              </Text>
              <FlowInput
                value={guestPassword}
                onChangeText={(value) => {
                  setGuestPassword(value);
                  if (guestPasswordError) {
                    setGuestPasswordError("");
                  }
                }}
                placeholder="Enter your password"
                icon="lock-closed-outline"
                secureTextEntry
                secureVisible={guestPasswordVisible}
                onToggleSecure={() => setGuestPasswordVisible((current) => !current)}
                error={guestPasswordError}
                autoFocus
              />
              <PrimaryAction
                label={selectedActionMode === "add-user" ? "Verify & Continue" : "Continue"}
                onPress={handleGuestContinue}
                loading={isGuestSigningIn}
                icon="arrow-forward"
              />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate("VerifyIdentity")}
                style={styles.modalLinkButton}
              >
                <Text style={styles.modalLink}>Forgot Password?</Text>
              </TouchableOpacity>
              <SecondaryAction
                label="Cancel"
                onPress={() => {
                  setSelectedGuestProfile(null);
                  setSelectedActionMode("open-profile");
                  setGuestPassword("");
                  setGuestPasswordVisible(false);
                  setGuestPasswordError("");
                }}
              />
            </FlowCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showAdminPasswordModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardWrap}
          >
            <FlowCard style={styles.modalCard}>
              <View style={styles.modalIllustrationWrap}>
                <FamilyHeroIllustration locked />
              </View>
              <Text style={styles.modalTitle}>Verify Admin Password</Text>
              <Text style={styles.modalSubtitle}>
                For security reasons, please enter your admin password to add a new user.
              </Text>
              <FlowInput
                value={adminPassword}
                onChangeText={(value) => {
                  setAdminPassword(value);
                  if (adminPasswordError) {
                    setAdminPasswordError("");
                  }
                }}
                placeholder="Enter admin password"
                icon="lock-closed-outline"
                secureTextEntry
                secureVisible={adminPasswordVisible}
                onToggleSecure={() => setAdminPasswordVisible((current) => !current)}
                error={adminPasswordError}
                autoFocus
              />
              <PrimaryAction
                label="Verify"
                onPress={handleVerifyAdminPassword}
                loading={isVerifyingPassword}
                icon="checkmark"
              />
              <SecondaryAction
                label="Cancel"
                onPress={() => {
                  setShowAdminPasswordModal(false);
                  setAdminPassword("");
                  setAdminPasswordVisible(false);
                  setAdminPasswordError("");
                }}
              />
            </FlowCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showAccessDeniedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalKeyboardWrap}>
            <FlowCard style={styles.modalCard}>
              <View style={styles.modalIllustrationWrap}>
                <FamilyHeroIllustration locked />
              </View>
              <Text style={styles.modalTitle}>Access Restricted</Text>
              <Text style={styles.modalSubtitle}>
                Sign in to the admin profile first, then tap Add User and verify the admin password.
              </Text>
              <PrimaryAction
                label="OK"
                onPress={() => setShowAccessDeniedModal(false)}
                icon="checkmark"
              />
            </FlowCard>
          </View>
        </View>
      </Modal>
    </AuthFlowShell>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: 20,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 12,
    
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 31,
  },
  rightHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    
  },
  smallIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F2ECFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEE6FF",
    
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 32,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4633A7",
  },
  editPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F4EFFF",
    borderWidth: 1,
    borderColor: "#EBE2FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6E4CDE",
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    rowGap: 12,
    columnGap: 12,
  },
  profileCard: {
    minHeight: 132,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0E7FF",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    shadowColor: "#8B61F8",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  profileCardAdd: {
    borderStyle: "dashed",
    backgroundColor: "#FDFCFF",
  },
  profileVisual: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F2ECFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  profileVisualAdd: {
    backgroundColor: "#FBF8FF",
    borderWidth: 1,
    borderColor: "#ECE1FF",
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  profileName: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: "#2D158B",
    textAlign: "center",
  },
  profileRole: {
    marginTop: 4,
    fontSize: 9,
    lineHeight: 12,
    color: "#8A7EB3",
    textAlign: "center",
  },
  profileBadge: {
    marginTop: 8,
    fontSize: 8,
    fontWeight: "800",
    color: "#7E58F8",
  },
  profileBadgeSpacer: {
    height: 17,
  },
  emptyStateCard: {
    marginBottom: 4,
  },
  loadingStateCard: {
    marginBottom: 4,
    alignItems: "center",
  },
  loadingStateTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "900",
    color: "#2D158B",
    textAlign: "center",
  },
  loadingStateText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: "#8C80B8",
    textAlign: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2D158B",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C80B8",
    marginBottom: 16,
  },
  guestActionCard: {
    marginTop: 14,
  },
  guestActionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2D158B",
    marginBottom: 8,
  },
  guestActionText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8C80B8",
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(32, 21, 88, 0.34)",
    justifyContent: "center",
    padding: 24,
  },
  modalKeyboardWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  modalIllustrationWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2D158B",
    textAlign: "center",
  },
  modalSubtitle: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 12,
    lineHeight: 18,
    color: "#8C80B8",
    textAlign: "center",
  },
  modalLinkButton: {
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 10,
  },
  modalLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6E4CDE",
  },
});
