import { ENDPOINTS } from "../config/endpoints";
import { apiRequest } from "./api";

export const mediaService = {
  listMediaForParent: (token, category) =>
    apiRequest(ENDPOINTS.media.listForParent(category), {
      token,
    }),

  listMediaForChild: (childId, token, category) =>
    apiRequest(ENDPOINTS.media.listForChild(childId, category), {
      token,
    }),

  listMediaForDevice: (deviceId, token, filters) =>
    apiRequest(ENDPOINTS.media.listForDevice(deviceId, filters), {
      token,
    }),

  uploadMedia: (payload, token, options = {}) => {
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

    return apiRequest(ENDPOINTS.media.upload, {
      method: "POST",
      token,
      body: formData,
      signal: options.signal,
    });
  },

  cancelUpload: (uploadId, token) =>
    apiRequest(ENDPOINTS.media.cancelUpload(uploadId), {
      method: "POST",
      token,
    }),
};
