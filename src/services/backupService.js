import * as FileSystem from "expo-file-system/legacy";
import { ENDPOINTS } from "../config/endpoints";
import { apiRequest } from "./api";
import { BACKUP_QUEUE_STATUS, backupQueueMetaStore, backupQueueStore } from "./backupQueueStore";
import { Sha256, base64ToBytes } from "../utils/sha256";

const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
const STOPPED_REASON = "auto sync is disabled";

const getUploadId = (response) =>
  response?.upload_id || response?.uploadId || response?.id || null;

const getBytesReceived = (response) =>
  Number(
    response?.bytes_received ||
      response?.bytesReceived ||
      response?.uploaded_bytes ||
      response?.uploadedBytes ||
      0
  );

const shouldContinueSync = async (options = {}) => {
  if (options.signal?.aborted) {
    return false;
  }

  if (typeof options.shouldContinue === "function") {
    return Boolean(await options.shouldContinue());
  }

  return true;
};

const throwIfStopped = async (options = {}) => {
  if (!(await shouldContinueSync(options))) {
    const error = new Error(STOPPED_REASON);
    error.name = "SyncStoppedError";
    throw error;
  }
};

const normalizeBackupItem = (item = {}) => {
  const id = item.id || item.backup_id || item.upload_id || item.file_id || item.uuid;
  const fileName =
    item.file_name || item.filename || item.name || item.original_file_name || item.original_name || "Backup file";
  const contentType = item.content_type || item.mime_type || item.mimeType || "application/octet-stream";
  const status = item.status || item.state || item.upload_status || "UNKNOWN";
  const isComplete = String(status).toUpperCase() === "COMPLETE";
  const backupFilePath = isComplete && id ? ENDPOINTS.backup.file(id) : null;

  return {
    ...item,
    id,
    file_name: fileName,
    file_size: Number(item.file_size || item.size || item.bytes || item.fileSize || 0),
    duration: Number(item.duration || 0),
    content_type: contentType,
    status,
    completed_at:
      item.completed_at || item.uploaded_at || item.created_at || item.timestamp || item.createdAt || "",
    file_path:
      backupFilePath ||
      item.file_path ||
      item.path ||
      item.uri ||
      item.url ||
      item.download_url ||
      item.fileUri ||
      item.stored_file_name,
    uri:
      backupFilePath ||
      item.uri ||
      item.url ||
      item.local_uri ||
      item.file_path ||
      item.path ||
      item.stored_file_name,
    backup_file_path: backupFilePath,
    requires_auth: Boolean(backupFilePath),
    stored_file_name: item.stored_file_name || item.file_name || item.filename,
    kind:
      contentType?.startsWith("video/") || /\.(mp4|mov|mkv|avi)$/i.test(fileName)
        ? "video"
        : contentType?.startsWith("image/") || /\.(jpg|jpeg|png|heic|webp)$/i.test(fileName)
          ? "photo"
          : "file",
    is_processing: String(status).toUpperCase() !== "COMPLETE" && String(status).toUpperCase() !== "SUCCESS",
  };
};

const getBackupItems = (response) => {
  const items = Array.isArray(response) ? response : response?.items || response?.backups || response?.data || [];
  return Array.isArray(items) ? items.map(normalizeBackupItem) : [];
};

const createBackupInitBody = (item, sha256Hash) => ({
  filename: item.file_name,
  file_size: Number(item.file_size || 0),
  sha256_hash: sha256Hash,
  device_id: Number(item.device_id || 0),
  mime_type: item.content_type || "application/octet-stream",
  duration: item.duration || 0,
  original_path: item.local_uri || item.file_name,
  child_id: item.child_id || undefined,
});

const initBackupUpload = async (item, sha256Hash, token) => {
  const body = createBackupInitBody(item, sha256Hash);

  if (!body.device_id) {
    throw new Error("Backup requires a linked device. Choose a device before starting backup.");
  }

  return apiRequest(ENDPOINTS.backup.init, {
    method: "POST",
    token,
    body,
  });
};

const readBytes = async (uri, position, length) => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });

  return base64ToBytes(base64);
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  throw new Error("Unable to encode backup chunk for upload.");
};

const createChunkFileUri = (uploadId, start) =>
  `${FileSystem.cacheDirectory || ""}backup-${uploadId}-${start}.part`;

const isFieldRequiredError = (error) =>
  error?.status === 422 ||
  String(error?.message || "").toLowerCase().includes("field required");

const uploadChunk = async ({ uploadId, item, token, start, end, fileSize, bytes, signal }) => {
  const headers = {
    "Content-Type": item.content_type || "application/octet-stream",
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
  };

  try {
    return await apiRequest(ENDPOINTS.backup.upload(uploadId), {
      method: "PUT",
      token,
      rawBody: bytes,
      headers,
      signal,
    });
  } catch (error) {
    if (!isFieldRequiredError(error)) {
      throw error;
    }

    const chunkUri = createChunkFileUri(uploadId, start);
    const formData = new FormData();

    await FileSystem.writeAsStringAsync(chunkUri, bytesToBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });

    formData.append("chunk", {
      uri: chunkUri,
      name: `${item.file_name}.part-${start}`,
      type: item.content_type || "application/octet-stream",
    });
    formData.append("file", {
      uri: chunkUri,
      name: `${item.file_name}.part-${start}`,
      type: item.content_type || "application/octet-stream",
    });
    formData.append("start", String(start));
    formData.append("end", String(end));
    formData.append("file_size", String(fileSize));
    formData.append("total_size", String(fileSize));

    try {
      return await apiRequest(ENDPOINTS.backup.upload(uploadId), {
        method: "PUT",
        token,
        body: formData,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        },
        signal,
      });
    } catch (formError) {
      throw new Error(`Backup chunk upload failed: ${formError.message}`);
    } finally {
      FileSystem.deleteAsync(chunkUri, { idempotent: true }).catch(() => {});
    }
  }
};

const computeFileHash = async (item, onProgress, options = {}) => {
  if (item.sha256_hash) {
    return item.sha256_hash;
  }

  const hash = new Sha256();
  const fileSize = Number(item.file_size || 0);
  let position = 0;

  while (position < fileSize) {
    await throwIfStopped(options);

    const length = Math.min(DEFAULT_CHUNK_SIZE, fileSize - position);
    const bytes = await readBytes(item.local_uri, position, length);
    hash.update(bytes);
    position += length;
    onProgress?.({ phase: "hashing", bytesReceived: position, totalBytes: fileSize });
  }

  return hash.digest();
};

export const backupService = {
  checkHealth: async (token, options = {}) => {
    const response = await apiRequest(ENDPOINTS.backup.health, { token, ...options });
    await backupQueueMetaStore.merge({
      last_health_ok_at: new Date().toISOString(),
      last_health_error: "",
    });
    return response;
  },

  listBackups: async (token) => getBackupItems(await apiRequest(ENDPOINTS.backup.list, { token })),

  getFileStatus: async (sha256Hash, token, deviceId) =>
    apiRequest(ENDPOINTS.backup.fileStatus(sha256Hash, deviceId), { token }),

  enqueueAssets: async (assets, defaults = {}) => {
    await backupQueueStore.init();
    const queuedItems = [];

    for (const asset of assets) {
      const item = backupQueueStore.createItem(asset, defaults);
      queuedItems.push(await backupQueueStore.upsert(item));
    }

    await backupQueueMetaStore.merge({
      last_enqueue_at: new Date().toISOString(),
      last_enqueue_count: queuedItems.length,
    });

    return queuedItems;
  },

  syncQueueItem: async (item, token, options = {}) => {
    await throwIfStopped(options);
    await backupService.checkHealth(token);
    await throwIfStopped(options);

    let current = item;
    const emitProgress = (progress) => options.onProgress?.({ item: current, ...progress });

    try {
      if (Number(current.file_size || 0) < 1) {
        throw new Error("File is empty (0 bytes) and cannot be backed up.");
      }

      current = await backupQueueStore.update(current.id, {
        status: BACKUP_QUEUE_STATUS.UPLOADING,
        error: "",
      });

      await throwIfStopped(options);

      const sha256Hash = await computeFileHash(current, emitProgress, options);
      current = await backupQueueStore.update(current.id, { sha256_hash: sha256Hash });

      await throwIfStopped(options);

      if (sha256Hash) {
        try {
          const existing = await backupService.getFileStatus(sha256Hash, token, current.device_id);
          const existingComplete =
            existing?.status === "COMPLETE" ||
            existing?.complete === true ||
            existing?.exists === true;

          if (existingComplete) {
            return backupQueueStore.update(current.id, {
              status: BACKUP_QUEUE_STATUS.COMPLETE,
              bytes_received: current.file_size,
              completed_at: new Date().toISOString(),
            });
          }
        } catch (error) {
          // A miss here just means the backend does not already have the file.
        }
      }

      await throwIfStopped(options);

      let uploadId = current.upload_id;
      let bytesReceived = Number(current.bytes_received || 0);

      if (!uploadId) {
        const initResponse = await initBackupUpload(current, sha256Hash, token);

        uploadId = getUploadId(initResponse);
        bytesReceived = getBytesReceived(initResponse);

        if (!uploadId) {
          throw new Error("The backup server did not return an upload id.");
        }

        current = await backupQueueStore.update(current.id, {
          upload_id: uploadId,
          bytes_received: bytesReceived,
        });
      } else {
        const statusResponse = await apiRequest(ENDPOINTS.backup.status(uploadId), { token });
        bytesReceived = getBytesReceived(statusResponse);
        current = await backupQueueStore.update(current.id, { bytes_received: bytesReceived });
      }

      const fileSize = Number(current.file_size || 0);

      while (bytesReceived < fileSize) {
        await throwIfStopped(options);

        const length = Math.min(DEFAULT_CHUNK_SIZE, fileSize - bytesReceived);
        const start = bytesReceived;
        const end = start + length - 1;
        const bytes = await readBytes(current.local_uri, start, length);

        await throwIfStopped(options);

        const uploadResponse = await uploadChunk({
          uploadId,
          item: current,
          token,
          start,
          end,
          fileSize,
          bytes,
          signal: options.signal,
        });

        bytesReceived = getBytesReceived(uploadResponse) || start + bytes.length;
        current = await backupQueueStore.update(current.id, { bytes_received: bytesReceived });
        emitProgress({
          phase: "uploading",
          bytesReceived,
          totalBytes: fileSize,
          progress: fileSize ? bytesReceived / fileSize : 0,
        });
      }

      await throwIfStopped(options);

      const completeResponse = await apiRequest(ENDPOINTS.backup.complete(uploadId), {
        method: "POST",
        token,
      });
      const completeStatus = completeResponse?.status || completeResponse?.state || "COMPLETE";

      if (String(completeStatus).toUpperCase() !== "COMPLETE") {
        throw new Error("The backup server did not confirm completion.");
      }

      return backupQueueStore.update(current.id, {
        status: BACKUP_QUEUE_STATUS.COMPLETE,
        bytes_received: fileSize,
        error: "",
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      if (error?.name === "AbortError" || error?.name === "SyncStoppedError" || error?.message === STOPPED_REASON) {
        await backupQueueStore.update(current.id, {
          status: BACKUP_QUEUE_STATUS.PENDING,
          error: "",
        });
        throw error;
      }

      await backupQueueStore.update(current.id, {
        status: BACKUP_QUEUE_STATUS.FAILED,
        error: error.message,
      });
      throw error;
    }
  },

  resumeQueue: async (token, options = {}) => {
    await backupQueueStore.init();
    const activeItems = Array.isArray(options.items) && options.items.length
      ? options.items
      : await backupQueueStore.getActive();
    const completed = [];

    let hasFailures = false;

    for (const item of activeItems) {
      if (!(await shouldContinueSync(options))) {
        break;
      }

      try {
        const latest = await backupQueueStore.getById(item.id);
        if (!latest || latest.status === BACKUP_QUEUE_STATUS.COMPLETE) {
          continue;
        }

        const result = await backupService.syncQueueItem(latest, token, options);
        completed.push(result);
      } catch (error) {
        if (error?.name === "SyncStoppedError" || error?.message === STOPPED_REASON) {
          break;
        }

        console.error(`[Backup] Failed to sync item ${item.id}:`, error);
        hasFailures = true;
      }
    }

    await backupQueueMetaStore.merge({
      last_resume_at: new Date().toISOString(),
      last_resume_count: completed.length,
      last_resume_stopped: !(await shouldContinueSync(options)),
      last_resume_had_failures: hasFailures,
    });

    return completed;
  },

  getQueueSnapshot: async () => {
    await backupQueueStore.init();
    const [items, meta] = await Promise.all([
      backupQueueStore.getAll(),
      backupQueueMetaStore.get(),
    ]);

    return {
      items,
      meta,
      storageType: backupQueueStore.storageType,
    };
  },
};
