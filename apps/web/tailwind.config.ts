import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal:        '#03a5af',
          dark:        '#114252',
          deep:        '#195267',
          mid:         '#075865',
          charcoal:    '#2d2f39',
          gold:        '#eebb69',
          'light-gray': '#e8e7e7',
        },
      },
      fontFamily: {
        sans:    ['Outfit', 'sans-serif'],
        serif:   ['Bitter', 'serif'],
        display: ['"Playfair Display"', 'serif'],
      },
      borderRadius: {
        button: '16px',
        card:   '20px',
        pill:   '32px',
      },
    },
  },
  plugins: [],
} satisfies Config
