import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APP_AVATAR_FALLBACK } from "../config/env";
import { authService } from "../services/authService";
import { mediaService } from "../services/mediaService";
import { userService } from "../services/userService";
import {
  getDefaultAuthenticatedRoute,
  isChildAccount,
  isParentAdmin,
  isParentAdminReady,
  requiresFirstLoginSetup,
} from "../utils/auth";

const STORAGE_KEYS = {
  token: "@family-media-hub/token",
  user: "@family-media-hub/user",
};

const defaultProfile = {
  id: null,
  name: "Family Hub",
  username: "",
  email: "",
  phone: "",
  role: "Guest",
  image: APP_AVATAR_FALLBACK,
  accountType: "",
};

const getAvatarUrl = (entity) =>
  entity?.avatar_url ||
  entity?.avatarUrl ||
  entity?.profile_image ||
  entity?.profileImage ||
  entity?.image ||
  entity?.photo_url ||
  entity?.photoUrl ||
  "";

const getDisplayName = (entity, fallback = "Family Hub") =>
  entity?.full_name ||
  entity?.fullName ||
  entity?.name ||
  entity?.username ||
  fallback;

const getLoggedInChildId = (user) => {
  if (!isChildAccount(user)) {
    return null;
  }

  return (
    user?.child_id ||
    user?.childId ||
    user?.child_profile_id ||
    user?.childProfileId ||
    user?.child?.id ||
    user?.child_profile?.id ||
    user?.childProfile?.id ||
    user?.profile?.id ||
    user?.id ||
    null
  );
};

const ProfileContext = createContext({
  profile: defaultProfile,
  viewerProfile: defaultProfile,
  authToken: "",
  currentUser: null,
  selectedChild: null,
  selectedParentView: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isSubmitting: false,
  children: [],
  parentDevices: [],
  deviceChildrenByDevice: {},
  selectedChildId: null,
  canManageMedia: true,
  mediaItems: [],
  recycleBinItems: [],
  postLoginRoute: "Welcome",
  isParentAdmin: false,
  isParentAdminReady: false,
  isChildAccount: false,
  requiresFirstLoginSetup: false,
  updateProfile: () => {},
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  completeFirstLogin: async () => {},
  createChild: async () => {},
  updateOwnChildProfile: async () => {},
  refreshChildren: async () => {},
  refreshDevices: async () => {},
  loadDeviceChildren: async () => {},
  loadChildMedia: async () => {},
  uploadMedia: async () => {},
  cancelMediaUpload: async () => {},
  moveMediaToRecycleBin: () => {},
  restoreMediaFromRecycleBin: () => {},
  selectChild: async () => {},
  selectParentAccount: () => {},
});

const toChildProfile = (child) => ({
  id: child?.id ?? null,
  name: getDisplayName(child, "Child"),
  username: child?.username || "",
  email: child?.email || "",
  phone: child?.phone_number || "",
  role: child?.relationship || "Child",
  image:
    getAvatarUrl(child) ||
    `https://ui-avatars.com/api/?background=3B82F6&color=fff&name=${encodeURIComponent(
      getDisplayName(child, "Child")
    )}`,
  accountType: "child",
});

const toProfile = (user) => ({
  id: user?.id ?? null,
  name: getDisplayName(user),
  username: user?.username || "",
  email: user?.email || "",
  phone: user?.phone_number || "",
  role: isParentAdmin(user)
    ? "Parent Admin"
    : isChildAccount(user)
    ? "Child"
    : user?.role || "Member",
  image:
    getAvatarUrl(user) ||
    `https://ui-avatars.com/api/?background=2563EB&color=fff&name=${encodeURIComponent(
      getDisplayName(user)
    )}`,
  accountType: user?.account_type || "",
});

const getFamilyParentId = (user) => {
  if (!user) {
    return null;
  }

  if (isParentAdmin(user)) {
    return user.id;
  }

  return (
    user.parent_id ||
    user.parentId ||
    user.parent_user_id ||
    user.parent?.id ||
    null
  );
};

const getParentProfile = (user) =>
  user?.parent ||
  user?.parent_profile ||
  user?.parentProfile ||
  user?.parent_user ||
  user?.parentUser ||
  null;

const getCurrentChildProfile = (user) =>
  user?.child ||
  user?.child_profile ||
  user?.childProfile ||
  user?.profile ||
  user;

const normalizeChildrenResponse = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.children)) {
    return response.children;
  }

  if (Array.isArray(response?.family_children)) {
    return response.family_children;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.children)) {
    return response.data.children;
  }

  if (Array.isArray(response?.data?.family_children)) {
    return response.data.family_children;
  }

  if (Array.isArray(response?.data?.users)) {
    return response.data.users;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  if (Array.isArray(response?.users)) {
    return response.users;
  }

  if (Array.isArray(response?.children)) {
    return response.children;
  }

  if (Array.isArray(response?.family_children)) {
    return response.family_children;
  }

  if (Array.isArray(response?.user?.children)) {
    return response.user.children;
  }

  if (Array.isArray(response?.user?.family_children)) {
    return response.user.family_children;
  }

  if (Array.isArray(response?.parent?.children)) {
    return response.parent.children;
  }

  if (Array.isArray(response?.parent_profile?.children)) {
    return response.parent_profile.children;
  }

  if (Array.isArray(response?.parent_profile?.family_children)) {
    return response.parent_profile.family_children;
  }

  return [];
};

const mergeChildren = (groups) => {
  const childrenByKey = new Map();

  groups.flat().forEach((child, index) => {
    if (!child) {
      return;
    }

    const key =
      child.id ??
      child._id ??
      child.username ??
      child.email ??
      `${child.name || child.full_name || "child"}-${index}`;

    childrenByKey.set(String(key), {
      ...childrenByKey.get(String(key)),
      ...child,
      id: child.id ?? child._id ?? childrenByKey.get(String(key))?.id,
    });
  });

  return Array.from(childrenByKey.values());
};

const sortByDateDesc = (items) =>
  [...items].sort(
    (first, second) =>
      new Date(second.created_at || second.createdAt || 0).getTime() -
      new Date(first.created_at || first.createdAt || 0).getTime()
  );

const normalizeMediaResponse = (response) =>
  Array.isArray(response) ? response : response?.items || response?.media || [];

const getMediaRecycleKey = (item) =>
  String(
    item?.id ??
      item?.file_path ??
      item?.previewUri ??
      item?.stored_file_name ??
      item?.original_file_name ??
      ""
  );

const mergeMediaItems = (groups) => {
  const mediaByKey = new Map();

  groups.flat().forEach((item, index) => {
    if (!item) {
      return;
    }

    const key = getMediaRecycleKey(item) || `media-${index}`;

    mediaByKey.set(String(key), {
      ...mediaByKey.get(String(key)),
      ...item,
    });
  });

  return Array.from(mediaByKey.values());
};

const mergeUserPayload = (baseUser, incomingUser) => ({
  ...baseUser,
  ...incomingUser,
  parent_id:
    incomingUser?.parent_id ||
    incomingUser?.parentId ||
    incomingUser?.parent_user_id ||
    incomingUser?.parent?.id ||
    baseUser?.parent_id ||
    baseUser?.parent?.id ||
    null,
  parent:
    incomingUser?.parent ||
    incomingUser?.parent_profile ||
    incomingUser?.parentProfile ||
    incomingUser?.parent_user ||
    incomingUser?.parentUser ||
    baseUser?.parent ||
    null,
});

const markUserForFirstLoginSetup = (user) => ({
  ...user,
  account_type: user?.account_type || "user",
  role: user?.role || "parent_admin",
  is_first_login: true,
});

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(defaultProfile);
  const [authToken, setAuthToken] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [childrenList, setChildrenList] = useState([]);
  const [parentDevices, setParentDevices] = useState([]);
  const [deviceChildrenByDevice, setDeviceChildrenByDevice] = useState({});
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [selectedChildDetails, setSelectedChildDetails] = useState(null);
  const [selectedParentView, setSelectedParentView] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [recycleBinItems, setRecycleBinItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const childrenListRef = useRef([]);

  useEffect(() => {
    childrenListRef.current = childrenList;
  }, [childrenList]);

  const persistSession = useCallback(async (token, user) => {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.token, token],
      [STORAGE_KEYS.user, JSON.stringify(user)],
    ]);
  }, []);

  const clearPersistedSession = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
  }, []);

  const applyCurrentUser = useCallback((user) => {
    setCurrentUser(user);
    setProfile(toProfile(user));
    setSelectedParentView(null);
    setSelectedChildDetails(null);
    setSelectedChildId(getLoggedInChildId(user));
  }, []);

  const markFirstLoginRequired = useCallback(async () => {
    setCurrentUser((current) => {
      if (!current) {
        return current;
      }

      const nextUser = {
        ...current,
        is_first_login: true,
      };

      setProfile(toProfile(nextUser));
      persistSession(authToken, nextUser).catch(() => {});
      return nextUser;
    });
  }, [authToken, persistSession]);

  const handleProtectedError = useCallback(
    async (error) => {
      if (error?.code === "FIRST_LOGIN_INCOMPLETE") {
        await markFirstLoginRequired();
      }

      if (error?.code === "UNAUTHORIZED") {
        await clearPersistedSession();
        setAuthToken("");
        setCurrentUser(null);
        setProfile(defaultProfile);
        setChildrenList([]);
        setParentDevices([]);
        setDeviceChildrenByDevice({});
        setSelectedChildId(null);
        setSelectedChildDetails(null);
        setSelectedParentView(null);
        setMediaItems([]);
        setRecycleBinItems([]);
      }

      throw error;
    },
    [clearPersistedSession, markFirstLoginRequired]
  );

  const selectedChild =
    selectedChildDetails ||
    childrenList.find((child) => String(child.id) === String(selectedChildId)) ||
    null;
  const viewerProfile = selectedParentView
    ? toProfile({ ...selectedParentView, account_type: "user", role: "parent_admin" })
    : selectedChild
    ? toChildProfile(selectedChild)
    : profile;
  const loggedInChildId = getLoggedInChildId(currentUser);
  const parentAdmin = isParentAdmin(currentUser);
  const parentAdminReady = isParentAdminReady(currentUser);
  const childAccount = isChildAccount(currentUser);
  const canManageMedia =
    parentAdminReady ||
    (!selectedParentView &&
      (!selectedChildId ||
        (loggedInChildId && String(selectedChildId) === String(loggedInChildId))));
  const firstLoginRequired = requiresFirstLoginSetup(currentUser);
  const postLoginRoute = getDefaultAuthenticatedRoute(currentUser);

  const updateProfile = useCallback((updates) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      ...updates,
    }));
  }, []);

  const refreshSession = useCallback(async () => {
    if (!authToken) {
      return null;
    }

    try {
      const me = await authService.getMe(authToken);
      const mergedUser = mergeUserPayload(currentUser, me);
      applyCurrentUser(mergedUser);
      await persistSession(authToken, mergedUser);
      return mergedUser;
    } catch (error) {
      return handleProtectedError(error);
    }
  }, [applyCurrentUser, authToken, currentUser, handleProtectedError, persistSession]);

  const refreshDevices = useCallback(async () => {
    if (!authToken || !parentAdminReady) {
      setParentDevices([]);
      setDeviceChildrenByDevice({});
      return [];
    }

    try {
      const response = await userService.getMyDevices(authToken);
      const devices = Array.isArray(response) ? response : response?.devices || [];
      setParentDevices(devices);
      return devices;
    } catch (error) {
      return handleProtectedError(error);
    }
  }, [authToken, handleProtectedError, parentAdminReady]);

  const loadDeviceChildren = useCallback(
    async (deviceId) => {
      if (!deviceId || !authToken || !parentAdminReady) {
        return [];
      }

      try {
        const response = await userService.getDeviceChildren(deviceId, authToken);
        const linkedChildren = Array.isArray(response) ? response : response?.children || [];

        setDeviceChildrenByDevice((currentMap) => ({
          ...currentMap,
          [deviceId]: linkedChildren,
        }));

        return linkedChildren;
      } catch (error) {
        return handleProtectedError(error);
      }
    },
    [authToken, handleProtectedError, parentAdminReady]
  );

  const fetchChildrenForUser = useCallback(
    async (user, token, overrideParentId) => {
      if (!token || !user) {
        return [];
      }

      const parentId = overrideParentId || getFamilyParentId(user);

      if (!parentId) {
        setChildrenList([]);
        return [];
      }

      try {
        const response = await userService.getChildren(parentId, token);
        const nextChildren = mergeChildren([normalizeChildrenResponse(response)]);
        setChildrenList(nextChildren);
        return nextChildren;
      } catch (error) {
        return handleProtectedError(error);
      }
    },
    [handleProtectedError]
  );

  const refreshChildren = useCallback(
    async (overrideParentId) => {
      if (!authToken) {
        return [];
      }

      const nextChildren = await fetchChildrenForUser(
        currentUser,
        authToken,
        overrideParentId
      );

      setSelectedChildDetails((currentDetails) => {
        if (!currentDetails) {
          return currentDetails;
        }

        return (
          nextChildren.find((child) => String(child.id) === String(currentDetails.id)) ||
          currentDetails
        );
      });

      if (childAccount && loggedInChildId) {
        setSelectedChildId(loggedInChildId);
      } else if (!childAccount) {
        // Keep admin on the parent account by default.
        setSelectedChildId(null);
      }

      return nextChildren;
    },
    [authToken, childAccount, currentUser, fetchChildrenForUser, loggedInChildId]
  );

  const login = useCallback(
    async ({ username, password }) => {
      setIsSubmitting(true);

      try {
        const response = await authService.login({ username, password });
        const loginUser = mergeUserPayload(null, response.user);
        let resolvedUser = loginUser;

        try {
          const me = await authService.getMe(response.access_token);
          resolvedUser = mergeUserPayload(loginUser, me);
        } catch (error) {
          if (error?.code === "UNAUTHORIZED") {
            throw error;
          }

          if (error?.code === "FIRST_LOGIN_INCOMPLETE") {
            resolvedUser = markUserForFirstLoginSetup(loginUser);
          }
        }

        setAuthToken(response.access_token);
        applyCurrentUser(resolvedUser);
        const initialChildren = mergeChildren([
          normalizeChildrenResponse(response),
          normalizeChildrenResponse(resolvedUser),
        ]);
        setChildrenList(initialChildren);
        setParentDevices([]);
        setDeviceChildrenByDevice({});
        await persistSession(response.access_token, resolvedUser);

        if (isParentAdminReady(resolvedUser)) {
          await fetchChildrenForUser(resolvedUser, response.access_token);
        }

        return {
          ...response,
          user: resolvedUser,
          route: getDefaultAuthenticatedRoute(resolvedUser),
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [applyCurrentUser, fetchChildrenForUser, persistSession]
  );

  const logout = useCallback(async () => {
    await clearPersistedSession();
    setAuthToken("");
    setCurrentUser(null);
    setProfile(defaultProfile);
    setChildrenList([]);
    setParentDevices([]);
    setDeviceChildrenByDevice({});
    setSelectedChildId(null);
    setSelectedChildDetails(null);
    setSelectedParentView(null);
    setMediaItems([]);
    setRecycleBinItems([]);
  }, [clearPersistedSession]);

  const completeFirstLogin = useCallback(
    async (payload) => {
      if (!authToken) {
        throw new Error("Please sign in first.");
      }

      setIsSubmitting(true);

      try {
        await authService.verifyFirstLoginOtp(payload, authToken);
        const nextUser = {
          ...currentUser,
          email: payload.email,
          is_first_login: false,
          is_email_verified: true,
        };
        applyCurrentUser(nextUser);
        await persistSession(authToken, nextUser);

        if (isParentAdminReady(nextUser)) {
          await fetchChildrenForUser(nextUser, authToken);
        }

        return nextUser;
      } catch (error) {
        return handleProtectedError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      applyCurrentUser,
      authToken,
      currentUser,
      fetchChildrenForUser,
      handleProtectedError,
      persistSession,
    ]
  );

  const createChild = useCallback(
    async (payload) => {
      if (!authToken) {
        throw new Error("Please sign in first.");
      }

      setIsSubmitting(true);

      try {
        const createdChild = await userService.createChild(payload, authToken);
        setChildrenList((currentChildren) => mergeChildren([currentChildren, [createdChild]]));
        return createdChild;
      } catch (error) {
        return handleProtectedError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authToken, handleProtectedError]
  );

  const updateOwnChildProfile = useCallback(
    async (payload) => {
      if (!authToken || !childAccount) {
        throw new Error("Only child accounts can update this profile.");
      }

      setIsSubmitting(true);

      try {
        const updatedChild = await userService.updateOwnChildProfile(payload, authToken);
        const nextUser = mergeUserPayload(currentUser, updatedChild);
        applyCurrentUser(nextUser);
        setChildrenList((currentChildren) =>
          currentChildren.map((child) =>
            String(child.id) === String(nextUser.id)
              ? {
                  ...child,
                  ...updatedChild,
                }
              : child
          )
        );
        await persistSession(authToken, nextUser);
        return nextUser;
      } catch (error) {
        return handleProtectedError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      applyCurrentUser,
      authToken,
      childAccount,
      currentUser,
      handleProtectedError,
      persistSession,
    ]
  );

  const uploadMedia = useCallback(
    async (payload, options = {}) => {
      if (!authToken) {
        throw new Error("Please sign in first.");
      }

      const ownerChildId = getLoggedInChildId(currentUser);
      const safePayload = ownerChildId
        ? {
            ...payload,
            child_id: ownerChildId,
            device_id: undefined,
          }
        : payload;

      setIsSubmitting(true);

      try {
        const uploadedItem = await mediaService.uploadMedia(safePayload, authToken, options);
        const itemWithPreview = {
          ...uploadedItem,
          child_id: uploadedItem?.child_id ?? safePayload.child_id,
          previewUri: safePayload.file.uri,
        };

        setMediaItems((currentItems) => sortByDateDesc([itemWithPreview, ...currentItems]));
        return itemWithPreview;
      } catch (error) {
        return handleProtectedError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authToken, currentUser, handleProtectedError]
  );

  const cancelMediaUpload = useCallback(
    async (uploadId) => {
      if (!authToken) {
        throw new Error("Please sign in first.");
      }

      if (!uploadId) {
        throw new Error("Upload id is required to cancel this upload.");
      }

      try {
        return await mediaService.cancelUpload(uploadId, authToken);
      } catch (error) {
        return handleProtectedError(error);
      }
    },
    [authToken, handleProtectedError]
  );

  const moveMediaToRecycleBin = useCallback((item) => {
    const recycleKey = getMediaRecycleKey(item);

    if (!recycleKey) {
      return;
    }

    const recycledItem = {
      ...item,
      deleted_at: new Date().toISOString(),
    };

    setMediaItems((currentItems) =>
      currentItems.filter((currentItem) => getMediaRecycleKey(currentItem) !== recycleKey)
    );
    setRecycleBinItems((currentItems) => [
      recycledItem,
      ...currentItems.filter((currentItem) => getMediaRecycleKey(currentItem) !== recycleKey),
    ]);
  }, []);

  const restoreMediaFromRecycleBin = useCallback((item) => {
    const recycleKey = getMediaRecycleKey(item);

    if (!recycleKey) {
      return;
    }

    const { deleted_at, ...restoredItem } = item;

    setRecycleBinItems((currentItems) =>
      currentItems.filter((currentItem) => getMediaRecycleKey(currentItem) !== recycleKey)
    );
    setMediaItems((currentItems) =>
      sortByDateDesc([
        restoredItem,
        ...currentItems.filter((currentItem) => getMediaRecycleKey(currentItem) !== recycleKey),
      ])
    );
  }, []);

  const loadChildMedia = useCallback(
    async (childId) => {
      if (!authToken) {
        setMediaItems([]);
        return [];
      }

      try {
        if (!childId && parentAdminReady) {
          const parentMedia = normalizeMediaResponse(
            await mediaService.listMediaForParent(authToken)
          );

          let familyChildren = childrenListRef.current;

          if (!familyChildren.length) {
            const parentId = getFamilyParentId(currentUser);

            if (parentId) {
              const childrenResponse = await userService.getChildren(parentId, authToken);
              familyChildren = mergeChildren([normalizeChildrenResponse(childrenResponse)]);
              setChildrenList(familyChildren);
            }
          }

          const childMediaGroups = await Promise.all(
            familyChildren
              .filter((child) => child?.id !== undefined && child?.id !== null)
              .map(async (child) => {
                const childMedia = await mediaService.listMediaForChild(child.id, authToken);
                return normalizeMediaResponse(childMedia).map((item) => ({
                  ...item,
                  child_id: item?.child_id ?? child.id,
                }));
              })
          );

          const normalizedMedia = mergeMediaItems([parentMedia, ...childMediaGroups]);
          setMediaItems(sortByDateDesc(normalizedMedia));
          return normalizedMedia;
        }

        const media = childId
          ? await mediaService.listMediaForChild(childId, authToken)
          : await mediaService.listMediaForParent(authToken);
        const normalizedMedia = normalizeMediaResponse(media);
        setMediaItems(sortByDateDesc(normalizedMedia));
        return normalizedMedia;
      } catch (error) {
        return handleProtectedError(error);
      }
    },
    [authToken, currentUser, handleProtectedError, parentAdminReady]
  );

  const selectChild = useCallback(
    async (childId) => {
      if (childAccount && loggedInChildId && String(childId || loggedInChildId) !== String(loggedInChildId)) {
        childId = loggedInChildId;
      }

      setIsSubmitting(true);

      try {
        if (!childId) {
          setSelectedChildId(null);
          setSelectedChildDetails(null);
          setSelectedParentView(null);
          if (authToken && parentAdminReady) {
            await loadChildMedia(null).catch(() => {});
          } else if (!authToken) {
            setMediaItems([]);
          }
          return null;
        }

        setSelectedChildId(childId);
        setSelectedParentView(null);

        const cachedChild = childrenList.find((child) => String(child.id) === String(childId));
        if (cachedChild) {
          setSelectedChildDetails(cachedChild);
        }

        if (childAccount && loggedInChildId && String(childId) === String(loggedInChildId)) {
          const ownChild = cachedChild || {
            ...getCurrentChildProfile(currentUser),
            id: childId,
          };

          setSelectedChildDetails(ownChild);
          if (authToken) {
            await loadChildMedia(childId);
          }
          return ownChild;
        }

        if (!authToken) {
          return cachedChild || null;
        }

        try {
          const child = await userService.getChild(childId, authToken);
          setSelectedChildDetails(child);
          setChildrenList((currentChildren) =>
            currentChildren.map((currentChild) =>
              String(currentChild.id) === String(child.id)
                ? { ...currentChild, ...child }
                : currentChild
            )
          );
          await loadChildMedia(parentAdminReady ? null : childId);
          return child;
        } catch (error) {
          await handleProtectedError(error);
          return cachedChild || null;
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      authToken,
      childAccount,
      childrenList,
      currentUser,
      handleProtectedError,
      loadChildMedia,
      loggedInChildId,
      parentAdminReady,
    ]
  );

  const selectParentAccount = useCallback(async () => {
    if (!parentAdminReady) {
      return null;
    }

    setIsSubmitting(true);

    try {
      setSelectedChildId(null);
      setSelectedChildDetails(null);
      setSelectedParentView(currentUser);
      if (authToken) {
        await loadChildMedia(null).catch(() => {});
      } else {
        setMediaItems([]);
      }
      return currentUser;
    } finally {
      setIsSubmitting(false);
    }
  }, [authToken, currentUser, loadChildMedia, parentAdminReady]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        const [[, storedToken], [, storedUser]] = await AsyncStorage.multiGet([
          STORAGE_KEYS.token,
          STORAGE_KEYS.user,
        ]);

        if (!storedToken) {
          return;
        }

        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        setAuthToken(storedToken);

        if (parsedUser && isMounted) {
          applyCurrentUser(parsedUser);
        }

        let mergedUser = parsedUser;

        try {
          const me = await authService.getMe(storedToken);
          mergedUser = mergeUserPayload(parsedUser, me);
        } catch (error) {
          if (error?.code !== "FIRST_LOGIN_INCOMPLETE") {
            throw error;
          }

          mergedUser = markUserForFirstLoginSetup(parsedUser);
        }

        if (!isMounted) {
          return;
        }

        applyCurrentUser(mergedUser);
        await persistSession(storedToken, mergedUser);
      } catch (error) {
        if (isMounted) {
          await clearPersistedSession();
          setAuthToken("");
          setCurrentUser(null);
          setProfile(defaultProfile);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, [applyCurrentUser, clearPersistedSession, persistSession]);

  useEffect(() => {
    if (!authToken || !currentUser) {
      return;
    }

    if (childAccount && loggedInChildId) {
      selectChild(loggedInChildId).catch(() => {});
      refreshChildren().catch(() => {});
      return;
    }

    if (parentAdminReady) {
      refreshChildren().catch(() => {});
      refreshDevices().catch(() => {});
      loadChildMedia(null).catch(() => {});
      return;
    }

    setParentDevices([]);
    setDeviceChildrenByDevice({});
  }, [
    authToken,
    childAccount,
    currentUser,
    loadChildMedia,
    loggedInChildId,
    parentAdminReady,
    refreshChildren,
    refreshDevices,
    selectChild,
  ]);

  const value = useMemo(
    () => ({
      profile,
      viewerProfile,
      authToken,
      currentUser,
      selectedChild,
      selectedParentView,
      isAuthenticated: Boolean(authToken && currentUser),
      isBootstrapping,
      isSubmitting,
      children: childrenList,
      parentDevices,
      deviceChildrenByDevice,
      selectedChildId,
      canManageMedia,
      mediaItems,
      recycleBinItems,
      postLoginRoute,
      isParentAdmin: parentAdmin,
      isParentAdminReady: parentAdminReady,
      isChildAccount: childAccount,
      requiresFirstLoginSetup: firstLoginRequired,
      updateProfile,
      login,
      logout,
      refreshSession,
      completeFirstLogin,
      createChild,
      updateOwnChildProfile,
      refreshChildren,
      refreshDevices,
      loadDeviceChildren,
      loadChildMedia,
      uploadMedia,
      cancelMediaUpload,
      moveMediaToRecycleBin,
      restoreMediaFromRecycleBin,
      selectChild,
      selectParentAccount,
    }),
    [
      authToken,
      canManageMedia,
      childAccount,
      childrenList,
      completeFirstLogin,
      createChild,
      currentUser,
      deviceChildrenByDevice,
      firstLoginRequired,
      isBootstrapping,
      isSubmitting,
      loadChildMedia,
      loadDeviceChildren,
      login,
      logout,
      mediaItems,
      moveMediaToRecycleBin,
      parentAdmin,
      parentAdminReady,
      parentDevices,
      postLoginRoute,
      profile,
      recycleBinItems,
      refreshChildren,
      refreshDevices,
      refreshSession,
      restoreMediaFromRecycleBin,
      selectChild,
      selectParentAccount,
      selectedChild,
      selectedChildId,
      selectedParentView,
      updateOwnChildProfile,
      updateProfile,
      uploadMedia,
      viewerProfile,
      cancelMediaUpload,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
