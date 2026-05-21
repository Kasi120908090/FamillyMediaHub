export const ENDPOINTS = {
  auth: {
    register: "/auth/register",
    login: "/auth/login",
    me: "/auth/me",
    sendFirstLoginOtp: "/auth/first-login/send-otp",
    verifyFirstLoginOtp: "/auth/first-login/verify-otp",
    completeFirstLogin: "/auth/first-login/complete",
    forgotPassword: "/auth/forgot-password",
    verifyForgotPasswordOtp: "/auth/verify-forgot-password-otp",
    resetForgotPassword: "/auth/reset-forgot-password",
    verifyPassword: "/auth/verify-password",
  },
  users: {
    children: "/users/children",
    child: (childId) => `/users/child/${childId}`,
    myChildProfile: "/users/me/child-profile",
    childrenForParent: (parentId) => `/users/children/${parentId}`,
    myDevices: "/users/me/devices",
    deviceChildren: (deviceId) => `/users/me/devices/${deviceId}/children`,
    assignChildToDevice: (deviceId, childId) =>
      `/users/me/devices/${deviceId}/children/${childId}`,
  },
  media: {
    upload: "/users/media/upload",
    cancelUpload: (uploadId) =>
      `/users/media/upload/${encodeURIComponent(uploadId)}/cancel`,
    initUpload: "/users/media/uploads/init",
    uploadChunk: (uploadId) =>
      `/users/media/uploads/${encodeURIComponent(uploadId)}/chunk`,
    uploadStatus: (uploadId) =>
      `/users/media/uploads/${encodeURIComponent(uploadId)}/status`,
    completeUpload: (uploadId) =>
      `/users/media/uploads/${encodeURIComponent(uploadId)}/complete`,
    cancelChunkedUpload: (uploadId) =>
      `/users/media/uploads/${encodeURIComponent(uploadId)}`,
    videoStream: (mediaId) =>
      `/users/media/video/${encodeURIComponent(mediaId)}/stream`,
    listForParent: (category) =>
      `/users/media/parent${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    listForChild: (childId, category) =>
      `/users/media/child/${childId}${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    listForDevice: (deviceId, { childId, category } = {}) => {
      const params = new URLSearchParams();

      if (childId !== undefined && childId !== null) {
        params.set("child_id", String(childId));
      }

      if (category) {
        params.set("category", category);
      }

      const query = params.toString();
      return `/users/media/devices/${deviceId}${query ? `?${query}` : ""}`;
    },
  },
  backup: {
    health: "/health",
    init: "/backup/init",
    upload: (uploadId) => `/backup/upload/${encodeURIComponent(uploadId)}`,
    status: (uploadId) => `/backup/status/${encodeURIComponent(uploadId)}`,
    complete: (uploadId) => `/backup/complete/${encodeURIComponent(uploadId)}`,
    fileStatus: (sha256Hash, deviceId) =>
      `/backup/file-status/${encodeURIComponent(sha256Hash)}${
        deviceId !== undefined && deviceId !== null
          ? `?device_id=${encodeURIComponent(deviceId)}`
          : ""
      }`,
    list: "/backup/list",
  },
};
