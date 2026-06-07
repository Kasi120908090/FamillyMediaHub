import { useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import { backupAutoSyncService } from "../services/backupAutoSyncService";
import { backupBackgroundTask } from "../services/backupBackgroundTask";
import { userService } from "../services/userService";

const getLoggedInChildId = (user) =>
  user?.child_id ||
  user?.childId ||
  user?.child_profile_id ||
  user?.childProfileId ||
  user?.child?.id ||
  user?.child_profile?.id ||
  user?.childProfile?.id ||
  user?.profile?.id ||
  null;

const getDeviceId = (user, parentDevices) =>
  user?.device_id ||
  user?.deviceId ||
  user?.device?.id ||
  parentDevices?.[0]?.id ||
  null;

const makeMacAddress = (seed) => {
  const normalized = String(seed || "family-hub");
  const bytes = Array.from({ length: 6 }, (_, idx) => {
    let value = 0;

    for (let index = idx; index < normalized.length; index += 6) {
      value = (value + normalized.charCodeAt(index) * (idx + 1)) & 0xff;
    }

    return value;
  });

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(":").toUpperCase();
};

const createDevicePayload = (user) => {
  const deviceName =
    Platform.OS === "android"
      ? "Android phone"
      : Platform.OS === "ios"
        ? "iPhone"
        : "Current device";
  const userKey = user?.id || user?.username || "user";

  return {
    device_name: deviceName,
    name: deviceName,
    device_type: Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : "web",
    platform: Platform.OS || "mobile",
    serial_number: `family-hub-${userKey}-${Platform.OS}`,
    mac_address: makeMacAddress(`${userKey}-${Platform.OS}`),
  };
};

export function useBackupAutoSync({ authToken, currentUser, parentDevices, refreshDevices }) {
  const intervalRef = useRef(null);
  const deviceRegistrationRef = useRef(false);
  const latestContextRef = useRef(null);
  const deviceId = useMemo(
    () => getDeviceId(currentUser, parentDevices),
    [currentUser, parentDevices]
  );
  const childId = useMemo(() => getLoggedInChildId(currentUser), [currentUser]);

  useEffect(() => {
    let isMounted = true;

    const stopTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const stopAutoSync = async () => {
      stopTimer();
      latestContextRef.current = null;
      await backupAutoSyncService.stopNow().catch(() => {});
      await backupBackgroundTask.saveContext(null).catch(() => {});
      await backupBackgroundTask.unregister?.().catch(() => {});
    };

    const run = async () => {
      if (!latestContextRef.current) {
        return;
      }

      const enabled = await backupAutoSyncService.isEnabled().catch(() => false);

      if (!enabled) {
        await stopAutoSync();
        return;
      }

      await backupAutoSyncService.runOnce(latestContextRef.current).catch(() => {});
    };

    const ensureDeviceId = async () => {
      const existingDeviceId = getDeviceId(currentUser, parentDevices);

      if (existingDeviceId || !authToken || !currentUser || deviceRegistrationRef.current) {
        return existingDeviceId;
      }

      deviceRegistrationRef.current = true;

      try {
        const createdDevice = await userService.createDevice(createDevicePayload(currentUser), authToken);
        const devices = await refreshDevices?.();
        return createdDevice?.id || devices?.[0]?.id || null;
      } catch (error) {
        const message = String(error?.message || "").toLowerCase();
        const duplicateDevice =
          message.includes("mac address") ||
          message.includes("already exists") ||
          message.includes("duplicate") ||
          error?.status === 409;

        if (duplicateDevice) {
          const devices = await refreshDevices?.();
          return devices?.[0]?.id || null;
        }

        return null;
      } finally {
        deviceRegistrationRef.current = false;
      }
    };

    const start = async () => {
      stopTimer();

      if (!authToken || !currentUser) {
        latestContextRef.current = null;
        await backupBackgroundTask.saveContext(null);
        await backupBackgroundTask.unregister?.().catch(() => {});
        return;
      }

      const settings = await backupAutoSyncService.getSettings();

      if (!isMounted || !settings.enabled) {
        await stopAutoSync();
        return;
      }

      const resolvedDeviceId = await ensureDeviceId();

      if (!resolvedDeviceId) {
        latestContextRef.current = null;
        await backupBackgroundTask.saveContext(null);
        await backupBackgroundTask.unregister?.().catch(() => {});
        return;
      }

      const stillEnabled = await backupAutoSyncService.isEnabled().catch(() => false);

      if (!isMounted || !stillEnabled) {
        await stopAutoSync();
        return;
      }

      latestContextRef.current = {
        token: authToken,
        deviceId: resolvedDeviceId,
        childId,
        settings,
      };

      await backupBackgroundTask.saveContext(latestContextRef.current);
      await backupBackgroundTask.register({
        intervalMinutes: settings.intervalMinutes,
      }).catch(() => {});

      run();

      intervalRef.current = setInterval(
        run,
        Math.max(15, Number(settings.intervalMinutes || 30)) * 60 * 1000
      );
    };

    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") {
        return;
      }

      const enabled = await backupAutoSyncService.isEnabled().catch(() => false);

      if (!enabled) {
        await stopAutoSync();
        return;
      }

      run();
    });

    start();

    return () => {
      isMounted = false;
      stopTimer();
      subscription?.remove?.();
    };
  }, [authToken, childId, currentUser, deviceId, parentDevices, refreshDevices]);
}
