import React from "react";
import { ActivityIndicator, Easing, StyleSheet, View } from "react-native";
import {
  CardStyleInterpolators,
  createStackNavigator,
} from "@react-navigation/stack";

import SplashScreen from "../screens/auth/SplashScreen";
import LoginScreen from "../screens/auth/LoginScreen";
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
const GuardedWelcomeScreen = withRouteGuard(WelcomeScreen, { guestOnly: true });
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
];

const openTransition = {
  animation: "timing",
  config: {
    duration: 220,
    easing: Easing.out(Easing.quad),
  },
};

const closeTransition = {
  animation: "timing",
  config: {
    duration: 180,
    easing: Easing.in(Easing.quad),
  },
};

const quickFadeInterpolator = ({ current }) => {
  const opacity = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return {
    cardStyle: {
      opacity,
    },
  };
};

const smoothSlideInterpolator = ({ current, layouts }) => {
  const opacity = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  const translateX = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [layouts.screen.width * 0.08, 0],
  });

  return {
    cardStyle: {
      opacity,
      transform: [{ translateX }],
    },
  };
};

export default function StackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="AuthProfile"
      screenOptions={({ route }) => {
        const isAuthScreen = ["Splash", "Login", "Welcome", "AuthProfile"].includes(route.name);
        const isBottomNavScreen = bottomNavScreens.includes(route.name);

        return {
          headerShown: false,
          gestureEnabled: !noSwipeBackScreens.includes(route.name),
          animationEnabled: true,
          transitionSpec: {
            open: openTransition,
            close: closeTransition,
          },
          cardStyleInterpolator: isAuthScreen
            ? CardStyleInterpolators.forFadeFromBottomAndroid
            : isBottomNavScreen
              ? quickFadeInterpolator
              : smoothSlideInterpolator,
        };
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Welcome" component={GuardedWelcomeScreen} />
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
