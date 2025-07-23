import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        clay: '#A0522D',
        sand: '#DEB887',
        accent: '#9B59B6',
        neutral: {
          light: '#F5F5DC',
          DEFAULT: '#CFCFCF',
          dark: '#654321',
        },
      }
    }
  }
} satisfies Config 