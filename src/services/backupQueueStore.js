import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKUP_QUEUE_STATUS = {
  PENDING: "PENDING",
  UPLOADING: "UPLOADING",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
};

const QUEUE_KEY = "@family-media-hub/backup-queue";
const META_KEY = "@family-media-hub/backup-meta";
const TABLE_NAME = "backup_queue";

const now = () => new Date().toISOString();
const createLocalId = () =>
  `backup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeQueueItem = (item) => ({
  id: item.id || createLocalId(),
  upload_id: item.upload_id || item.uploadId || null,
  local_uri: item.local_uri || item.localUri || item.uri || "",
  file_name: item.file_name || item.fileName || item.name || "backup-file",
  file_size: Number(item.file_size || item.fileSize || item.size || 0),
  content_type: item.content_type || item.contentType || item.mimeType || "application/octet-stream",
  device_id: item.device_id || item.deviceId || null,
  duration: Number(item.duration || 0),
  child_id: item.child_id || item.childId || null,
  sha256_hash: item.sha256_hash || item.sha256Hash || "",
  bytes_received: Number(item.bytes_received || item.bytesReceived || 0),
  status: item.status || BACKUP_QUEUE_STATUS.PENDING,
  error: item.error || "",
  created_at: item.created_at || now(),
  updated_at: item.updated_at || now(),
  completed_at: item.completed_at || null,
});

const queueItemColumns = [
  "id",
  "upload_id",
  "local_uri",
  "file_name",
  "file_size",
  "content_type",
  "device_id",
  "duration",
  "child_id",
  "sha256_hash",
  "bytes_received",
  "status",
  "error",
  "created_at",
  "updated_at",
  "completed_at",
];

const toSqlValues = (item) => queueItemColumns.map((column) => item[column] ?? null);

const createAsyncStorageStore = () => {
  const readQueue = async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeQueueItem) : [];
  };

  const writeQueue = async (items) => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.map(normalizeQueueItem)));
  };

  return {
    type: "async-storage",
    init: async () => {},
    getAll: readQueue,
    getActive: async () =>
      (await readQueue()).filter((item) =>
        [BACKUP_QUEUE_STATUS.PENDING, BACKUP_QUEUE_STATUS.UPLOADING, BACKUP_QUEUE_STATUS.FAILED].includes(item.status)
      ),
    getById: async (id) => (await readQueue()).find((item) => item.id === id) || null,
    upsert: async (item) => {
      const nextItem = normalizeQueueItem(item);
      const queue = await readQueue();
      const index = queue.findIndex((queued) => queued.id === nextItem.id);

      if (index >= 0) {
        queue[index] = { ...queue[index], ...nextItem, updated_at: now() };
      } else {
        queue.unshift(nextItem);
      }

      await writeQueue(queue);
      return index >= 0 ? queue[index] : nextItem;
    },
    update: async (id, updates) => {
      const queue = await readQueue();
      const index = queue.findIndex((item) => item.id === id);

      if (index < 0) {
        return null;
      }

      queue[index] = normalizeQueueItem({ ...queue[index], ...updates, updated_at: now() });
      await writeQueue(queue);
      return queue[index];
    },
    remove: async (id) => {
      await writeQueue((await readQueue()).filter((item) => item.id !== id));
    },
    clearComplete: async () => {
      await writeQueue((await readQueue()).filter((item) => item.status !== BACKUP_QUEUE_STATUS.COMPLETE));
    },
  };
};

const loadExpoSQLite = () => {
  try {
    const optionalRequire = eval("require");
    return optionalRequire("expo-sqlite");
  } catch (error) {
    return null;
  }
};

const createSQLiteStore = () => {
  const SQLite = loadExpoSQLite();

  if (!SQLite?.openDatabaseAsync) {
    return null;
  }

  let dbPromise = null;
  const getDb = async () => {
    if (!dbPromise) {
      dbPromise = SQLite.openDatabaseAsync("family-media-hub-backup.db");
    }

    return dbPromise;
  };

  const run = async (sql, params = []) => (await getDb()).runAsync(sql, params);
  const getAll = async (sql, params = []) => (await getDb()).getAllAsync(sql, params);

  return {
    type: "sqlite",
    init: async () => {
      await run(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id TEXT PRIMARY KEY NOT NULL,
          upload_id TEXT,
          local_uri TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          content_type TEXT NOT NULL,
          device_id INTEGER,
          duration REAL NOT NULL DEFAULT 0,
          child_id INTEGER,
          sha256_hash TEXT,
          bytes_received INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        )`
      );

      // Schema Migration: Add duration column if it's missing in existing installations
      try {
        const tableInfo = await getAll(`PRAGMA table_info(${TABLE_NAME})`);
        const hasDuration = tableInfo.some((col) => col.name === "duration");
        if (!hasDuration) {
          await run(`ALTER TABLE ${TABLE_NAME} ADD COLUMN duration REAL NOT NULL DEFAULT 0`);
        }
      } catch (migrationError) {
        console.error("[BackupQueueStore] SQLite migration failed:", migrationError);
      }
    },
    getAll: async () =>
      (await getAll(`SELECT * FROM ${TABLE_NAME} ORDER BY updated_at DESC`)).map(normalizeQueueItem),
    getActive: async () =>
      (
        await getAll(
          `SELECT * FROM ${TABLE_NAME} WHERE status IN (?, ?, ?) ORDER BY updated_at DESC`,
          [
            BACKUP_QUEUE_STATUS.PENDING,
            BACKUP_QUEUE_STATUS.UPLOADING,
            BACKUP_QUEUE_STATUS.FAILED,
          ]
        )
      ).map(normalizeQueueItem),
    getById: async (id) => {
      const row = (await getAll(`SELECT * FROM ${TABLE_NAME} WHERE id = ? LIMIT 1`, [id]))[0];
      return row ? normalizeQueueItem(row) : null;
    },
    upsert: async (item) => {
      const nextItem = normalizeQueueItem(item);
      const placeholders = queueItemColumns.map(() => "?").join(", ");
      const assignments = queueItemColumns
        .filter((column) => column !== "id")
        .map((column) => `${column} = excluded.${column}`)
        .join(", ");

      await run(
        `INSERT INTO ${TABLE_NAME} (${queueItemColumns.join(", ")})
         VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${assignments}`,
        toSqlValues(nextItem)
      );
      return nextItem;
    },
    update: async (id, updates) => {
      const row = (await getAll(`SELECT * FROM ${TABLE_NAME} WHERE id = ? LIMIT 1`, [id]))[0];

      if (!row) {
        return null;
      }

      const nextItem = normalizeQueueItem({ ...row, ...updates, id, updated_at: now() });
      const assignments = queueItemColumns
        .filter((column) => column !== "id")
        .map((column) => `${column} = ?`)
        .join(", ");

      await run(
        `UPDATE ${TABLE_NAME} SET ${assignments} WHERE id = ?`,
        [...queueItemColumns.filter((column) => column !== "id").map((column) => nextItem[column] ?? null), id]
      );
      return nextItem;
    },
    remove: async (id) => {
      await run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    },
    clearComplete: async () => {
      await run(`DELETE FROM ${TABLE_NAME} WHERE status = ?`, [BACKUP_QUEUE_STATUS.COMPLETE]);
    },
  };
};

const fallbackStore = createAsyncStorageStore();
let activeStore = null;

const getStore = async () => {
  if (activeStore) {
    return activeStore;
  }

  activeStore = createSQLiteStore() || fallbackStore;

  try {
    await activeStore.init();
  } catch (error) {
    activeStore = fallbackStore;
    await activeStore.init();
  }

  return activeStore;
};

export const backupQueueMetaStore = {
  get: async () => {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  },
  merge: async (updates) => {
    const nextMeta = { ...(await backupQueueMetaStore.get()), ...updates, updated_at: now() };
    await AsyncStorage.setItem(META_KEY, JSON.stringify(nextMeta));
    return nextMeta;
  },
};

export const backupQueueStore = {
  get storageType() {
    return activeStore?.type || "pending";
  },
  init: async () => getStore(),
  createItem: (asset, defaults = {}) =>
    normalizeQueueItem({
      id: defaults.id || asset.id,
      local_uri: asset.uri,
      file_name: asset.name || asset.fileName || `backup-${Date.now()}`,
      file_size: asset.size || asset.fileSize || 0,
      content_type: asset.mimeType || asset.type || "application/octet-stream",
      duration: asset.duration || 0,
      device_id: defaults.device_id,
      child_id: defaults.child_id,
      status: defaults.status,
    }),
  getAll: async () => (await getStore()).getAll(),
  getActive: async () => (await getStore()).getActive(),
  getById: async (id) => (await getStore()).getById(id),
  upsert: async (item) => (await getStore()).upsert(item),
  update: async (id, updates) => (await getStore()).update(id, updates),
  remove: async (id) => (await getStore()).remove(id),
  clearComplete: async () => (await getStore()).clearComplete(),
};
