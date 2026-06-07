import * as MediaLibrary from "expo-media-library";

const MEDIA_PERMISSION_TYPES = ["photo", "video"];

const hasReadableMediaPermission = (result) =>
  Boolean(
    result?.granted ||
      result?.status === "granted" ||
      result?.accessPrivileges === "all" ||
      result?.accessPrivileges === "limited"
  );

const getPermissionPayload = (result, extra = {}) => ({
  granted: hasReadableMediaPermission(result),
  source: "media-library",
  status: result?.status,
  accessPrivileges: result?.accessPrivileges,
  canAskAgain: result?.canAskAgain !== false,
  ...extra,
});

/**
 * Request media library permissions with proper error handling
 */
export const requestMediaLibraryPermissions = async () => {
  try {
    if (!MediaLibrary?.requestPermissionsAsync) {
      return { 
        granted: false, 
        source: "unknown",
        message: "expo-media-library not available"
      };
    }

    const result = await MediaLibrary.requestPermissionsAsync(false, MEDIA_PERMISSION_TYPES);
    
    if (hasReadableMediaPermission(result)) {
      return getPermissionPayload(result);
    }
    
    if (result?.canAskAgain === false) {
      return { 
        granted: false, 
        source: "media-library",
        permanent: true,
        message: "Permission permanently denied. Enable in Settings > Apps > Family Media Hub > Permissions > Photos and Videos"
      };
    }

    return { 
      granted: false, 
      source: "media-library",
      permanent: false,
      message: "Media library permission denied"
    };
  } catch (error) {
    return { 
      granted: false, 
      source: "error",
      error: error?.message,
      message: `Permission error: ${error?.message}`
    };
  }
};

/**
 * Check if we have media library permissions
 */
export const checkMediaLibraryPermissions = async () => {
  try {
    if (MediaLibrary?.getPermissionsAsync) {
      const result = await MediaLibrary.getPermissionsAsync(false, MEDIA_PERMISSION_TYPES);
      return getPermissionPayload(result);
    }

    return { 
      granted: false, 
      source: "unknown",
      canAskAgain: true
    };
  } catch (error) {
    return { 
      granted: false, 
      source: "error",
      error: error?.message,
      canAskAgain: true
    };
  }
};

/**
 * Ensure media library permissions are granted, request if needed
 */
export const ensureMediaLibraryPermissions = async () => {
  const check = await checkMediaLibraryPermissions();
  
  if (check.granted) {
    return { ...check, granted: true, alreadyGranted: true };
  }

  if (!check.canAskAgain) {
    return { 
      granted: false, 
      permanent: true,
      message: "Permission permanently denied. Please enable in device settings."
    };
  }

  return await requestMediaLibraryPermissions();
}; 