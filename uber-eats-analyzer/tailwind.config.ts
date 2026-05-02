import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#0b1220',
        panel: '#111a2e',
        panel2: '#162038',
        ink: '#e6edf6',
        muted: '#8b97ad',
        border: '#1f2a44',
        accent: '#10b981',
        accent2: '#34d399',
        warn: '#f59e0b',
        danger: '#ef4444',
        ok: '#22c55e',
      },
      fontFamily: {
        num: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 8px 24px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;
