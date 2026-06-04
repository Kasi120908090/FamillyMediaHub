import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { API_BASE_URL } from "../config/env";

const STORAGE_KEYS = {
  baseUrl: "@family-media-hub/backend-base-url",
  subnet: "@family-media-hub/backend-subnet",
};

const BACKEND_PORT = 8000;
const HEALTH_PATH = "/health";
const EXPECTED_SERVICE = "my-backend";
const REQUEST_TIMEOUT_MS = 1500;
const SCAN_BATCH_SIZE = 16;
const CONFIGURED_BASE_URL = String(API_BASE_URL || "").replace(/\/+$/, "");

let activeBaseUrl = null;
let activeSubnet = null;
const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(activeBaseUrl));
};

export const subscribeBackendBaseUrl = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getCurrentBackendBaseUrl = () => activeBaseUrl;

export const getActiveBackendBaseUrl = async () => {
  if (activeBaseUrl) {
    return activeBaseUrl;
  }

  if (CONFIGURED_BASE_URL) {
    activeBaseUrl = CONFIGURED_BASE_URL;
    notifyListeners();
    return activeBaseUrl;
  }

  const storedBaseUrl = await AsyncStorage.getItem(STORAGE_KEYS.baseUrl);

  if (storedBaseUrl) {
    activeBaseUrl = storedBaseUrl;
    notifyListeners();
  }

  return activeBaseUrl;
};

const setActiveBackend = async (baseUrl, subnet) => {
  activeBaseUrl = baseUrl;
  activeSubnet = subnet;

  if (baseUrl) {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.baseUrl, baseUrl],
      [STORAGE_KEYS.subnet, subnet || ""],
    ]);
  } else {
    await AsyncStorage.multiRemove([STORAGE_KEYS.baseUrl, STORAGE_KEYS.subnet]);
  }

  notifyListeners();
};

const getSubnetPrefix = (ipAddress) => {
  const parts = String(ipAddress || "").split(".");

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(Number(part)))) {
    return null;
  }

  return `${parts[0]}.${parts[1]}.${parts[2]}`;
};

const fetchJsonWithTimeout = async (url, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(null), timeoutMs + 100);
  });

  try {
    const response = await Promise.race([
      fetch(url, {
        method: "GET",
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);

    if (!response?.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const checkBackend = async (baseUrl) => {
  const payload = await fetchJsonWithTimeout(`${baseUrl}${HEALTH_PATH}`);
  return payload?.service === EXPECTED_SERVICE;
};

const scanSubnet = async (subnetPrefix, onProgress) => {
  const candidates = Array.from(
    { length: 254 },
    (_, index) => `http://${subnetPrefix}.${index + 1}:${BACKEND_PORT}`
  );

  for (let index = 0; index < candidates.length; index += SCAN_BATCH_SIZE) {
    const batch = candidates.slice(index, index + SCAN_BATCH_SIZE);
    onProgress?.({
      checked: Math.min(index + batch.length, candidates.length),
      total: candidates.length,
      subnet: subnetPrefix,
    });

    const results = await Promise.all(
      batch.map(async (baseUrl) => ({
        baseUrl,
        found: await checkBackend(baseUrl),
      }))
    );
    const match = results.find((result) => result.found);

    if (match) {
      return match.baseUrl;
    }
  }

  onProgress?.({
    checked: candidates.length,
    total: candidates.length,
    subnet: subnetPrefix,
  });

  return null;
};

export const discoverBackend = async ({ force = false, onProgress } = {}) => {
  if (CONFIGURED_BASE_URL) {
    const found = await checkBackend(CONFIGURED_BASE_URL);
    await setActiveBackend(found ? CONFIGURED_BASE_URL : null, found ? "configured" : null);

    return {
      baseUrl: found ? CONFIGURED_BASE_URL : null,
      ipAddress: null,
      subnet: null,
      status: found ? "found" : "not-found",
      message: found ? "" : `Backend not found at ${CONFIGURED_BASE_URL}`,
    };
  }

  const ipAddress = await Network.getIpAddressAsync();
  const subnetPrefix = getSubnetPrefix(ipAddress);

  if (!subnetPrefix) {
    await setActiveBackend(null, null);
    return {
      baseUrl: null,
      ipAddress,
      subnet: null,
      status: "not-found",
      message: "Backend not found on this Wi-Fi",
    };
  }

  if (!force && activeBaseUrl && activeSubnet === subnetPrefix) {
    return {
      baseUrl: activeBaseUrl,
      ipAddress,
      subnet: subnetPrefix,
      status: "found",
    };
  }

  const foundBaseUrl = await scanSubnet(subnetPrefix, onProgress);
  await setActiveBackend(foundBaseUrl, foundBaseUrl ? subnetPrefix : null);

  return {
    baseUrl: foundBaseUrl,
    ipAddress,
    subnet: subnetPrefix,
    status: foundBaseUrl ? "found" : "not-found",
    message: foundBaseUrl ? "" : "Backend not found on this Wi-Fi",
  };
};

export const watchBackendNetworkChanges = (onChange, onScanning, onProgress) => {
  const subscription = Network.addNetworkStateListener?.(() => {
    onScanning?.();
    discoverBackend({ force: true, onProgress })
      .then(onChange)
      .catch(() => {
        onChange?.({
          baseUrl: null,
          subnet: null,
          status: "not-found",
          message: "Backend not found on this Wi-Fi",
        });
      });
  });

  return () => subscription?.remove?.();
};
