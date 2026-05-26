import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  CardStyleInterpolators,
  createStackNavigator,
} from "@react-navigation/stack";

import SplashScreen from "../screens/auth/SplashScreen";
import WelcomeScreen from "../screens/auth/WelcomeScreen";
import AuthProfileScreen from "../screens/auth/ProfileScreen";
import AddFamilyMember from "../screens/auth/AddFamilyMember";
import FirstLoginSetupScreen from "../screens/auth/FirstLoginSetupScreen";
import VerifyIdentity from "../screens/auth/VerifyIdentity";
import VerifyOTP from "../screens/auth/VerifyOTP";
import GalleryScreen from "../screens/media/GalleryScreen";
import ImagesScreen from "../screens/media/ImagesScreen";
import VideosScreen from "../screens/media/VideosScreen";
import FilesScreen from "../screens/media/FilesScreen";
import RecycleBinScreen from "../screens/media/RecycleBinScreen";
import UploadScreen from "../screens/media/UploadScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import NotificationsScreen from "../screens/profile/NotificationsScreen";
import AppearanceScreen from "../screens/profile/AppearanceScreen";
import BackupDashboardScreen from "../screens/backup/BackupDashboardScreen";
import BackupSettingsScreen from "../screens/backup/BackupSettingsScreen";
import BottomNav from "../components/navigation/BottomNav";
import MenuDrawer from "../components/navigation/MenuDrawer";
import { useProfile } from "../context/ProfileContext";
import { useTheme } from "../context/ThemeContext";
import {
  getDefaultAuthenticatedRoute,
  isChildAccount,
  isParentAdmin,
  requiresFirstLoginSetup,
} from "../utils/auth";

const Stack = createStackNavigator();

const withRouteGuard = (ScreenComponent, options = {}) =>
  function GuardedScreen(props) {
    const { isAuthenticated, isBootstrapping, currentUser } = useProfile();
    const { theme } = useTheme();
    const routeName = props.route?.name;

    let redirectRoute = null;

    if (!isBootstrapping) {
      if (options.guestOnly && isAuthenticated) {
        redirectRoute = getDefaultAuthenticatedRoute(currentUser);
      } else if (options.firstLoginOnly) {
        if (!isAuthenticated) {
          redirectRoute = "AuthProfile";
        } else if (!requiresFirstLoginSetup(currentUser)) {
          redirectRoute = getDefaultAuthenticatedRoute(currentUser);
        }
      } else if (options.requireAuth && !isAuthenticated) {
        redirectRoute = "AuthProfile";
      } else if (options.parentAdminOnly) {
        if (!isAuthenticated) {
          redirectRoute = "AuthProfile";
        } else if (!isParentAdmin(currentUser)) {
          redirectRoute = getDefaultAuthenticatedRoute(currentUser);
        } else if (requiresFirstLoginSetup(currentUser)) {
          redirectRoute = "FirstLoginSetup";
        }
      } else if (
        options.requireAuth &&
        requiresFirstLoginSetup(currentUser) &&
        routeName !== "FirstLoginSetup"
      ) {
        redirectRoute = "FirstLoginSetup";
      }

      if (
        options.childOnly &&
        isAuthenticated &&
        !isChildAccount(currentUser)
      ) {
        redirectRoute = getDefaultAuthenticatedRoute(currentUser);
      }
    }

    React.useEffect(() => {
      if (!redirectRoute || redirectRoute === routeName) {
        return;
      }

      props.navigation.reset({
        index: 0,
        routes: [{ name: redirectRoute }],
      });
    }, [props.navigation, redirectRoute, routeName]);

    if (isBootstrapping || (redirectRoute && redirectRoute !== routeName)) {
      return (
        <View style={[styles.guardScreen, { backgroundColor: theme.background }]}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      );
    }

    return <ScreenComponent {...props} />;
  };

const withBottomNav = (ScreenComponent) => {
  return function ScreenWithBottomNav(props) {
    const [menuVisible, setMenuVisible] = React.useState(false);
    const { theme } = useTheme();

    return (
      <View style={[styles.mainScreen, { backgroundColor: theme.background }]}>
        <View style={[styles.scene, { backgroundColor: theme.background }]}>
          <ScreenComponent
            {...props}
            onOpenMenu={() => setMenuVisible(true)}
          />
        </View>
        <BottomNav activeTab={props.route?.name} />
        <MenuDrawer
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
        />
      </View>
    );
  };
};

const GalleryWithBottomNav = withBottomNav(GalleryScreen);
const ImagesWithBottomNav = withBottomNav(ImagesScreen);
const VideosWithBottomNav = withBottomNav(VideosScreen);
const FilesWithBottomNav = withBottomNav(FilesScreen);
const RecycleBinWithBottomNav = withBottomNav(RecycleBinScreen);
const UploadWithBottomNav = withBottomNav(UploadScreen);
const ProfileWithBottomNav = withBottomNav(ProfileScreen);
const EditProfileWithBottomNav = withBottomNav(EditProfileScreen);
const NotificationsWithBottomNav = withBottomNav(NotificationsScreen);
const AppearanceWithBottomNav = withBottomNav(AppearanceScreen);
const BackupDashboardWithBottomNav = withBottomNav(BackupDashboardScreen);
const BackupSettingsWithBottomNav = withBottomNav(BackupSettingsScreen);
const GuardedFirstLoginSetupScreen = withRouteGuard(FirstLoginSetupScreen, {
  firstLoginOnly: true,
});
const GuardedAddFamilyMember = withRouteGuard(AddFamilyMember, {
  requireAuth: true,
  parentAdminOnly: true,
});
const GuardedGallery = withRouteGuard(GalleryWithBottomNav, { requireAuth: true });
const GuardedImages = withRouteGuard(ImagesWithBottomNav, { requireAuth: true });
const GuardedVideos = withRouteGuard(VideosWithBottomNav, { requireAuth: true });
const GuardedFiles = withRouteGuard(FilesWithBottomNav, { requireAuth: true });
const GuardedRecycleBin = withRouteGuard(RecycleBinWithBottomNav, { requireAuth: true });
const GuardedUpload = withRouteGuard(UploadWithBottomNav, { requireAuth: true });
const GuardedProfile = withRouteGuard(ProfileWithBottomNav, { requireAuth: true });
const GuardedEditProfile = withRouteGuard(EditProfileWithBottomNav, { requireAuth: true });
const GuardedNotifications = withRouteGuard(NotificationsWithBottomNav, { requireAuth: true });
const GuardedAppearance = withRouteGuard(AppearanceWithBottomNav, { requireAuth: true });
const GuardedBackupDashboard = withRouteGuard(BackupDashboardWithBottomNav, { requireAuth: true });
const GuardedBackupSettings = withRouteGuard(BackupSettingsWithBottomNav, { requireAuth: true });

const noSwipeBackScreens = [
  "Gallery",
  "Images",
  "Videos",
  "Files",
  "RecycleBin",
  "Upload",
  "Profile",
  "EditProfile",
  "Notifications",
];

const bottomNavScreens = [
  "Gallery",
  "Images",
  "Videos",
  "Files",
  "RecycleBin",
  "Upload",
  "Profile",
  "Appearance",
  "BackupSettings",
  "BackupDashboard",
];

const authRoutes = ["Splash", "Welcome", "AuthProfile"];
const verticalRoutes = ["FirstLoginSetup", "AddFamilyMember", "VerifyIdentity", "VerifyOTP"];

const fastOpenTransition = {
  animation: "timing",
  config: {
    duration: 170,
  },
};

const fastCloseTransition = {
  animation: "timing",
  config: {
    duration: 140,
  },
};

export default function StackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={({ route }) => {
        const isAuthScreen = authRoutes.includes(route.name);
        const isBottomNavScreen = bottomNavScreens.includes(route.name);
        const isVerticalScreen = verticalRoutes.includes(route.name);

        let cardStyleInterpolator = CardStyleInterpolators.forHorizontalIOS;

        if (isAuthScreen) {
          cardStyleInterpolator = CardStyleInterpolators.forFadeFromCenter;
        } else if (isBottomNavScreen) {
          cardStyleInterpolator = CardStyleInterpolators.forFadeFromCenter;
        } else if (isVerticalScreen) {
          cardStyleInterpolator = CardStyleInterpolators.forVerticalIOS;
        }

        return {
          headerShown: false,
          gestureEnabled: !noSwipeBackScreens.includes(route.name),
          animationEnabled: true,
          transitionSpec: {
            open: fastOpenTransition,
            close: fastCloseTransition,
          },
          cardStyleInterpolator,
        };
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="AuthProfile" component={AuthProfileScreen} />
      <Stack.Screen name="FirstLoginSetup" component={GuardedFirstLoginSetupScreen} />
      <Stack.Screen name="AddFamilyMember" component={GuardedAddFamilyMember} />
      <Stack.Screen name="VerifyIdentity" component={VerifyIdentity} />
      <Stack.Screen name="VerifyOTP" component={VerifyOTP} />
      <Stack.Screen name="Gallery" component={GuardedGallery} />
      <Stack.Screen name="Images" component={GuardedImages} />
      <Stack.Screen name="Videos" component={GuardedVideos} />
      <Stack.Screen name="Files" component={GuardedFiles} />
      <Stack.Screen name="RecycleBin" component={GuardedRecycleBin} />
      <Stack.Screen name="Upload" component={GuardedUpload} />
      <Stack.Screen name="Profile" component={GuardedProfile} />
      <Stack.Screen name="EditProfile" component={GuardedEditProfile} />
      <Stack.Screen name="Notifications" component={GuardedNotifications} />
      <Stack.Screen name="Appearance" component={GuardedAppearance} />
      <Stack.Screen name="BackupDashboard" component={GuardedBackupDashboard} />
      <Stack.Screen name="BackupSettings" component={GuardedBackupSettings} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  mainScreen: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },
  scene: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },
  guardScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
