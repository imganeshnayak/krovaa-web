// Theme Colors - Centralized Color System
// Inspired by Paytm's design system (Light Theme)

export const themeColors = {
  blue: {
    primary: "#00A4EF", // Paytm Blue
    light: "#E6F6FE",   // Light blue for backgrounds/accents
    lighter: "#F0FAFF",
    dark: "#007BB5",
    darker: "#005580",
  },
  green: {
    primary: "#0FB881", // Success
    light: "#E7F8F2",
    lighter: "#F0FAF6",
    dark: "#0B8C62",
    darker: "#065E41",
  },
  orange: {
    primary: "#FF6B35", // Accent
    light: "#FFF0EB",
    lighter: "#FFF5F2",
    dark: "#C43E00",
    darker: "#8A2B00",
  },
  warning: "#FFA500",
  error:   "#E74C3C",
  white:   "#FFFFFF",
  black:   "#1C1C1C", // Dark Charcoal

  // Status Colors
  success: "#0FB881",
  info: "#00A4EF",

  // Neutral object to fix tailwind.config.ts and provide light mode grays
  neutral: {
    white: "#FFFFFF",
    black: "#1C1C1C",
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#EEEEEE",
    300: "#E0E0E0",
    400: "#BDBDBD",
    500: "#9E9E9E",
    600: "#757575",
    700: "#616161",
    800: "#424242",
    900: "#1C1C1C",
  },

  // Component-Specific Colors
  background: "#F5F5F5",
  foreground: "#1C1C1C",
  border: "#E0E0E0",
  card: "#FFFFFF",
  hover: "rgba(0, 164, 239, 0.05)", // Very subtle blue tint
};

export default themeColors;
