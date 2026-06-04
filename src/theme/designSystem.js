import { moderateScale } from "./responsive";

export const spacing = {
  xs: moderateScale(6),
  sm: moderateScale(10),
  md: moderateScale(16),
  lg: moderateScale(22),
  xl: moderateScale(28),
  xxl: moderateScale(36),
};

export const typography = {
  heading: moderateScale(28),
  title: moderateScale(20),
  body: moderateScale(16),
  label: moderateScale(14),
  caption: moderateScale(12),
};

export const borderRadius = {
  sm: moderateScale(8),
  md: moderateScale(14),
  lg: moderateScale(20),
  xl: moderateScale(28),
};

export const layout = {
  screenPadding: spacing.md,
  cardPadding: spacing.lg,
  sectionGap: spacing.lg,
  rowGap: spacing.md,
  iconButtonSize: moderateScale(40),
};
