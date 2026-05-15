export const isChildAccount = (user) => user?.account_type === "child";

export const isParentAdmin = (user) =>
  user?.account_type === "user" && user?.role === "parent_admin";

export const requiresFirstLoginSetup = (user) =>
  isParentAdmin(user) && Boolean(user?.is_first_login);

export const isParentAdminReady = (user) =>
  isParentAdmin(user) && !requiresFirstLoginSetup(user);

export const canAccessApp = (user) =>
  isChildAccount(user) || isParentAdmin(user);

export const getDefaultAuthenticatedRoute = (user) => {
  if (requiresFirstLoginSetup(user)) {
    return "FirstLoginSetup";
  }

  if (isChildAccount(user)) {
    return "AuthProfile";
  }

  if (isParentAdminReady(user)) {
    return "AuthProfile";
  }

  return "Welcome";
};
