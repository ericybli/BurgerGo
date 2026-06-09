/**
 * Shared DOM builder for one map pin (Atlas style) — used by BOTH map
 * providers so Google and Mapbox render identical pins: white disc with a
 * 2px day-color ring and category glyph, a corner stop-number badge for day
 * stops, and a time chip below the disc when the stop is scheduled.
 *
 * The element itself is a 0×0 anchor point (so the engine places the
 * geographic coordinate exactly at the origin regardless of how/when it
 * measures the node — this is what keeps the pin from drifting as you zoom).
 * The visible disc is an absolutely-positioned child centred on that origin
 * via `translate(-50%,-50%)`, so the disc centre always sits on the coordinate.
 */
import type { PlaceMarker } from '@/src/lib/map/markers';

const SAVED_COLOR = '#33677A';

export function createMarkerEl(m: PlaceMarker, onClick: (id: string) => void): HTMLButtonElement {
  const isDay = m.label != null;
  const tone = m.color ?? SAVED_COLOR;
  const size = isDay ? 34 : 28;

  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', m.name);
  el.style.cssText = 'position:relative;width:0;height:0;padding:0;border:0;background:none;cursor:pointer';

  // Atlas pin: white disc, 2px day-color ring, category glyph centered.
  const disc = document.createElement('span');
  disc.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'transform:translate(-50%,-50%)',
    'box-sizing:border-box',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    `border:2px solid ${tone}`,
    'border-radius:9999px',
    'box-shadow:0 2px 6px rgba(27,31,28,0.18)',
    'line-height:1',
    `width:${size}px`,
    `height:${size}px`,
    'background-color:#fff',
    `color:${tone}`,
  ].join(';');

  const glyph = document.createElement('span');
  glyph.textContent = m.glyph;
  glyph.setAttribute('aria-hidden', 'true');
  glyph.style.cssText = 'pointer-events:none;font-size:15px;line-height:1';
  disc.appendChild(glyph);

  if (isDay) {
    // Stop-number badge: day-color disc, white number, white ring.
    const badge = document.createElement('span');
    badge.textContent = m.label;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = [
      'position:absolute',
      'top:-6px',
      'right:-6px',
      'min-width:16px',
      'height:16px',
      'padding:0 4px',
      'box-sizing:border-box',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'border-radius:9999px',
      'border:1.5px solid #fff',
      `background:${tone}`,
      'color:#fff',
      'font-size:9.5px',
      'font-weight:700',
      'line-height:1',
    ].join(';');
    disc.appendChild(badge);
  }

  el.appendChild(disc);

  if (isDay && m.scheduledTime) {
    // Time chip under the pin: white pill, hairline border, tabular ink digits.
    const time = document.createElement('span');
    time.textContent = m.scheduledTime;
    time.setAttribute('aria-hidden', 'true');
    time.style.cssText = [
      'position:absolute',
      `top:${size / 2 + 3}px`,
      'left:0',
      'transform:translateX(-50%)',
      'padding:1px 6px',
      'border-radius:6px',
      'border:1px solid #E9EBE6',
      'background:#fff',
      'color:#1B1F1C',
      'font-size:10px',
      'font-weight:700',
      'font-variant-numeric:tabular-nums',
      'line-height:1.2',
      'white-space:nowrap',
      'box-shadow:0 1px 3px rgba(27,31,28,0.12)',
    ].join(';');
    el.appendChild(time);
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(m.id);
  });
  return el;
}
