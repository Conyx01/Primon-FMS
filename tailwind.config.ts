import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      colors: {
        primon: {
          50: "#F5F7FC",
          100: "#E9EDF8",
          200: "#C9D3EC",
          300: "#9FAEDC",
          400: "#6478BE",
          500: "#3E5399",
          600: "#2A3E7D",
          700: "#1F2F63",
          800: "#16224A",
          900: "#0E1733",
          950: "#090F24",
        },
        brass: {
          100: "#F5ECDA",
          200: "#EADCBC",
          300: "#D9BE8C",
          400: "#C3A46A",
          500: "#B08D57",
          600: "#96703F",
          700: "#7A5A32",
        },
        status: {
          compliant: "#1F7A4D",
          compliantTint: "#E7F5EC",
          critical: "#C0392B",
          criticalTint: "#FBEAE8",
          action: "#B7791F",
          actionTint: "#FBF1DE",
        },
        canvas: "#F7F8FB",
        border: "#E3E7F0",
        muted: "#667085",
        ink: "#101A33",
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 23, 51, 0.04)",
        elevated: "0 24px 64px -12px rgba(14, 23, 51, 0.22)",
        glow: "0 0 0 1px rgba(176, 141, 87, 0.25), 0 8px 30px -8px rgba(176, 141, 87, 0.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "reveal-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fill-bar": {
          "0%": { height: "0%" },
          "100%": { height: "var(--fill-to)" },
        },
        "border-beam": {
          "100%": { "offset-distance": "100%" },
        },
      },
      animation: {
        "reveal-up": "reveal-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fill-bar": "fill-bar 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
      },
    },
  },
  plugins: [],
};
export default config;
