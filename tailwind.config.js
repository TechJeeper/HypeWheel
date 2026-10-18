/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./privacy.html", "./404.html", "./js/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["system-ui", "-apple-system", "sans-serif"] },
    },
  },
};
