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
      borderRadius: { card: '18px', sheet: '26px', chip: '999px', control: '12px' },
      boxShadow: {
        // Tinted with the ink hue, layered ambient + contact for soft depth.
        card: '0 1px 2px rgb(110 85 68 / 0.05), 0 3px 10px rgb(110 85 68 / 0.07)',
        lift: '0 2px 6px rgb(110 85 68 / 0.07), 0 14px 36px rgb(110 85 68 / 0.16)',
        inset: 'inset 0 0 0 1px rgb(110 85 68 / 0.06)',
        // Hairline ring for borderless cards — softer than a hard 1px border.
        hair: '0 0 0 1px rgb(110 85 68 / 0.07)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        // Display + title carry negative tracking for editorial presence; small
        // labels carry positive tracking. The serif face is opted in via `font-serif`.
        display: ['30px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '600' }],
        title: ['22px', { lineHeight: '27px', letterSpacing: '-0.015em', fontWeight: '600' }],
        heading: ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['16px', { lineHeight: '25px', fontWeight: '400' }],
        label: ['14px', { lineHeight: '20px', fontWeight: '500' }],
        caption: ['13px', { lineHeight: '18px', fontWeight: '500' }],
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      backgroundImage: {
        // Warm editorial cover: layered radial highlights over the brand
        // diagonal for depth instead of a single flat 45° fade.
        'cover-gradient':
          'radial-gradient(125% 125% at 0% 0%, #F7D292 0%, rgb(247 210 146 / 0) 55%), radial-gradient(125% 125% at 100% 100%, #E54A2B 0%, rgb(229 74 43 / 0) 60%), linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%)',
        // Soft diagonal stripes for the no-photo card placeholder (tone-on-tone ink over paper).
        'card-placeholder':
          'repeating-linear-gradient(135deg, rgb(110 85 68 / 0.05) 0px, rgb(110 85 68 / 0.05) 10px, rgb(110 85 68 / 0.11) 10px, rgb(110 85 68 / 0.11) 20px)',
      },
    },
  },
  plugins: [],
};

export default config;
