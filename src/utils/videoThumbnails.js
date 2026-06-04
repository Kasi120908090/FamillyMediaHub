import * as VideoThumbnails from "expo-video-thumbnails";
import * as FileSystem from "expo-file-system/legacy";
import { getMediaUri, getVideoThumbnailUri } from "./media";
import { prepareCachedVideoUri } from "./videoCache";

const THUMBNAIL_DIR = `${FileSystem.cacheDirectory}video-thumbnails/`;
const pendingThumbnails = new Map();

const hashString = (value) => {
  const input = String(value || "");
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
};

const getCachedThumbnailUri = (videoUri) =>
  videoUri ? `${THUMBNAIL_DIR}${hashString(videoUri)}.jpg` : null;

const isRemoteUri = (uri) => /^https?:\/\//i.test(String(uri || ""));

const ensureDirectory = async (directoryUri) => {
  const info = await FileSystem.getInfoAsync(directoryUri);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }
};

const getLocalVideoUriForThumbnail = async (videoUri) => {
  if (!isRemoteUri(videoUri)) {
    return videoUri;
  }

  const cacheMetric = await prepareCachedVideoUri(videoUri);
  return cacheMetric?.uri || videoUri;
};

const createCachedVideoThumbnailUri = async (videoUri) => {
  const cacheUri = getCachedThumbnailUri(videoUri);

  if (!videoUri || !cacheUri) {
    return null;
  }

  const cachedInfo = await FileSystem.getInfoAsync(cacheUri);

  if (cachedInfo.exists) {
    return cacheUri;
  }

  await ensureDirectory(THUMBNAIL_DIR);

  const localVideoUri = await getLocalVideoUriForThumbnail(videoUri);
  const thumbnail = await VideoThumbnails.getThumbnailAsync(localVideoUri, {
    time: 1000,
    quality: 0.75,
  });

  if (!thumbnail?.uri) {
    return null;
  }

  await FileSystem.copyAsync({
    from: thumbnail.uri,
    to: cacheUri,
  });

  return cacheUri;
};

export const getOrCreateVideoThumbnailUri = async (item, explicitVideoUri) => {
  const remoteThumbnailUri = getVideoThumbnailUri(item);

  if (remoteThumbnailUri) {
    return remoteThumbnailUri;
  }

  const videoUri = explicitVideoUri || getMediaUri(item);

  if (!videoUri) {
    return null;
  }

  if (!pendingThumbnails.has(videoUri)) {
    pendingThumbnails.set(
      videoUri,
      createCachedVideoThumbnailUri(videoUri)
        .catch((error) => {
          console.log("Video thumbnail generation failed", {
            uri: videoUri,
            error: error?.message || error,
          });
          return null;
        })
        .finally(() => {
          pendingThumbnails.delete(videoUri);
        })
    );
  }

  return pendingThumbnails.get(videoUri);
};
