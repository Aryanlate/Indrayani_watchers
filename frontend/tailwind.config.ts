import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        deep: '#0B1220',
        'bg-deep': '#0B1220',
        surface: '#121C2E',
        card: '#121C2E',
        'surface-elevated': '#17243B',
        'surface-nested': '#0D1524',
        'surface-border': '#1E2C42',
        'border-card': '#1E2C42',
        water: '#22D3EE',
        'text-primary': '#E6EDF7',
        'text-muted': '#8A9BB4',
        // Water quality status colors
        'status-good': '#22C55E',
        'status-moderate': '#FDE047',
        'status-poor': '#F97316',
        'status-very-poor': '#EF4444',
        status: {
          good: '#22C55E',
          moderate: '#FDE047',
          poor: '#F97316',
          'very-poor': '#EF4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        control: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        cyanGlowPulse: {
          '0%': {
            borderColor: '#22D3EE',
            boxShadow: '0 0 0 1px #22D3EE, 0 0 12px rgba(34, 211, 238, 0.25)',
          },
          '100%': {
            borderColor: '#1E2C42',
            boxShadow: 'none',
          },
        },
      },
      animation: {
        'pulse-cyan': 'cyanGlowPulse 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
