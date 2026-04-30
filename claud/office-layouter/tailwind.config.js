/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        evalOk: "#16a34a",
        evalWarn: "#eab308",
        evalNg: "#dc2626",
      },
    },
  },
  plugins: [],
};
