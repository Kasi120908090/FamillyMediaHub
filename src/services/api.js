import { API_BASE_URL } from "../config/env";

const defaultJsonHeaders = {
  Accept: "application/json",
};

const isFormData = (value) => typeof FormData !== "undefined" && value instanceof FormData;
const FIRST_LOGIN_ERROR_MESSAGE =
  "First login setup incomplete. Verify email and change password first.";

function createApiError(message, status) {
  const error = new Error(message);
  error.status = status;

  if (status === 401) {
    error.code = "UNAUTHORIZED";
  }

  if (status === 403 && message === FIRST_LOGIN_ERROR_MESSAGE) {
    error.code = "FIRST_LOGIN_INCOMPLETE";
  }

  return error;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const validationDetail = Array.isArray(payload?.detail)
      ? payload.detail
          .map((item) => item?.msg || item?.message)
          .filter(Boolean)
          .join("\n")
      : "";
    const errorMessage =
      validationDetail ||
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" && payload.trim()) ||
      "Something went wrong while talking to the server.";

    throw createApiError(errorMessage, response.status);
  }

  return payload;
}

export async function apiRequest(endpoint, options = {}) {
  const { token, body, headers, ...restOptions } = options;
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

  if (body !== undefined) {
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

  if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
    return encodeURI(normalizedPath);
  }

  return encodeURI(`${API_BASE_URL}/${normalizedPath.replace(/^\/+/, "")}`);
}
