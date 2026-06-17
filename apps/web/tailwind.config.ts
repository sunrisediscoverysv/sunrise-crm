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
      boxShadow: {
        'card':      '0 1px 3px rgba(0,0,0,0.04), 0 4px 20px -4px rgba(0,0,0,0.07)',
        'card-hover':'0 4px 20px -4px rgba(3,165,175,0.14), 0 8px 28px -8px rgba(0,0,0,0.07)',
        'stat-dark': '0 8px 32px -4px rgba(17,66,82,0.35)',
        'stat-teal': '0 8px 32px -4px rgba(3,165,175,0.25)',
        'stat-gold': '0 8px 32px -4px rgba(238,187,105,0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config
