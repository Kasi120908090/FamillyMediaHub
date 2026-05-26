import AsyncStorage from "@react-native-async-storage/async-storage";
import { backupAutoSyncService } from "./backupAutoSyncService";

const TASK_NAME = "family-media-hub-auto-backup";
const CONTEXT_KEY = "@family-media-hub/backup-autosync-context";

let taskDefined = false;

const optionalRequire = (moduleName) => {
  try {
    const runtimeRequire = eval("require");
    return runtimeRequire(moduleName);
  } catch (error) {
    return null;
  }
};

const getTaskManager = () => optionalRequire("expo-task-manager");
const getBackgroundFetch = () => optionalRequire("expo-background-fetch");
const getBackgroundTask = () => optionalRequire("expo-background-task");

const defineTask = () => {
  const TaskManager = getTaskManager();

  if (!TaskManager?.defineTask || taskDefined) {
    return false;
  }

  TaskManager.defineTask(TASK_NAME, async () => {
    const BackgroundFetch = getBackgroundFetch();
    const contextRaw = await AsyncStorage.getItem(CONTEXT_KEY);
    const context = contextRaw ? JSON.parse(contextRaw) : {};

    if (!context.token || !context.deviceId) {
      return BackgroundFetch?.BackgroundFetchResult?.NoData || "no-data";
    }

    try {
      await backupAutoSyncService.runOnce(context);
      return BackgroundFetch?.BackgroundFetchResult?.NewData || "new-data";
    } catch (error) {
      return BackgroundFetch?.BackgroundFetchResult?.Failed || "failed";
    }
  });

  taskDefined = true;
  return true;
};

export const backupBackgroundTask = {
  saveContext: async (context) => {
    if (!context?.token || !context?.deviceId) {
      await AsyncStorage.removeItem(CONTEXT_KEY);
      return;
    }

    await AsyncStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  },

  register: async ({ intervalMinutes } = {}) => {
    if (!defineTask()) {
      return { registered: false, reason: "background task modules are not installed" };
    }

    const BackgroundFetch = getBackgroundFetch();
    const BackgroundTask = getBackgroundTask();
    const minimumInterval = Math.max(15, Number(intervalMinutes || 30)) * 60;

    if (BackgroundFetch?.registerTaskAsync) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      return { registered: true, driver: "expo-background-fetch" };
    }

    if (BackgroundTask?.registerTaskAsync) {
      await BackgroundTask.registerTaskAsync(TASK_NAME, {
        minimumInterval,
      });
      return { registered: true, driver: "expo-background-task" };
    }

    return { registered: false, reason: "no supported background scheduler is installed" };
  },

  unregister: async () => {
    const BackgroundFetch = getBackgroundFetch();
    const BackgroundTask = getBackgroundTask();

    if (BackgroundFetch?.unregisterTaskAsync) {
      await BackgroundFetch.unregisterTaskAsync(TASK_NAME).catch(() => {});
    }

    if (BackgroundTask?.unregisterTaskAsync) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME).catch(() => {});
    }
  },
};
