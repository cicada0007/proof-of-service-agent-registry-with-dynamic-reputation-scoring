import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        solana: {
          green: "#14F195",
          purple: "#a46bf5",
          navy: "#0f172a"
        }
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;


