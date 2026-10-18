/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 18/10/2026: cores do painel SoftSystem (laranja de destaque + azul-marinho), para o app embutido combinar
        brand: {
          50:  '#fff4ec', 100: '#ffe4d1', 200: '#ffc7a3', 300: '#ffa46e', 400: '#ff8a3d', 500: '#f7941d',
          600: '#f26b21', 700: '#c2470c', 800: '#9a3a0e', 900: '#7a2f10', 950: '#431507',
        },
        slate: {
          50:  '#f5f8ff', 100: '#eef3fc', 200: '#d6e0f2', 300: '#b4c3e3', 400: '#8fa4d6', 500: '#5b6f9a',
          600: '#3d5182', 700: '#22386b', 800: '#14306f', 900: '#0e2154', 950: '#0a1a44',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
