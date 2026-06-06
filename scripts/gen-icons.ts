import { mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PAPER = { r: 0xf5, g: 0xee, b: 0xe1, alpha: 1 }; // #F5EEE1

export interface GenerateIconsOptions {
  /** Source logo (the high-res original). */
  source: string;
  /** Output public dir root; files land at <publicDir>/burgergo-logo.png and <publicDir>/icons/*. */
  publicDir: string;
}

/** Render the logo centered onto a square Paper field at `size`px. `inset` shrinks it for maskable safe-zone. */
async function renderIcon(source: string, size: number, inset: number): Promise<Buffer> {
  const logoSize = Math.round(size * inset);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: PAPER },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

export async function generateIcons(opts: GenerateIconsOptions): Promise<void> {
  const { source, publicDir } = opts;
  if (!existsSync(source)) {
    throw new Error(`gen-icons: source logo not found at "${source}". Add assets/burgergo-logo.png before building.`);
  }
  const iconsDir = join(publicDir, 'icons');
  await mkdir(iconsDir, { recursive: true });

  // Served mascot art (also referenced by the SW CacheFirst rule and EmptyState).
  await copyFile(source, join(publicDir, 'burgergo-logo.png'));

  // "any" icons: logo fills most of the field (92%).
  const any = 0.92;
  // "maskable" icons: logo lives in the ~80% safe zone so Android masks never clip the mascot.
  const safe = 0.66;

  await Promise.all([
    renderIcon(source, 192, any).then((b) => sharp(b).toFile(join(iconsDir, 'icon-192.png'))),
    renderIcon(source, 512, any).then((b) => sharp(b).toFile(join(iconsDir, 'icon-512.png'))),
    renderIcon(source, 192, safe).then((b) => sharp(b).toFile(join(iconsDir, 'maskable-192.png'))),
    renderIcon(source, 512, safe).then((b) => sharp(b).toFile(join(iconsDir, 'maskable-512.png'))),
    renderIcon(source, 180, any).then((b) => sharp(b).toFile(join(iconsDir, 'apple-touch-icon.png'))),
  ]);
}

// CLI entrypoint: `node scripts/gen-icons.js` / `tsx scripts/gen-icons.ts`.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  generateIcons({
    source: join(root, 'assets', 'burgergo-logo.png'),
    publicDir: join(root, 'public'),
  })
    .then(() => console.log('gen-icons: wrote public/burgergo-logo.png + public/icons/*'))
    .catch((err) => {
      console.error('gen-icons failed:', err);
      process.exit(1);
    });
}
