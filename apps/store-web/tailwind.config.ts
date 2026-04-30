import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        royal: {
          navy: "#0F172A",
          navySoft: "#111827",
          gold: "#C89B3C",
          goldSoft: "#D6A64B",
          cream: "#F8F5EF",
          ink: "#1F2937"
        }
      },
      borderRadius: {
        xl2: "20px"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
