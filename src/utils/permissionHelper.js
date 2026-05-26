import * as MediaLibrary from "expo-media-library";

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

    const result = await MediaLibrary.requestPermissionsAsync();
    
    if (result?.granted) {
      return { granted: true, source: "media-library" };
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
      const result = await MediaLibrary.getPermissionsAsync();
      return {
        granted: Boolean(result?.granted),
        source: "media-library",
        canAskAgain: result?.canAskAgain !== false
      };
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
    return { granted: true, alreadyGranted: true };
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
