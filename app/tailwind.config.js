/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef4ff', 100: '#dbe6ff', 200: '#bccffe', 300: '#8fadfc',
          400: '#5b82f8', 500: '#3b62f0', 600: '#2546e0', 700: '#1f37c4',
          800: '#1f31a0', 900: '#1f2f7e', 950: '#161e4c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
