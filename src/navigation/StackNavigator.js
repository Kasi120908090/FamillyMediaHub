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
import FullScreenVideoScreen from "../screens/media/FullScreenVideoScreen";
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
  const [animationEnabled, setAnimationEnabled] = React.useState(false);
  const routes = React.useMemo(() => MEDIA_ROUTES, []);
  const [loadedRoutes, setLoadedRoutes] = React.useState(() => [routes[getMediaRouteIndex(targetMediaTab)]?.key || "Gallery"]);
  const tabRenderCount = React.useRef(0);
  const tabSwitchRef = React.useRef(null);
  const isSwipeRef = React.useRef(false);
  
  // Gesture tracking to prevent vertical scrolls from triggering horizontal swipes
  // Issue: Users accidentally switch tabs when scrolling vertically
  // Solution: Detect gesture direction and disable swipe if primarily vertical
  const gestureStateRef = React.useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isVerticalScroll: false,
  });
  const [swipeEnabledState, setSwipeEnabledState] = React.useState(true);
  const swipeEnabledRef = React.useRef(true);

  // Update ref whenever state changes
  React.useEffect(() => {
    swipeEnabledRef.current = swipeEnabledState;
  }, [swipeEnabledState]);
  
  const openMenu = React.useCallback(() => setMenuVisible(true), []);
  const closeMenu = React.useCallback(() => setMenuVisible(false), []);

  tabRenderCount.current += 1;

  React.useEffect(() => {
    console.log("[Perf] MediaTabs mounted", { renderCount: tabRenderCount.current, initialTab: targetMediaTab });
    return () => console.log("[Perf] MediaTabs unmounted", { finalTab: routes[index]?.key });
  }, []);



  React.useEffect(() => {
    const nextIndex = getMediaRouteIndex(targetMediaTab);
    setIndex((currentIndex) => {
      if (currentIndex === nextIndex) {
        return currentIndex;
      }
      // Params-driven change (from BottomNav or setParams): disable animation
      if (!isSwipeRef.current) {
        setAnimationEnabled(false);
      }
      return nextIndex;
    });
  }, [targetMediaTab]);

  React.useEffect(() => {
    const nextKey = routes[index]?.key || "Gallery";
    setLoadedRoutes((previous) =>
      previous.includes(nextKey) ? previous : [...previous, nextKey]
    );
  }, [index, routes]);

  const handleIndexChange = React.useCallback(
    (nextIndex) => {
      const nextRoute = MEDIA_ROUTES[nextIndex]?.key || "Gallery";
      const currentRoute = routes[index]?.key || "Gallery";
      console.log("[Perf] Tab change requested", { from: currentRoute, to: nextRoute, currentIndex: index, nextIndex });
      tabSwitchRef.current = `${currentRoute}->${nextRoute}-${Date.now()}`;
      // Mark this as a swipe gesture
      isSwipeRef.current = true;
      setAnimationEnabled(true);
      setIndex(nextIndex);
      navigation.setParams({ mediaTab: nextRoute });
      // Reset swipe flag after a brief delay
      setTimeout(() => {
        isSwipeRef.current = false;
      }, 50);
    },
    [navigation, index, routes]
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
      const isLoaded = loadedRoutes.includes(mediaRoute.key);
      console.log("[Perf] TabView.renderScene", { route: mediaRoute.key, isLoaded, activeIndex: index });
      if (!isLoaded) {
        return <View style={styles.scene} />;
      }

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
    [loadedRoutes, sceneProps, index]
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
        lazyPreloadDistance={0}
        renderLazyPlaceholder={() => <View style={styles.scene} />}
        swipeEnabled={true}
        animationEnabled={animationEnabled}
        style={styles.scene}
      />
      <MenuDrawer visible={menuVisible} onClose={closeMenu} />
    </View>
  );
});

function MainTabs() {
  const renderTabBar = React.useCallback((tabBarProps) => <BottomNav {...tabBarProps} />, []);

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
    <View style={{ flex: 1 }}>
      <Tab.Navigator
      initialRouteName="Gallery"
      tabBar={renderTabBar}
      detachInactiveScreens
      screenOptions={tabScreenOptions}
    >
      <Tab.Screen name="Gallery" component={MediaTabs} />
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
      <Tab.Screen name="BackupDashboard" component={BackupDashboardTabScreen} />
      <Tab.Screen name="BackupSettings" component={BackupSettingsTabScreen} />
    </Tab.Navigator>
    </View>
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
      <Stack.Screen name="FullScreenVideo" component={FullScreenVideoScreen} />
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
