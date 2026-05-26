import { ENDPOINTS } from "../config/endpoints";
import { apiRequest } from "./api";

export const authService = {
  register: (payload) =>
    apiRequest(ENDPOINTS.auth.register, {
      method: "POST",
      body: payload,
    }),

  login: (credentials) =>
    apiRequest(ENDPOINTS.auth.login, {
      method: "POST",
      body: credentials,
    }),

  getMe: (token) =>
    apiRequest(ENDPOINTS.auth.me, {
      token,
    }),

  completeFirstLogin: (payload, token) =>
    apiRequest(ENDPOINTS.auth.completeFirstLogin, {
      method: "POST",
      token,
      body: payload,
    }),

  forgotPassword: (email) =>
    apiRequest(ENDPOINTS.auth.forgotPassword, {
      method: "POST",
      body: { email },
    }),

  verifyForgotPasswordOtp: ({ email, otp }) =>
    apiRequest(ENDPOINTS.auth.verifyForgotPasswordOtp, {
      method: "POST",
      body: { email, otp },
    }),

  resetForgotPassword: ({ email, otp, new_password }) =>
    apiRequest(ENDPOINTS.auth.resetForgotPassword, {
      method: "POST",
      body: { email, otp, new_password },
    }),

  sendFirstLoginOtp: (email, token) => {
    console.log("[authService] sendFirstLoginOtp called with email:", email);
    return apiRequest(ENDPOINTS.auth.sendFirstLoginOtp, {
      method: "POST",
      token,
      body: { email },
    }).then(response => {
      console.log("[authService] sendFirstLoginOtp successful:", response);
      return response;
    }).catch(error => {
      console.error("[authService] sendFirstLoginOtp failed:", error);
      throw error;
    });
  },

  verifyFirstLoginOtp: ({ email, otp, new_password }, token) =>
    apiRequest(ENDPOINTS.auth.verifyFirstLoginOtp, {
      method: "POST",
      token,
      body: { email, otp, new_password },
    }),

  verifyPassword: (password, token) =>
    apiRequest(ENDPOINTS.auth.verifyPassword, {
      method: "POST",
      token,
      body: { password },
    }),
};
