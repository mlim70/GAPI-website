// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        clay: '#8B2635',
        sand: '#D4AF37',
        accent: '#9B59B6',
        neutral: {
          light: '#F5F5DC',
          DEFAULT: '#CFCFCF',
          dark: '#2D1810',
        },
      }
    }
  }
} satisfies Config 