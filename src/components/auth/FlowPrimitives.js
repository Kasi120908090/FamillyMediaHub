import React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import logo from "../../../assets/logo.png";
import iconBg from "../../../assets/iconbg.png";
import { commonStyles } from "../../theme/commonStyles";
import { borderRadius, layout, spacing, typography } from "../../theme/designSystem";
import { moderateScale, responsiveHeight, responsiveWidth, verticalScale } from "../../theme/responsive";

export function BrandHeader({ rightSlot }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <View>
          <Text style={styles.brandTitle}>Family Media Hub</Text>
          <Text style={styles.brandSubtitle}>Your family. Your memories. Together.</Text>
        </View>
      </View>
      <View style={styles.rightSlot}>
        {rightSlot || (
          <View style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={18} color="#5A35F0" />
          </View>
        )}
      </View>
    </View>
  );
}

export function AuthFlowShell({
  children,
  rightSlot,
  scroll = true,
  contentContainerStyle,
  showFooterWaves = true,
}) {
  const insets = useSafeAreaInsets();
  const contentPaddingBottom = Math.max(insets.bottom + 24, 32);

  const content = (
    <View style={[styles.content, { paddingBottom: contentPaddingBottom }, contentContainerStyle]}>
      {children}
      {showFooterWaves ? <FooterWaves /> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCF9FF" />
      <View style={styles.topGlow} />
      <View style={styles.rightGlow} />
      <View style={styles.leftGlow} />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <BrandHeader rightSlot={rightSlot} />
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </View>
  );
}

export function FlowCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function FlowInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  secureTextEntry,
  secureVisible,
  onToggleSecure,
  editable = true,
  keyboardType = "default",
  autoCapitalize = "none",
  autoFocus = false,
  multiline = false,
  rightContent,
}) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputShell, error ? styles.inputShellError : null, !editable ? styles.inputShellMuted : null]}>
        {icon ? <Ionicons name={icon} size={17} color="#8D76E8" style={styles.leftIcon} /> : null}
        <TextInput
          style={[styles.input, multiline ? styles.inputMultiline : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#B1A8D8"
          secureTextEntry={secureTextEntry && !secureVisible}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          multiline={multiline}
        />
        {rightContent}
        {secureTextEntry ? (
          <TouchableOpacity onPress={onToggleSecure} style={styles.eyeButton} activeOpacity={0.8}>
            <Ionicons
              name={secureVisible ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#8B7FC3"
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryAction({ label, onPress, disabled, loading, icon = "arrow-forward" }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.primaryButton, disabled || loading ? styles.buttonDisabled : null]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          <Text style={styles.primaryButtonText}>{label}</Text>
          <Ionicons name={icon} size={16} color="#FFFFFF" />
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryAction({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryButton, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function InfoBanner({ icon = "shield-checkmark-outline", text, style }) {
  return (
    <View style={[styles.infoBanner, style]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={15} color="#6A38F5" />
      </View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ title, subtitle, centered = false, titleStyle, subtitleStyle }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={[styles.sectionTitle, centered ? styles.textCentered : null, titleStyle]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, centered ? styles.textCentered : null, subtitleStyle]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function FamilyHeroIllustration({ locked = false }) {
  return (
    <View style={styles.heroIllustration}>
      <Image source={iconBg} style={styles.heroImage} resizeMode="contain" />
      {locked ? (
        <View style={styles.heroLockBadge}>
          <Ionicons name="lock-closed" size={13} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

function FooterWaves() {
  return (
    <View style={styles.footerWaves}>
      <View style={styles.waveBack} />
      <View style={styles.waveFront} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FCF9FF",
  },
  safeArea: {
    flex: 1,
  },
  topGlow: {
    position: "absolute",
    top: -verticalScale(110),
    right: -moderateScale(40),
    width: moderateScale(250),
    height: moderateScale(250),
    borderRadius: moderateScale(125),
    backgroundColor: "rgba(129, 99, 255, 0.12)",
  },
  rightGlow: {
    position: "absolute",
    top: moderateScale(120),
    right: -moderateScale(30),
    width: moderateScale(180),
    height: moderateScale(280),
    borderRadius: moderateScale(90),
    backgroundColor: "rgba(170, 133, 255, 0.10)",
    transform: [{ rotate: "22deg" }],
  },
  leftGlow: {
    position: "absolute",
    bottom: moderateScale(120),
    left: -moderateScale(50),
    width: moderateScale(180),
    height: moderateScale(180),
    borderRadius: moderateScale(90),
    backgroundColor: "rgba(255, 182, 117, 0.07)",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
  },
  header: {
    ...commonStyles.rowBetween,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  brandMark: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: borderRadius.md,
    backgroundColor: "#4E1FDE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
    shadowColor: "#6A38F5",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  brandLogo: {
    width: moderateScale(30),
    height: moderateScale(30),
  },
  brandTitle: {
    fontSize: typography.title,
    lineHeight: typography.title * 1.2,
    fontWeight: "800",
    color: "#34208C",
  },
  brandSubtitle: {
    marginTop: spacing.xs / 2,
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    color: "#8B7FC3",
  },
  rightSlot: {
    minWidth: moderateScale(34),
    alignItems: "flex-end",
    justifyContent: "center",
  },
  iconButton: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: layout.iconButtonSize / 2,
    backgroundColor: "#F2ECFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEE6FF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: "#7C4DFF",
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    borderWidth: 1,
    borderColor: "#F2EAFF",
  },
  sectionTitleWrap: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.heading,
    lineHeight: typography.heading * 1.2,
    fontWeight: "900",
    color: "#2D158B",
  },
  sectionSubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.5,
    color: "#8C80B8",
  },
  textCentered: {
    textAlign: "center",
  },
  fieldWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
    fontSize: typography.label,
    fontWeight: "800",
    color: "#4B2AA5",
  },
  inputShell: {
    minHeight: moderateScale(48),
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "#E6DCF9",
    backgroundColor: "#FCFBFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  inputShellError: {
    borderColor: "#FF7C98",
  },
  inputShellMuted: {
    opacity: 0.7,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: "#24145B",
    fontSize: typography.body,
    paddingVertical: verticalScale(12),
  },
  inputMultiline: {
    minHeight: moderateScale(74),
    textAlignVertical: "top",
  },
  eyeButton: {
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorText: {
    marginTop: spacing.xs / 2,
    color: "#E74A78",
    fontSize: typography.caption,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: moderateScale(50),
    borderRadius: borderRadius.md,
    backgroundColor: "#5A23E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    shadowColor: "#5A23E5",
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: moderateScale(44),
    borderRadius: borderRadius.md,
    backgroundColor: "#F5F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#6940E7",
    fontSize: typography.label,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  infoBanner: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: "#F6F1FF",
    borderWidth: 1,
    borderColor: "#EFE5FF",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIconWrap: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(11),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  infoText: {
    flex: 1,
    color: "#8479A9",
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.5,
  },
  heroIllustration: {
    width: responsiveWidth(200),
    height: responsiveHeight(326),
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroLockBadge: {
    position: "absolute",
    right: moderateScale(10),
    bottom: moderateScale(8),
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: "#FF9E2B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  footerWaves: {
    height: moderateScale(86),
    marginTop: "auto",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  waveBack: {
    position: "absolute",
    left: -moderateScale(40),
    right: moderateScale(34),
    bottom: moderateScale(8),
    height: moderateScale(44),
    borderTopLeftRadius: moderateScale(80),
    borderTopRightRadius: moderateScale(80),
    backgroundColor: "rgba(183, 151, 255, 0.16)",
  },
  waveFront: {
    position: "absolute",
    left: moderateScale(34),
    right: -moderateScale(30),
    bottom: 0,
    height: moderateScale(52),
    borderTopLeftRadius: moderateScale(90),
    borderTopRightRadius: moderateScale(90),
    backgroundColor: "rgba(212, 192, 255, 0.25)",
  },
});
