import { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";

const VIDEO_CACHE_DIR = `${FileSystem.cacheDirectory || ""}family-video-cache/`;
const pendingDownloads = new Map();
const memoryCache = new Map();
const stats = {
  hits: 0,
  misses: 0,
};

const isRemoteUri = (uri) => /^https?:\/\//i.test(String(uri || ""));

const now = () => Date.now();

const hashString = (value) => {
  const input = String(value || "");
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
};

const getExtension = (uri) => {
  const match = String(uri || "")
    .split("?")[0]
    .split("#")[0]
    .match(/\.([a-z0-9]{2,5})$/i);

  return match?.[1]?.toLowerCase() || "mp4";
};

const getCachedVideoUri = (uri) =>
  uri ? `${VIDEO_CACHE_DIR}${hashString(uri)}.${getExtension(uri)}` : null;

const getMetadataUri = (uri) =>
  uri ? `${VIDEO_CACHE_DIR}${hashString(uri)}.json` : null;

const ensureCacheDir = async () => {
  if (!FileSystem.cacheDirectory) {
    return false;
  }

  const info = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_CACHE_DIR, { intermediates: true });
  }

  return true;
};

const getValidCachedFileInfo = async (uri) => {
  const fileUri = getCachedVideoUri(uri);

  if (!fileUri) {
    return null;
  }

  const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });

  if (!fileInfo.exists || Number(fileInfo.size || 0) <= 0) {
    return null;
  }

  return { fileUri, fileInfo };
};

const writeMetadata = async (sourceUri, fileInfo) => {
  const metadataUri = getMetadataUri(sourceUri);

  if (!metadataUri) {
    return;
  }

  await FileSystem.writeAsStringAsync(
    metadataUri,
    JSON.stringify({
      sourceUri,
      cachedUri: getCachedVideoUri(sourceUri),
      size: fileInfo?.size || 0,
      cachedAt: new Date().toISOString(),
    })
  );
};

const emitMetric = (metric, onMetric) => {
  const nextStats = {
    ...metric,
    cacheHitRate:
      stats.hits + stats.misses > 0
        ? stats.hits / (stats.hits + stats.misses)
        : 0,
  };

  console.log("[VideoCache] Metric emitted:", nextStats);
  onMetric?.(nextStats);
  return nextStats;
};

export const prepareCachedVideoUri = async (sourceUri, { onMetric } = {}) => {
  if (!sourceUri) {
    return emitMetric(
      {
        sourceUri,
        uri: null,
        cacheHit: false,
        validationMs: 0,
        downloadMs: 0,
      },
      onMetric
    );
  }

  if (!isRemoteUri(sourceUri)) {
    return emitMetric(
      {
        sourceUri,
        uri: sourceUri,
        cacheHit: true,
        validationMs: 0,
        downloadMs: 0,
        localSource: true,
      },
      onMetric
    );
  }

  if (memoryCache.has(sourceUri)) {
    stats.hits += 1;
    return emitMetric(
      {
        sourceUri,
        uri: memoryCache.get(sourceUri),
        cacheHit: true,
        validationMs: 0,
        downloadMs: 0,
        memoryHit: true,
      },
      onMetric
    );
  }

  if (pendingDownloads.has(sourceUri)) {
    return pendingDownloads.get(sourceUri);
  }

  const downloadPromise = (async () => {
    const canCache = await ensureCacheDir();

    if (!canCache) {
      return emitMetric(
        {
          sourceUri,
          uri: sourceUri,
          cacheHit: false,
          validationMs: 0,
          downloadMs: 0,
          cacheUnavailable: true,
        },
        onMetric
      );
    }

    const validationStartedAt = now();
    const cached = await getValidCachedFileInfo(sourceUri);
    const validationMs = now() - validationStartedAt;

    if (cached) {
      stats.hits += 1;
      memoryCache.set(sourceUri, cached.fileUri);
      await writeMetadata(sourceUri, cached.fileInfo).catch(() => {});
      return emitMetric(
        {
          sourceUri,
          uri: cached.fileUri,
          cacheHit: true,
          validationMs,
          downloadMs: 0,
          fileSize: cached.fileInfo?.size || 0,
        },
        onMetric
      );
    }

    stats.misses += 1;

    const fileUri = getCachedVideoUri(sourceUri);
    const downloadStartedAt = now();

    try {
      const result = await FileSystem.downloadAsync(sourceUri, fileUri);
      const downloadMs = now() - downloadStartedAt;
      const downloadedInfo = await FileSystem.getInfoAsync(result?.uri || fileUri, { size: true });

      if (!downloadedInfo.exists || Number(downloadedInfo.size || 0) <= 0) {
        throw new Error("Downloaded video cache file is empty.");
      }

      memoryCache.set(sourceUri, result?.uri || fileUri);
      await writeMetadata(sourceUri, downloadedInfo).catch(() => {});

      return emitMetric(
        {
          sourceUri,
          uri: result?.uri || fileUri,
          cacheHit: false,
          validationMs,
          downloadMs,
          fileSize: downloadedInfo.size || 0,
        },
        onMetric
      );
    } catch (error) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
      throw error;
    }
  })()
    .catch((error) =>
      emitMetric(
        {
          sourceUri,
          uri: sourceUri,
          cacheHit: false,
          validationMs: 0,
          downloadMs: 0,
          error: error?.message || String(error),
        },
        onMetric
      )
    )
    .finally(() => {
      pendingDownloads.delete(sourceUri);
    });

  pendingDownloads.set(sourceUri, downloadPromise);
  return downloadPromise;
};

export const getVideoCacheStats = () => ({
  ...stats,
  cacheHitRate:
    stats.hits + stats.misses > 0 ? stats.hits / (stats.hits + stats.misses) : 0,
});

export default function useCachedVideoUri(sourceUri, options) {
  const [state, setState] = useState({
    uri: sourceUri || null,
    loading: false,
    metric: null,
  });

  useEffect(() => {
    let active = true;

    console.log("========== DIAGNOSTIC: useCachedVideoUri Hook ==========");
    console.log("INPUT sourceUri:", sourceUri);

    if (!sourceUri) {
      console.log("sourceUri is null/empty - setting state to null");
      setState({ uri: null, loading: false, metric: null });
      console.log("======================================================");
      return () => {
        active = false;
      };
    }

    console.log("Starting cache preparation for sourceUri");
    setState((previous) => ({
      uri: sourceUri,
      loading: isRemoteUri(sourceUri),
      metric: null,
    }));

    prepareCachedVideoUri(sourceUri, options).then((metric) => {
      console.log("Cache preparation completed:");
      console.log("  uri:", metric.uri);
      console.log("  cacheHit:", metric.cacheHit);
      console.log("  downloadMs:", metric.downloadMs);
      console.log("  error:", metric.error);
      if (active) {
        setState({
          uri: metric.uri || sourceUri,
          loading: false,
          metric,
        });
      }
      console.log("======================================================");
    }).catch((error) => {
      console.log("Cache preparation failed:", error?.message || error);
      console.log("======================================================");
    });

    return () => {
      active = false;
    };
  }, [sourceUri]);

  return state;
}
