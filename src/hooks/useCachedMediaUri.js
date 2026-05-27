import { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = `${FileSystem.cacheDirectory || ""}family-media-cache/`;
const memoryCache = new Map();
const pendingDownloads = new Map();

const isRemoteUri = (uri) =>
  typeof uri === "string" && (uri.startsWith("http://") || uri.startsWith("https://"));

const hashString = (value) => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
};

const getExtension = (uri) => {
  const cleanUri = String(uri || "").split("?")[0].split("#")[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? `.${match[1].toLowerCase()}` : "";
};

const getCachedFileUri = (uri) => `${CACHE_DIR}${hashString(uri)}${getExtension(uri)}`;

const ensureCacheDir = async () => {
  if (!FileSystem.cacheDirectory) {
    return false;
  }

  const info = await FileSystem.getInfoAsync(CACHE_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }

  return true;
};

export const getCachedMediaUri = async (uri) => {
  if (!isRemoteUri(uri)) {
    return uri || null;
  }

  if (memoryCache.has(uri)) {
    return memoryCache.get(uri);
  }

  if (pendingDownloads.has(uri)) {
    return pendingDownloads.get(uri);
  }

  const downloadPromise = (async () => {
    const canUseCache = await ensureCacheDir();

    if (!canUseCache) {
      return uri;
    }

    const fileUri = getCachedFileUri(uri);
    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (fileInfo.exists) {
      memoryCache.set(uri, fileUri);
      return fileUri;
    }

    await FileSystem.downloadAsync(uri, fileUri);
    memoryCache.set(uri, fileUri);
    return fileUri;
  })()
    .catch(() => uri)
    .finally(() => {
      pendingDownloads.delete(uri);
    });

  pendingDownloads.set(uri, downloadPromise);
  return downloadPromise;
};

export default function useCachedMediaUri(uri) {
  const [cachedUri, setCachedUri] = useState(uri || null);

  useEffect(() => {
    let active = true;

    setCachedUri(uri || null);

    getCachedMediaUri(uri).then((nextUri) => {
      if (active) {
        setCachedUri(nextUri);
      }
    });

    return () => {
      active = false;
    };
  }, [uri]);

  return cachedUri;
}
