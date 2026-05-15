import { ENDPOINTS } from "../config/endpoints";
import { apiRequest } from "./api";

export const userService = {
  createChild: (payload, token) =>
    apiRequest(ENDPOINTS.users.children, {
      method: "POST",
      token,
      body: payload,
    }),

  getChildren: (parentId, token) =>
    apiRequest(ENDPOINTS.users.childrenForParent(parentId), {
      token,
    }),

  getCurrentUserChildren: (token) =>
    apiRequest(ENDPOINTS.auth.me, {
      token,
    }),

  getMyDevices: (token) =>
    apiRequest(ENDPOINTS.users.myDevices, {
      token,
    }),

  createDevice: (payload, token) =>
    apiRequest(ENDPOINTS.users.myDevices, {
      method: "POST",
      token,
      body: payload,
    }),

  assignChildToDevice: (deviceId, childId, token) =>
    apiRequest(ENDPOINTS.users.assignChildToDevice(deviceId, childId), {
      method: "POST",
      token,
    }),

  getDeviceChildren: (deviceId, token) =>
    apiRequest(ENDPOINTS.users.deviceChildren(deviceId), {
      token,
    }),

  getChild: (childId, token) =>
    apiRequest(ENDPOINTS.users.child(childId), {
      token,
    }),

  updateChild: (childId, payload, token) =>
    apiRequest(ENDPOINTS.users.child(childId), {
      method: "PUT",
      token,
      body: payload,
    }),

  updateOwnChildProfile: (payload, token) =>
    apiRequest(ENDPOINTS.users.myChildProfile, {
      method: "PUT",
      token,
      body: payload,
    }),
};
