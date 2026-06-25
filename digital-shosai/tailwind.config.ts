import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shelf: {
          bg: "#0f172a",
          panel: "#1e293b",
          accent: "#38bdf8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
