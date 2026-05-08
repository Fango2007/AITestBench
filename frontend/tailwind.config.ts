import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          1: 'var(--paper-1)',
          2: 'var(--paper-2)',
          3: 'var(--paper-3)',
          7: 'var(--paper-7)'
        },
        ink: {
          3: 'var(--ink-3)',
          6: 'var(--ink-6)',
          9: 'var(--ink-9)'
        },
        gold: {
          1: 'var(--gold-1)',
          3: 'var(--gold-3)',
          5: 'var(--gold-5)'
        },
        ok: 'var(--ok)',
        danger: 'var(--danger)',
        pending: 'var(--pending)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        serif: ['var(--font-serif)']
      },
      borderRadius: {
        card: 'var(--r-card)',
        input: 'var(--r-input)',
        pill: 'var(--r-pill)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        drawer: 'var(--shadow-modal)'
      }
    }
  },
  plugins: []
} satisfies Config;
