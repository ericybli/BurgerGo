import type { Config } from 'tailwindcss';

/**
 * Atlas Light design tokens (design handoff `design_handoff_atlas_light`).
 * White bg, near-black ink, hairline `line` borders instead of shadows.
 * Color discipline: `accent` (teal) = information/navigation; `orange` =
 * primary actions ("this creates or saves something"). Never swap the two.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Atlas Light canonical tokens ──
        bg: '#FFFFFF',
        surface: '#F4F5F2', // segmented track, icon-button bg, toolbar chips
        ink: { DEFAULT: '#1B1F1C', muted: '#6E746E', faint: '#A8ADA7' },
        sub: '#6E746E', // secondary text (addresses, dates, meta)
        faint: '#A8ADA7', // tertiary text, section labels, inactive tabs
        line: '#E9EBE6', // ALL borders/dividers (1px hairlines)
        accent: { DEFAULT: '#33677A', tint: '#E6EFF1' }, // teal: links/active/markers
        orange: { DEFAULT: '#E0502C', press: '#C84624', tint: 'rgb(224 80 44 / 0.10)' },
        cream: '#F7F1E4', // splash bg, link-card thumbnail bg (from logo)
        success: '#3E8E6E',
        danger: '#B3402C',
        // Per-day route/pin colors (Day 1–4, cycling) — also in src/lib/map/colors.ts.
        day: { 1: '#33677A', 2: '#C99231', 3: '#7A5FA0', 4: '#B3402C' },
      },
      borderRadius: { card: '14px', sheet: '22px', chip: '999px', control: '10px' },
      boxShadow: {
        // Atlas: no drop shadows on cards — hairline ring reads as a 1px border.
        card: '0 0 0 1px #E9EBE6',
        hair: '0 0 0 1px #E9EBE6',
        // Floating map-overlay controls / popovers.
        lift: '0 1px 4px rgb(27 31 28 / 0.12)',
        // Segmented-control active thumb.
        thumb: '0 1px 2px rgb(27 31 28 / 0.10), 0 0 0 1px rgb(27 31 28 / 0.04)',
        // Bottom sheets.
        sheet: '0 -12px 40px rgb(27 31 28 / 0.25)',
        // Orange FAB.
        fab: '0 10px 24px rgb(224 80 44 / 0.35)',
        inset: 'inset 0 0 0 1px rgb(27 31 28 / 0.06)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Atlas mobile scale (402px frame).
        display: ['23px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '800' }],
        title: ['19px', { lineHeight: '24px', letterSpacing: '-0.02em', fontWeight: '700' }],
        heading: ['15px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['13.5px', { lineHeight: '21px', fontWeight: '400' }],
        label: ['13px', { lineHeight: '18px', fontWeight: '600' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
        micro: ['10.5px', { lineHeight: '14px', letterSpacing: '0.1em', fontWeight: '700' }],
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
        // Atlas fallback cover (no photo): calm cream → teal-tint sweep.
        'cover-gradient': 'linear-gradient(135deg, #F7F1E4 0%, #EDF1EE 55%, #E6EFF1 100%)',
        // No-photo placeholder: tone-on-tone surface stripes (per mockups).
        'card-placeholder':
          'repeating-linear-gradient(135deg, #F4F5F2 0px, #F4F5F2 12px, #EDEFEA 12px, #EDEFEA 24px)',
      },
    },
  },
  plugins: [],
};

export default config;
