import type { Config } from 'tailwindcss'
import daisyui from 'daisyui'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#d4a853',
        'navy-dark': '#0f172a',
        'navy-light': '#1a2541',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        sinui: {
          primary: '#d4a853',
          secondary: '#7c2d3e',
          accent: '#047857',
          neutral: '#0f172a',
          'base-100': '#0f172a',
          'base-200': '#1a2541',
          'base-300': '#243558',
          info: '#3b82f6',
          success: '#047857',
          warning: '#f59e0b',
          error: '#7c2d3e',
        },
      },
    ],
  },
} satisfies Config
