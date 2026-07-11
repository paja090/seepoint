import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0B5FFF',
          50: '#eef4ff',
          100: '#d9e6ff',
          600: '#0B5FFF',
          700: '#0a4fd6',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(15,23,42,0.12)',
        lift: '0 2px 4px rgba(15,23,42,0.04), 0 24px 48px -20px rgba(11,95,255,0.25)',
      },
    },
  },
  plugins: [],
};
export default config;
