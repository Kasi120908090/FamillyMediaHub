import React from "react";
import {
  ActivityIndicator,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TabView } from "react-native-tab-view";

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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MEDIA_ROUTES = [
  { key: "Gallery", title: "Gallery" },
  { key: "Images", title: "Images" },
  { key: "Videos", title: "Videos" },
  { key: "Files", title: "Files" },
];

const getMediaRouteIndex = (routeName) =>
  Math.max(
    0,
    MEDIA_ROUTES.findIndex((mediaRoute) => mediaRoute.key === routeName)
  );

const withRouteGuard = (ScreenComponent, options = {}) => {
  const GuardedScreen = React.memo(function GuardedScreen(props) {
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
  });

  return GuardedScreen;
};

const withMenuDrawer = (ScreenComponent) => {
  const ScreenWithMenuDrawer = React.memo(function ScreenWithMenuDrawer(props) {
    const [menuVisible, setMenuVisible] = React.useState(false);
    const { theme } = useTheme();
    const openMenu = React.useCallback(() => setMenuVisible(true), []);
    const closeMenu = React.useCallback(() => setMenuVisible(false), []);

    return (
      <View style={[styles.mainScreen, { backgroundColor: theme.background }]}>
        <View style={[styles.scene, { backgroundColor: theme.background }]}>
          <ScreenComponent
            {...props}
            onOpenMenu={openMenu}
          />
        </View>
        <MenuDrawer
          visible={menuVisible}
          onClose={closeMenu}
        />
      </View>
    );
  });

  return ScreenWithMenuDrawer;
};

const ProfileTabScreen = withMenuDrawer(ProfileScreen);
const BackupDashboardTabScreen = withMenuDrawer(BackupDashboardScreen);
const BackupSettingsTabScreen = withMenuDrawer(BackupSettingsScreen);
const RecycleBinWithMenuDrawer = withMenuDrawer(RecycleBinScreen);
const UploadWithMenuDrawer = withMenuDrawer(UploadScreen);
const EditProfileWithMenuDrawer = withMenuDrawer(EditProfileScreen);
const NotificationsWithMenuDrawer = withMenuDrawer(NotificationsScreen);
const AppearanceWithMenuDrawer = withMenuDrawer(AppearanceScreen);
const GuardedFirstLoginSetupScreen = withRouteGuard(FirstLoginSetupScreen, {
  firstLoginOnly: true,
});
const GuardedAddFamilyMember = withRouteGuard(AddFamilyMember, {
  requireAuth: true,
  parentAdminOnly: true,
});
const GuardedRecycleBin = withRouteGuard(RecycleBinWithMenuDrawer, { requireAuth: true });
const GuardedUpload = withRouteGuard(UploadWithMenuDrawer, { requireAuth: true });
const GuardedEditProfile = withRouteGuard(EditProfileWithMenuDrawer, { requireAuth: true });
const GuardedNotifications = withRouteGuard(NotificationsWithMenuDrawer, { requireAuth: true });
const GuardedAppearance = withRouteGuard(AppearanceWithMenuDrawer, { requireAuth: true });

const MediaTabs = React.memo(function MediaTabs({ navigation, route }) {
  const [menuVisible, setMenuVisible] = React.useState(false);
  const layout = useWindowDimensions();
  const { theme } = useTheme();
  const targetMediaTab = route.params?.mediaTab || "Gallery";
  const [index, setIndex] = React.useState(() => getMediaRouteIndex(targetMediaTab));
  const routes = React.useMemo(() => MEDIA_ROUTES, []);
  const openMenu = React.useCallback(() => setMenuVisible(true), []);
  const closeMenu = React.useCallback(() => setMenuVisible(false), []);

  React.useEffect(() => {
    const nextIndex = getMediaRouteIndex(targetMediaTab);
    setIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
  }, [targetMediaTab]);

  const handleIndexChange = React.useCallback(
    (nextIndex) => {
      const nextRoute = MEDIA_ROUTES[nextIndex]?.key || "Gallery";
      setIndex(nextIndex);
      navigation.setParams({ mediaTab: nextRoute });
    },
    [navigation]
  );

  const sceneProps = React.useMemo(
    () => ({
      navigation,
      onOpenMenu: openMenu,
    }),
    [navigation, openMenu]
  );

  const renderScene = React.useCallback(
    ({ route: mediaRoute }) => {
      switch (mediaRoute.key) {
        case "Images":
          return <ImagesScreen {...sceneProps} />;
        case "Videos":
          return <VideosScreen {...sceneProps} />;
        case "Files":
          return <FilesScreen {...sceneProps} />;
        case "Gallery":
        default:
          return <GalleryScreen {...sceneProps} />;
      }
    },
    [sceneProps]
  );

  return (
    <View style={[styles.mainScreen, { backgroundColor: theme.background }]}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        renderTabBar={() => null}
        onIndexChange={handleIndexChange}
        initialLayout={{ width: layout.width }}
        lazy
        lazyPreloadDistance={1}
        swipeEnabled
        animationEnabled
        style={styles.scene}
      />
      <MenuDrawer visible={menuVisible} onClose={closeMenu} />
    </View>
  );
});

const MediaTabAlias = React.memo(function MediaTabAlias({ navigation, route }) {
  React.useEffect(() => {
    navigation.replace("Gallery", { mediaTab: route.name });
  }, [navigation, route.name]);

  return null;
});

function MainTabs() {
  const renderTabBar = React.useCallback(
    (tabBarProps) => <BottomNav {...tabBarProps} />,
    []
  );

  const tabScreenOptions = React.useMemo(
    () => ({
      headerShown: false,
      lazy: true,
      freezeOnBlur: true,
      animation: "shift",
      transitionSpec: {
        animation: "timing",
        config: {
          duration: 170,
          easing: Easing.out(Easing.cubic),
        },
      },
    }),
    []
  );

  return (
    <Tab.Navigator
      initialRouteName="Gallery"
      tabBar={renderTabBar}
      detachInactiveScreens
      screenOptions={tabScreenOptions}
    >
      <Tab.Screen name="Gallery" component={MediaTabs} />
      <Tab.Screen name="Images" component={MediaTabAlias} />
      <Tab.Screen name="Videos" component={MediaTabAlias} />
      <Tab.Screen name="Files" component={MediaTabAlias} />
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
      <Tab.Screen name="BackupDashboard" component={BackupDashboardTabScreen} />
      <Tab.Screen name="BackupSettings" component={BackupSettingsTabScreen} />
    </Tab.Navigator>
  );
}

const GuardedMainTabs = withRouteGuard(MainTabs, { requireAuth: true });

const noSwipeBackScreens = [
  "MainTabs",
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

const verticalRoutes = ["FirstLoginSetup", "AddFamilyMember", "VerifyIdentity", "VerifyOTP"];

export default function StackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={({ route }) => {
        const isVerticalScreen = verticalRoutes.includes(route.name);

        return {
          headerShown: false,
          gestureEnabled: !noSwipeBackScreens.includes(route.name),
          animation: isVerticalScreen ? "slide_from_bottom" : "slide_from_right",
          animationDuration: isVerticalScreen ? 240 : 220,
          fullScreenGestureEnabled: !noSwipeBackScreens.includes(route.name),
          freezeOnBlur: true,
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
      <Stack.Screen name="MainTabs" component={GuardedMainTabs} />
      <Stack.Screen name="RecycleBin" component={GuardedRecycleBin} />
      <Stack.Screen name="Upload" component={GuardedUpload} />
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
