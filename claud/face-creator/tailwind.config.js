/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        winner: '#f59e0b',
        loser: '#ef4444',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #f59e0b, 0 0 10px #f59e0b' },
          '100%': { boxShadow: '0 0 15px #f59e0b, 0 0 30px #f59e0b, 0 0 45px #f59e0b' },
        },
      },
    },
  },
  plugins: [],
}
