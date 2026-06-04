import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

export const horizontalScale = (size) => (SCREEN_WIDTH / BASE_WIDTH) * size;
export const verticalScale = (size) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;

export const moderateScale = (size, factor = 0.5) => {
  const scaledSize = horizontalScale(size);
  return size + (scaledSize - size) * factor;
};

export const responsiveWidth = (value) => {
  if (typeof value === "string" && value.endsWith("%")) {
    return (SCREEN_WIDTH * parseFloat(value)) / 100;
  }

  return horizontalScale(value);
};

export const responsiveHeight = (value) => {
  if (typeof value === "string" && value.endsWith("%")) {
    return (SCREEN_HEIGHT * parseFloat(value)) / 100;
  }

  return verticalScale(value);
};
