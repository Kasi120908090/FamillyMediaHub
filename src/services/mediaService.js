import * as FileSystem from "expo-file-system/legacy";
import { ENDPOINTS } from "../config/endpoints";
import { apiRequest } from "./api";
import { getCurrentBackendBaseUrl } from "./backendDiscoveryService";
import { Sha256, base64ToBytes, sha256Bytes } from "../utils/sha256";

const LARGE_VIDEO_LIMIT = 200 * 1024 * 1024;
const VIDEO_CHUNK_SIZE = 16 * 1024 * 1024;
const MEDIA_LIST_CACHE_TTL = 60 * 1000;
const mediaListCache = new Map();
const pendingMediaLists = new Map();

const hashString = (value) => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
};

const getMediaListCacheKey = (token, scope, params) =>
  `${getCurrentBackendBaseUrl() || "no-backend"}:${hashString(token || "guest")}:${scope}:${JSON.stringify(
    params || {}
  )}`;

const requestCachedMediaList = (cacheKey, endpoint, options) => {
  const cached = mediaListCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < MEDIA_LIST_CACHE_TTL) {
    return Promise.resolve(cached.value);
  }

  if (pendingMediaLists.has(cacheKey)) {
    return pendingMediaLists.get(cacheKey);
  }

  const requestPromise = apiRequest(endpoint, options)
    .then((value) => {
      mediaListCache.set(cacheKey, {
        createdAt: Date.now(),
        value,
      });
      return value;
    })
    .finally(() => {
      pendingMediaLists.delete(cacheKey);
    });

  pendingMediaLists.set(cacheKey, requestPromise);
  return requestPromise;
};

const clearMediaListCache = () => {
  mediaListCache.clear();
  pendingMediaLists.clear();
};

const isLargeVideoUpload = (payload) =>
  payload?.category === "video" &&
  String(payload?.file?.type || "").startsWith("video/") &&
  Number(payload?.file?.size || 0) > LARGE_VIDEO_LIMIT;

const getUploadId = (response) =>
  response?.upload_id || response?.uploadId || response?.id || null;

const getCompletedMedia = (response) =>
  response?.media || response?.item || response?.data || response;

const createChunkFileUri = (uploadId, chunkIndex) =>
  `${FileSystem.cacheDirectory || ""}${FileSystem.cacheDirectory?.endsWith("/") ? "" : "/"}family-hub-${uploadId}-${chunkIndex}.part`;

const appendOptionalUploadFields = (target, payload) => {
  if (payload.child_id !== undefined && payload.child_id !== null) {
    target.child_id = payload.child_id;
  }

  if (payload.device_id !== undefined && payload.device_id !== null) {
    target.device_id = payload.device_id;
  }

  if (payload.subfolder) {
    target.subfolder = payload.subfolder;
  }

  if (payload.category) {
    target.category = payload.category;
  }

  if (payload.file?.duration) {
    target.duration = payload.file.duration;
  }
};

const uploadChunkedVideo = async (payload, token, options = {}) => {
  const fileSize = Number(payload.file.size || 0);
  console.log("[UploadService] Starting chunked upload:", {
    file: payload.file.name,
    uri: payload.file.uri,
    size: fileSize,
  });

  if (!fileSize) {
    throw new Error("Unable to read video size. Choose the video again and retry.");
  }

  const chunkSize = options.chunkSize || VIDEO_CHUNK_SIZE;
  const totalChunks = Math.ceil(fileSize / chunkSize);
  const initBody = {
    filename: payload.file.name,
    file_size: fileSize,
    total_chunks: totalChunks,
    chunk_size: chunkSize,
    content_type: payload.file.type || "video/mp4",
  };

  appendOptionalUploadFields(initBody, payload);

  const initResponse = await apiRequest(ENDPOINTS.media.initUpload, {
    method: "POST",
    token,
    body: initBody,
    signal: options.signal,
  }).then(res => {
    console.log("[UploadService] Init response status:", res ? 'ok' : 'failed');
    return res;
  });
  const uploadId = getUploadId(initResponse);

  if (!uploadId) {
    throw new Error("The server did not return an upload id for this video.");
  }

  options.onUploadStart?.({ uploadId, mode: "chunked", totalChunks });

  const fullHash = new Sha256();

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    if (options.signal?.aborted) {
      const abortError = new Error("Upload cancelled");
      abortError.name = "AbortError";
      throw abortError;
    }

    const position = chunkIndex * chunkSize;
    const length = Math.min(chunkSize, fileSize - position);
    const chunkBase64 = await FileSystem.readAsStringAsync(payload.file.uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });
    const chunkBytes = base64ToBytes(chunkBase64);
    const checksum = sha256Bytes(chunkBytes);
    fullHash.update(chunkBytes);

    const chunkFileUri = createChunkFileUri(uploadId, chunkIndex);
    const formData = new FormData();

    await FileSystem.writeAsStringAsync(chunkFileUri, chunkBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    formData.append("chunk_index", String(chunkIndex));
    formData.append("checksum", checksum);
    formData.append("file", {
      uri: chunkFileUri,
      name: `${payload.file.name}.part${chunkIndex}`,
      type: "application/octet-stream",
    });

    try {
      await apiRequest(ENDPOINTS.media.uploadChunk(uploadId), {
        method: "PUT",
        token,
        body: formData,
        signal: options.signal,
      });
    } finally {
      FileSystem.deleteAsync(chunkFileUri, { idempotent: true }).catch(() => {});
    }

    options.onProgress?.({
      mode: "chunked",
      uploadId,
      progress: (chunkIndex + 1) / totalChunks,
      uploadedChunks: chunkIndex + 1,
      totalChunks,
      uploadedBytes: Math.min(fileSize, position + length),
      totalBytes: fileSize,
    });
  }

  const completed = await apiRequest(ENDPOINTS.media.completeUpload(uploadId), {
    method: "POST",
    token,
    body: {
      final_checksum: fullHash.digest(),
    },
    signal: options.signal,
  }).then(res => {
    console.log("[UploadService] Completion response:", res);
    return res;
  });

  clearMediaListCache();

  options.onProgress?.({
    mode: "chunked",
    uploadId,
    progress: 1,
    uploadedChunks: totalChunks,
    totalChunks,
    uploadedBytes: fileSize,
    totalBytes: fileSize,
  });

  return getCompletedMedia(completed);
};

export const mediaService = {
  listMediaForParent: (token, category) =>
    requestCachedMediaList(
      getMediaListCacheKey(token, "parent", { category }),
      ENDPOINTS.media.listForParent(category),
      {
        token,
      }
    ),

  listMediaForChild: (childId, token, category) =>
    requestCachedMediaList(
      getMediaListCacheKey(token, "child", { childId, category }),
      ENDPOINTS.media.listForChild(childId, category),
      {
        token,
      }
    ),

  listMediaForDevice: (deviceId, token, filters) =>
    requestCachedMediaList(
      getMediaListCacheKey(token, "device", { deviceId, filters }),
      ENDPOINTS.media.listForDevice(deviceId, filters),
      {
        token,
      }
    ),

  uploadMedia: (payload, token, options = {}) => {
    if (isLargeVideoUpload(payload)) {
      return uploadChunkedVideo(payload, token, options);
    }

    console.log("[UploadService] Standard upload request:", {
      name: payload.file.name,
      uri: payload.file.uri,
      size: payload.file.size,
    });

    const formData = new FormData();

    if (payload.upload_id) {
      formData.append("upload_id", String(payload.upload_id));
    }

    if (payload.child_id !== undefined && payload.child_id !== null) {
      formData.append("child_id", String(payload.child_id));
    }

    if (payload.device_id !== undefined && payload.device_id !== null) {
      formData.append("device_id", String(payload.device_id));
    }

    formData.append("category", payload.category);

    if (payload.subfolder) {
      formData.append("subfolder", payload.subfolder);
    }

    if (typeof payload.latitude === "number") {
      formData.append("latitude", String(payload.latitude));
    }

    if (typeof payload.longitude === "number") {
      formData.append("longitude", String(payload.longitude));
    }

    if (typeof payload.location_accuracy === "number") {
      formData.append("location_accuracy", String(payload.location_accuracy));
    }

    if (payload.location_source) {
      formData.append("location_source", payload.location_source);
    }

    formData.append("file", {
      uri: payload.file.uri,
      name: payload.file.name,
      type: payload.file.type,
    });

    if (payload.file.duration) {
      formData.append("duration", String(payload.file.duration));
    }

    if (formData._parts) {
      console.log("[UploadService] FormData contents:", formData._parts);
    }

    return apiRequest(ENDPOINTS.media.upload, {
      method: "POST",
      token,
      body: formData,
      signal: options.signal,
    }).then((response) => {
      console.log("[UploadService] Standard upload response:", response);
      clearMediaListCache();
      options.onProgress?.({
        mode: "standard",
        progress: 1,
        uploadedBytes: payload.file.size || 0,
        totalBytes: payload.file.size || 0,
      });
      return response;
    });
  },

  cancelUpload: (uploadId, token, options = {}) =>
    apiRequest(
      options.chunked
        ? ENDPOINTS.media.cancelChunkedUpload(uploadId)
        : ENDPOINTS.media.cancelUpload(uploadId),
      {
        method: options.chunked ? "DELETE" : "POST",
        token,
      }
    ),

  getUploadStatus: (uploadId, token) =>
    apiRequest(ENDPOINTS.media.uploadStatus(uploadId), {
      token,
    }),

  shouldUseChunkedUpload: isLargeVideoUpload,
  LARGE_VIDEO_LIMIT,
  VIDEO_CHUNK_SIZE,
};
