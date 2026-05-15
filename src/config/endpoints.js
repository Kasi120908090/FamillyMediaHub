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
};
