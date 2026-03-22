import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          200: '#bcddff',
          300: '#8ec8ff',
          400: '#59a8ff',
          500: '#3385ff',
          600: '#1a65f5',
          700: '#1350e1',
          800: '#1641b6',
          900: '#183a8f',
        },
        win: '#22c55e',
        lose: '#ef4444',
        surface: {
          0: '#0a0e17',
          1: '#111827',
          2: '#1f2937',
          3: '#374151',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
