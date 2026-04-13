import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        terminal: ['var(--font-vt323)', '"Courier New"', 'monospace'],
        mono: ['var(--font-share-tech)', '"Courier New"', 'monospace'],
      },
      animation: {
        'flicker': 'flicker 8s linear infinite',
        'led-pulse': 'ledPulse 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'scanIn': 'scanIn 0.4s ease-out forwards',
        'fadeIn': 'fadeIn 0.6s ease-out forwards',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        flicker: {
          '0%, 18%, 22%, 25%, 53%, 57%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.92' },
        },
        ledPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.9)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        scanIn: {
          from: { clipPath: 'inset(0 0 100% 0)', opacity: '0' },
          to: { clipPath: 'inset(0 0 0% 0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow': '0 0 10px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)',
        'glow-sm': '0 0 6px var(--accent), 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent)',
        'inset-glow': 'inset 0 0 20px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
