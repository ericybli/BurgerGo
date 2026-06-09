import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateIcons } from './gen-icons';

const SOURCE = resolve(__dirname, '..', 'assets', 'burgergo-logo.png');
let outDir: string;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'burgergo-icons-'));
  await generateIcons({ source: SOURCE, publicDir: outDir });
});

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('generateIcons', () => {
  it('copies the served logo to <publicDir>/burgergo-logo.png', () => {
    expect(existsSync(join(outDir, 'burgergo-logo.png'))).toBe(true);
  });

  it.each([
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/maskable-192.png', 192],
    ['icons/maskable-512.png', 512],
    ['icons/apple-touch-icon.png', 180],
  ])('emits %s at %ipx square', async (rel, size) => {
    const file = join(outDir, rel);
    expect(existsSync(file)).toBe(true);
    const meta = await sharp(file).metadata();
    expect(meta.width).toBe(size);
    expect(meta.height).toBe(size);
    expect(meta.format).toBe('png');
  });

  it('renders maskable icons on the Cream safe-zone field (no full-bleed transparency)', async () => {
    // Maskable variants are flattened onto Atlas Cream #F7F1E4 so adaptive masks never clip the mascot.
    const { data, info } = await sharp(join(outDir, 'icons/maskable-512.png'))
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Sample the top-left corner pixel; it must be the opaque Cream field, not transparent.
    const channels = info.channels;
    const [r, g, b] = [data[0], data[1], data[2]];
    expect(r).toBe(0xf7);
    expect(g).toBe(0xf1);
    expect(b).toBe(0xe4);
    if (channels === 4) expect(data[3]).toBe(255);
  });
});
