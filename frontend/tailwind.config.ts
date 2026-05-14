import type { Config } from "tailwindcss";
import { themeColors } from "./src/lib/themeColors";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        coral: {
          DEFAULT: "hsl(var(--coral))",
          foreground: "hsl(var(--coral-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Brand Colors
        brand: {
          blue: themeColors.blue.primary,
          "blue-light": themeColors.blue.light,
          "blue-lighter": themeColors.blue.lighter,
          "blue-dark": themeColors.blue.dark,
          "blue-darker": themeColors.blue.darker,
          green: themeColors.green.primary,
          "green-light": themeColors.green.light,
          "green-lighter": themeColors.green.lighter,
          "green-dark": themeColors.green.dark,
          "green-darker": themeColors.green.darker,
          orange: themeColors.orange.primary,
          "orange-light": themeColors.orange.light,
          "orange-lighter": themeColors.orange.lighter,
          "orange-dark": themeColors.orange.dark,
          "orange-darker": themeColors.orange.darker,
        },
        // Status Colors
        success: themeColors.success,
        warning: themeColors.warning,
        error: themeColors.error,
        info: themeColors.info,
        // Neutral Grays
        neutral: {
          white: themeColors.neutral.white,
          black: themeColors.neutral.black,
          50: themeColors.neutral[50],
          100: themeColors.neutral[100],
          200: themeColors.neutral[200],
          300: themeColors.neutral[300],
          400: themeColors.neutral[400],
          500: themeColors.neutral[500],
          600: themeColors.neutral[600],
          700: themeColors.neutral[700],
          800: themeColors.neutral[800],
          900: themeColors.neutral[900],
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
