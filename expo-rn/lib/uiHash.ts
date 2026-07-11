/** Deterministic warm-gradient pair from any string (used as a photo-less card band). */
const WARM: [string, string][] = [
  ['#E8A15C', '#B5542F'], ['#7FA07A', '#3F6B52'], ['#D6B78C', '#9A6B45'],
  ['#C98A6B', '#8A4A38'], ['#9AA98F', '#5E7454'], ['#D9A24E', '#A66A2E'],
];

/** Stable warm 2-stop gradient for a seed (e.g. a name/title). Same seed → same colors. */
export function gradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return WARM[Math.abs(h) % WARM.length]!;
}
