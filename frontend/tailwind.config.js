/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          canvas: "#FFFFFF",
          surface: "#F5F5F7",
          primary: "#111111",
          secondary: "#6E6E73",
        },
        accent: {
          pulse: "#0066FF",
          flare: "#FF6B00",
          warning: "#FFC700",
          alert: "#FF2A3A",
          success: "#24D366",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
