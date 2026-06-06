import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, 'manifest.webmanifest'), 'utf8'),
);

describe('manifest.webmanifest', () => {
  it('declares the BurgerGo identity and standalone chrome', () => {
    expect(manifest.name).toBe('BurgerGo');
    expect(manifest.short_name).toBe('BurgerGo');
    expect(manifest.description).toBe('Your personal travel-planning assistant.');
    // Member URLs are RELATIVE so they resolve against the manifest's own
    // location under any deploy sub-path (works at root and under /burgergo).
    expect(manifest.start_url).toBe('.?source=pwa');
    expect(manifest.scope).toBe('.');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.lang).toBe('en');
    expect(manifest.dir).toBe('ltr');
  });

  it('uses the Sunset Wanderer splash + theme colors', () => {
    expect(manifest.background_color).toBe('#F5EEE1'); // Paper
    expect(manifest.theme_color).toBe('#EE5B3C'); // Coral
  });

  it('lists the generated icon set with any + maskable purposes (relative src)', () => {
    // Relative `src` (no leading slash) resolves against the manifest dir, so the
    // icons load correctly whether deployed at root or under a sub-path.
    expect(manifest.icons).toEqual([
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ]);
  });
});
