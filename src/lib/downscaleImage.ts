/**
 * Client-only: load an image File, downscale it so its longest edge is <= maxPx,
 * and return a JPEG data URL. Keeps the AI-import payload small (full-res phone
 * screenshots are multi-MB; a 1024px JPEG is ~100–200 KB). Falls back to the raw
 * file bytes if the canvas path is unavailable.
 */
export async function downscaleImageToDataUrl(
  file: File,
  maxPx = 1024,
  quality = 0.7,
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const longest = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const scale = longest > 0 ? Math.min(1, maxPx / longest) : 1;
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return await fileToDataUrl(file);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return fileToDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}
