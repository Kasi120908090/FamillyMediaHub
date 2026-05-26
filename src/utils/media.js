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

  if (cleanUri.endsWith(".m3u8")) {
    return "hls";
  }

  if (cleanUri.endsWith(".mpd")) {
    return "dash";
  }

  return "progressive";
};

export const getVideoSource = (source) => {
  const uri = typeof source === "string" ? source : source?.uri;

  if (!uri) {
    return null;
  }

  return {
    ...(typeof source === "object" && source ? source : {}),
    uri,
    contentType: source?.contentType || getContentType(uri),
  };
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
