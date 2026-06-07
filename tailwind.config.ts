import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        coral: { DEFAULT: '#EE5B3C', press: '#D94E30', tint: 'rgb(238 91 60 / 0.12)' },
        teal: { DEFAULT: '#4F8A86', tint: 'rgb(79 138 134 / 0.14)' },
        ink: { DEFAULT: '#6E5544', muted: 'rgb(110 85 68 / 0.64)', faint: 'rgb(110 85 68 / 0.38)' },
        paper: '#F5EEE1',
        card: '#FBF7EF',
        sun: { DEFAULT: '#F2C879', tint: 'rgb(242 200 121 / 0.22)' },
        line: 'rgb(110 85 68 / 0.12)',
        success: '#3E8E6E',
        danger: '#C2452E',
      },
      borderRadius: { card: '16px', sheet: '24px', chip: '999px', control: '12px' },
      boxShadow: {
        card: '0 2px 8px rgb(110 85 68 / 0.08)',
        lift: '0 8px 24px rgb(110 85 68 / 0.14)',
        inset: 'inset 0 0 0 1px rgb(110 85 68 / 0.06)',
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '700' }],
        title: ['22px', { lineHeight: '28px', fontWeight: '700' }],
        heading: ['18px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        label: ['14px', { lineHeight: '20px', fontWeight: '500' }],
        caption: ['13px', { lineHeight: '18px', fontWeight: '500' }],
        micro: ['11px', { lineHeight: '14px', fontWeight: '600' }],
      },
      backgroundImage: {
        'cover-gradient': 'linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%)',
        // Soft diagonal stripes for the no-photo card placeholder (tone-on-tone ink over paper).
        'card-placeholder':
          'repeating-linear-gradient(135deg, rgb(110 85 68 / 0.05) 0px, rgb(110 85 68 / 0.05) 10px, rgb(110 85 68 / 0.11) 10px, rgb(110 85 68 / 0.11) 20px)',
      },
    },
  },
  plugins: [],
};

export default config;
