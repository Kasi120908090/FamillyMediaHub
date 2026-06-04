import { resolveMediaUri } from "../services/api";

const firstValue = (...values) => values.find((value) => Boolean(value));

export const getMediaUri = (item) =>
  resolveMediaUri(
    item?.local_uri ||
    item?.previewUri ||
    item?.uri ||
    item?.localUri ||
    item?.file_path
  );

const getContentType = (uri) => {
  if (!uri) {
    return "auto";
  }

  const cleanUri = uri.split("?")[0].toLowerCase();
  console.log("[getContentType] Detecting from URI:", { uri, cleanUri });

  if (cleanUri.endsWith(".m3u8")) {
    console.log("[getContentType] Detected as HLS");
    return "hls";
  }

  if (cleanUri.endsWith(".mpd")) {
    console.log("[getContentType] Detected as DASH");
    return "dash";
  }

  console.log("[getContentType] Detected as progressive");
  return "progressive";
};

export const getVideoSource = (source) => {
  const uri = typeof source === "string" ? source : source?.uri;
  const contentType = source?.contentType || (uri ? getContentType(uri) : null);

  console.log("[getVideoSource] Processing source:", {
    inputType: typeof source,
    uri,
    contentType,
    source,
  });

  if (!uri) {
    console.log("[getVideoSource] No URI found, returning null");
    return null;
  }

  const result = {
    ...(typeof source === "object" && source ? source : {}),
    uri,
    contentType,
  };
  
  console.log("[getVideoSource] Final result:", result);
  return result;
};

export const getVideoThumbnailUri = (item) => {
  const thumbnailPath = firstValue(
    item?.thumbnailUri,
    item?.thumbnail_url,
    item?.thumbnail_path,
    item?.thumbnail,
    item?.posterUri,
    item?.poster_url,
    item?.poster_path,
    item?.previewImageUri,
    item?.preview_image_url,
    item?.preview_image_path,
    item?.preview_image,
    item?.cover_url,
    item?.cover_path,
    item?.file_metadata?.thumbnail_url,
    item?.file_metadata?.thumbnail_path,
    item?.file_metadata?.video?.thumbnail_url,
    item?.file_metadata?.video?.thumbnail_path,
    item?.metadata?.thumbnail_url,
    item?.metadata?.thumbnail_path,
    item?.metadata?.video?.thumbnail_url,
    item?.metadata?.video?.thumbnail_path
  );

  return thumbnailPath ? resolveMediaUri(thumbnailPath) : null;
};
