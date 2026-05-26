import { API_BASE_URL } from "../config/env";

const defaultJsonHeaders = {
  Accept: "application/json",
};

const isFormData = (value) => typeof FormData !== "undefined" && value instanceof FormData;
const FIRST_LOGIN_ERROR_MESSAGE =
  "First login setup incomplete. Verify email and change password first.";

const isFirstLoginErrorMessage = (message) =>
  String(message || "").toLowerCase().includes("first login setup incomplete");

function createApiError(message, status) {
  const error = new Error(message);
  error.status = status;

  if (status === 401) {
    error.code = "UNAUTHORIZED";
  }

  if (
    status === 403 &&
    (message === FIRST_LOGIN_ERROR_MESSAGE || isFirstLoginErrorMessage(message))
  ) {
    error.code = "FIRST_LOGIN_INCOMPLETE";
  }

  return error;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    console.warn("[API] Response error status:", response.status);
    console.warn("[API] Response payload:", payload);
    
    const validationDetail = Array.isArray(payload?.detail)
      ? payload.detail
          .map((item) => {
            const location = Array.isArray(item?.loc)
              ? item.loc.filter((part) => part !== "body").join(".")
              : "";
            const message = item?.msg || item?.message;
            return location && message ? `${location}: ${message}` : message;
          })
          .filter(Boolean)
          .join("\n")
      : "";
    const errorMessage =
      validationDetail ||
      payload?.detail ||
      payload?.message ||
      payload?.error ||
      (typeof payload === "string" && payload.trim()) ||
      "Something went wrong while talking to the server.";

    console.warn("[API] Throwing error:", errorMessage);
    throw createApiError(errorMessage, response.status);
  }

  return payload;
}

export async function apiRequest(endpoint, options = {}) {
  const { token, body, rawBody, headers, ...restOptions } = options;
  const requestHeaders = {
    ...defaultJsonHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const requestOptions = {
    method: "GET",
    ...restOptions,
    headers: requestHeaders,
  };

  if (rawBody !== undefined) {
    requestOptions.body = rawBody;
  } else if (body !== undefined) {
    if (isFormData(body)) {
      delete requestHeaders["Content-Type"];
      requestOptions.body = body;
    } else {
      requestHeaders["Content-Type"] = "application/json";
      requestOptions.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    return parseResponse(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    if (error?.message === "Network request failed" || error instanceof TypeError) {
      throw new Error(
        `Unable to reach the server at ${API_BASE_URL}. Check that the backend is running and your phone is on the same Wi-Fi/network.`
      );
    }

    throw error;
  }
}

export function resolveMediaUri(filePath) {
  if (!filePath) {
    return null;
  }

  const normalizedPath = String(filePath).replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://") ||
    normalizedPath.startsWith("file://") ||
    normalizedPath.startsWith("content://") ||
    normalizedPath.startsWith("data:") ||
    normalizedPath.startsWith("ph://")
  ) {
    return encodeURI(normalizedPath);
  }

  return encodeURI(`${API_BASE_URL}/${normalizedPath.replace(/^\/+/, "")}`);
}
