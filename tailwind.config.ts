import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gas: {
          50: "#E8F0F7",
          100: "#C5D9E9",
          200: "#9EBAD8",
          300: "#749BC6",
          400: "#5382B8",
          500: "#123A5A",
          600: "#0F3150",
          700: "#0C2845",
          800: "#091F3A",
          900: "#061628",
        },
        flame: {
          50: "#FEF3E7",
          100: "#FDE0C3",
          200: "#FBCB9B",
          300: "#F9B573",
          400: "#F7A04B",
          500: "#F28C28",
          600: "#D97823",
          700: "#C0641E",
          800: "#A75019",
          900: "#8E3C14",
        },
        steel: {
          50: "#F0F1F3",
          100: "#D9DBDF",
          200: "#BFC2C9",
          300: "#A5A9B3",
          400: "#8B909D",
          500: "#4B5563",
          600: "#3D4552",
          700: "#2F3641",
          800: "#212730",
          900: "#13181F",
        },
        surface: {
          DEFAULT: "#FAFAF7",
          dark: "#F3F4F6",
        },
      },
      boxShadow: {
        skeu: `6px 6px 14px rgba(0,0,0,0.15), -6px -6px 14px rgba(255,255,255,0.8)`,
        "skeu-sm": `3px 3px 8px rgba(0,0,0,0.12), -3px -3px 8px rgba(255,255,255,0.7)`,
        "skeu-inset": `inset 3px 3px 8px rgba(0,0,0,0.12), inset -3px -3px 8px rgba(255,255,255,0.7)`,
        "skeu-btn": `3px 3px 6px rgba(0,0,0,0.2), -3px -3px 6px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.15)`,
        "skeu-pressed": `inset 2px 2px 5px rgba(0,0,0,0.2), inset -1px -1px 3px rgba(255,255,255,0.1)`,
      },
      backgroundImage: {
        "skeu-raised": "linear-gradient(145deg, #ffffff, #d9dde3)",
        "skeu-pressed": "linear-gradient(145deg, #d9dde3, #ffffff)",
        "skeu-input": "linear-gradient(135deg, #e8ecf1, #ffffff)",
        "gas-gradient": "linear-gradient(135deg, #123A5A, #0F3150)",
      },
      fontFamily: {
        display: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
