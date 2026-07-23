import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F1EDE1",
        ink: "#20201C",
        gochujang: "#B5342A",
        indigo: "#233A5E",
        mustard: "#C79A2E",
        celadon: "#5C7B6E",
      },
    },
  },
  plugins: [],
};
export default config;
