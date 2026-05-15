export const getThemedAvatarUri = (uri, name, color) => {
  const safeName = name || "Family Hub";
  const background = (color || "#2563EB").replace("#", "");

  if (!uri || uri.includes("ui-avatars.com/api")) {
    return `https://ui-avatars.com/api/?background=${background}&color=fff&name=${encodeURIComponent(
      safeName
    )}`;
  }

  return uri;
};
