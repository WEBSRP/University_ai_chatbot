import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        guRed: "#bc1820",
        guDeep: "#7f1118",
        guDark: "#111111",
        guGold: "#e47325"
      },
      fontFamily: {
        sans: ["Poppins", "Arial", "sans-serif"],
        mont: ["Montserrat", "Arial", "sans-serif"]
      },
      screens: {
        xs: "420px"
      }
    }
  },
  plugins: []
};

export default config;
