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
        red: '#d33b41',
        gold: '#D4AF37',
        purple: '#9B59B6',
        neutral: {
          light: '#F5F5DC',
          DEFAULT: '#CFCFCF',
          dark: '#2D1810',
        },
      }
    }
  }
} satisfies Config 