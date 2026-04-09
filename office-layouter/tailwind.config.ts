import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#edf2f7',
        panel: '#f8fafc',
        ink: '#0f172a',
        accent: '#0f766e',
        warning: '#d97706',
        danger: '#dc2626',
        ok: '#15803d'
      },
      boxShadow: {
        panel: '0 10px 30px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
} satisfies Config;
