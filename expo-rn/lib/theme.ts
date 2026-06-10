/**
 * Atlas Light design tokens, mirrored from the web app's tailwind.config.ts
 * (design handoff `design_handoff_atlas_light`). White bg, near-black ink,
 * hairline `line` borders instead of shadows. Color discipline: `accent`
 * (teal) = information/navigation; `orange` = primary actions ("this creates
 * or saves something"). Never swap the two.
 */
export const colors = {
  // ── Atlas Light canonical tokens ──
  bg: '#FFFFFF',
  surface: '#F4F5F2', // segmented track, icon-button bg, toolbar chips
  ink: '#1B1F1C',
  sub: '#6E746E', // secondary text (addresses, dates, meta)
  faint: '#A8ADA7', // tertiary text, section labels, inactive tabs
  line: '#E9EBE6', // ALL borders/dividers (1px hairlines)
  accent: '#33677A', // teal: links / active / info chips / nav
  accentTint: '#E6EFF1',
  orange: '#E0502C', // primary actions only (create/save)
  orangePress: '#C84624',
  orangeTint: 'rgba(224, 80, 44, 0.10)',
  cream: '#F7F1E4', // splash bg, link-card thumbnail bg (from logo)
  success: '#3E8E6E',
  danger: '#B3402C',
  white: '#FFFFFF',
  scrim: 'rgba(27, 31, 28, 0.42)', // sheet/select backdrops (web --scrim)

  // ── Legacy aliases (pre-Atlas screens; migrate to canonical names) ──
  coral: '#E0502C',
  coralPress: '#C84624',
  teal: '#33677A',
  inkMuted: '#6E746E',
  paper: '#F4F5F2',
  card: '#FFFFFF',
};

/** Per-day route/pin colors (Day 1–4, cycling) — same as web src/lib/map/colors.ts. */
export const DAY_COLORS = ['#33677A', '#C99231', '#7A5FA0', '#B3402C'] as const;

/** 1-based day number → its color (cycles past day 4). */
export const dayColor = (dayNumber: number): string =>
  DAY_COLORS[(((dayNumber - 1) % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length]!;

/**
 * Instrument Sans (loaded in App.tsx via @expo-google-fonts). RN custom fonts
 * don't synthesize weights — always pair fontFamily with these names instead
 * of fontWeight.
 */
export const font = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
};

/** Atlas mobile type scale (web tailwind fontSize), as RN style fragments. */
export const type = {
  display: { fontFamily: font.bold, fontSize: 23, lineHeight: 28, letterSpacing: -0.46 },
  title: { fontFamily: font.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.38 },
  heading: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 },
  body: { fontFamily: font.regular, fontSize: 13.5, lineHeight: 21 },
  label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: font.bold, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.05 },
} as const;

/** Atlas radii (web borderRadius tokens). */
export const radius = {
  card: 14,
  sheet: 22,
  chip: 999,
  control: 10,
};

const GLYPH: Record<string, string> = {
  sightseeing: '🏞️',
  lodging: '🛏️',
  hotel: '🏨',
  airbnb: '🏠',
  airport: '✈️',
  transport: '🚆',
  activity: '🎟️',
  shopping: '🛍️',
  parking: '🅿️',
  entrance: '🚪',
  museum: '🏛️',
  event: '🎉',
  other: '📍',
};

export const glyph = (category: string): string => GLYPH[category] ?? '📍';

export const CATEGORIES = [
  'sightseeing', 'lodging', 'hotel', 'airbnb', 'airport', 'transport',
  'activity', 'shopping', 'parking', 'entrance', 'museum', 'event', 'other',
] as const;
