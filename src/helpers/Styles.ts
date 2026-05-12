import { StyleSheet } from "react-native";
import { DimensionHelper } from "./DimensionHelper";
import { StyleConstants } from "./StyleConstants";
import { Branding } from "../branding";

// rgb tuple from "#RRGGBB" so partners only define a primary color, not its 4 overlay tints.
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

const brand = Branding.colors;

// Centralized color palette for consistency. Brand-tinted values come from branding.json.
export const Colors = {
  // Brand colors
  primary: brand.primary,
  primaryLight: brand.primaryLight,
  primaryDark: brand.primaryDark,

  // Background colors
  background: brand.background,
  backgroundDark: brand.backgroundDark,
  backgroundCard: brand.backgroundCard,
  surface: brand.surface,
  surfaceDark: brand.surfaceDark,
  navBackground: brand.navBackground,
  inputBackground: brand.inputBackground,

  // Text colors
  textPrimary: "#FFFFFF",
  textSecondary: "#94a3b8",
  textMuted: "#777777",
  textInput: "#e6eef8",

  // State colors (derived from primary so partners don't tune 4 alphas per fork)
  activeBackground: rgba(brand.primary, 0.12),
  hoverBackground: rgba(brand.primary, 0.08),
  focusBackground: "rgba(255,255,255,0.03)",
  pressedBackground: rgba(brand.primary, 0.8),

  // Border colors
  borderSubtle: "rgba(255,255,255,0.06)",
  borderAccent: rgba(brand.primary, 0.15),

  // Status colors
  success: "#4CAF50",
  error: "#ff6b6b",
  disabled: "#999999",

  // Additional text colors
  textLight: "#CCCCCC",
  textDimmed: "rgba(255,255,255,0.4)",
  textSubtle: "rgba(255,255,255,0.7)",

  // Additional background colors
  progressBackground: "#666666",

  // Misc
  inactive: "#767577"
};

// Spacing scale. Use these tokens instead of hardcoded paddings/margins.
// Values are in DP and chosen for 10-foot legibility.
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64
};

// 10-foot type scale. Values are sized for couch viewing on a TV.
// `labelSmall` is the readability floor — never use a fontSize below this.
export const Typography = {
  displayHero: DimensionHelper.wp("15%"),    // splash / oversized hero text
  displayCode: DimensionHelper.wp("7%"),     // primary pairing code character
  displayCodeSm: DimensionHelper.wp("5%"),   // secondary code character / very large body
  heading1: DimensionHelper.hp("4.5%"),      // H1
  heading2: DimensionHelper.wp("3.5%"),      // H2 / page titles
  heading3: DimensionHelper.wp("3%"),        // H3
  titleLarge: DimensionHelper.wp("2.5%"),    // section / dialog titles
  bodyLarge: DimensionHelper.wp("2%"),       // primary body
  bodyMedium: DimensionHelper.wp("1.8%"),    // secondary body
  bodySmall: DimensionHelper.wp("1.6%"),     // helper / supporting text
  labelLarge: DimensionHelper.wp("1.5%"),    // list-item titles
  labelMedium: DimensionHelper.wp("1.4%"),   // captions, nav items
  labelSmall: DimensionHelper.wp("1.2%")     // readability FLOOR — do not go below
};

export const Styles = StyleSheet.create({
  //Splash
  splashMaincontainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    backgroundColor: Colors.backgroundDark
  },
  splashImage: { maxWidth: DimensionHelper.wp("70%"), alignSelf: "center" },

  maincontainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    backgroundColor: Colors.backgroundDark
  },

  H1: {
    color: Colors.textPrimary,
    fontSize: Typography.heading1,
    fontFamily: StyleConstants.RobotoBold,
    letterSpacing: 0.5
  },
  H2: {
    color: Colors.textPrimary,
    fontSize: Typography.heading2,
    fontFamily: StyleConstants.RobotoBold,
    letterSpacing: 0.3
  },
  H3: {
    color: Colors.textPrimary,
    fontSize: Typography.heading3,
    fontFamily: StyleConstants.RobotoRegular,
    letterSpacing: 0.2
  },

  messageImage: { maxWidth: DimensionHelper.wp("40%"), alignSelf: "center" },
  bigWhiteText: {
    color: Colors.textPrimary,
    fontSize: Typography.displayCodeSm,
    textAlign: "center",
    letterSpacing: 0.3
  },
  giantWhiteText: {
    color: Colors.textPrimary,
    fontSize: Typography.displayHero,
    textAlign: "center"
  },
  whiteText: {
    color: Colors.textPrimary,
    fontSize: Typography.heading3,
    textAlign: "center"
  },
  smallWhiteText: {
    color: Colors.textPrimary,
    fontSize: Typography.bodyLarge,
    textAlign: "center"
  },
  smallerWhiteText: {
    color: Colors.textSecondary,
    fontSize: Typography.labelLarge
  },

  // Menu / Navigation
  menuScreen: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
    flex: 1,
    backgroundColor: Colors.background,
    width: "100%"
  },

  menuHeader: {
    height: DimensionHelper.hp("9%"),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    paddingHorizontal: DimensionHelper.wp("2.5%"),
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderAccent
  },

  menuFooter: {
    height: DimensionHelper.hp("8%"),
    flexDirection: "column",
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceDark,
    padding: 12
  },
  menuWrapper: {
    flex: 1,
    width: "100%",
    paddingVertical: DimensionHelper.hp("1.5%"),
    paddingHorizontal: DimensionHelper.wp("1%")
  },
  menuList: { flex: 1, alignItems: "flex-start", justifyContent: "flex-start" },

  // menu item used as a row
  menuClickable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    height: DimensionHelper.hp("8%"),
    paddingHorizontal: DimensionHelper.wp("3%"),
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle
  },

  smallMenuClickable: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: DimensionHelper.hp("6%"),
    justifyContent: "flex-start",
    paddingHorizontal: DimensionHelper.wp("3%"),
    borderRadius: 8,
    fontFamily: StyleConstants.RobotoBold
  },

  // Input styles
  textInputStyle: {
    alignSelf: "center",
    width: DimensionHelper.wp("86%"),
    maxWidth: 900,
    fontSize: DimensionHelper.wp("2.6%"),
    backgroundColor: Colors.inputBackground,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    color: Colors.textInput,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2
  },
  textInputStyleFocus: {
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowOpacity: 0.4,
    elevation: 6
  },

  // Sidebar accents
  navAccent: { backgroundColor: Colors.navBackground },
  navItemActiveBackground: {
    backgroundColor: Colors.activeBackground,
    borderRadius: 8
  },
  navItemFocusBackground: {
    backgroundColor: Colors.focusBackground,
    borderRadius: 8
  },

  // Card styles (shared)
  card: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.backgroundCard
  },
  cardFocused: {
    borderWidth: 2,
    borderColor: Colors.primary,
    transform: [{ scale: 1.02 }]
  }
});
