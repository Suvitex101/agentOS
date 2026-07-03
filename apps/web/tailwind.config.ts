import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        clay: "#B85C38",
        leaf: "#2F7D57",
      },
    },
  },
  plugins: [],
};

export default config;
