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
        'card':      '0 1px 3px rgba(17,66,82,0.04), 0 4px 20px -4px rgba(17,66,82,0.07)',
        'card-hover':'0 4px 20px -4px rgba(3,165,175,0.14), 0 12px 32px -8px rgba(17,66,82,0.10)',
        'soft':      '0 1px 2px rgba(17,66,82,0.04), 0 2px 8px -2px rgba(17,66,82,0.06)',
        'stat-dark': '0 10px 34px -6px rgba(17,66,82,0.40)',
        'stat-teal': '0 10px 34px -6px rgba(3,165,175,0.32)',
        'stat-gold': '0 10px 34px -6px rgba(238,187,105,0.30)',
      },
      backgroundImage: {
        'app':       'radial-gradient(1200px 600px at 100% -10%, rgba(3,165,175,0.06), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(238,187,105,0.05), transparent 55%)',
        'stat-dark': 'linear-gradient(150deg, #195267 0%, #114252 55%, #0d3340 100%)',
        'login':     'radial-gradient(900px 500px at 50% -10%, rgba(3,165,175,0.18), transparent 60%), radial-gradient(700px 500px at 10% 110%, rgba(238,187,105,0.10), transparent 55%)',
      },
    },
  },
  plugins: [],
} satisfies Config
