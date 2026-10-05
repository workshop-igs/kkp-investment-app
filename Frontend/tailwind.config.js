/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Public Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        kkp: {
          900: '#002242',
          800: '#004584',
          700: '#0056A5',
          500: '#0d6efd',
          200: '#99bbdb',
          100: '#e7effa',
          hijau: '#8CC63F',
          toska: '#40BFDB',
          bg: '#F8F8FB',
          text: '#495057',
        },
        ocean: {
          900: '#050e1f',
          800: '#0A1C35',
          700: '#0e2647',
          600: '#1a4070',
        },
        azure: {
          500: '#0ea5e9',
          400: '#38bdf8',
        },
        lime: {
          400: '#a3e635',
          300: '#bef264',
        },
        gold: {
          500: '#f59e0b',
          400: '#fbbf24',
        }
      }
    },
  },
  plugins: [],
}
