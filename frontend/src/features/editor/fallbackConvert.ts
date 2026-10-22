// Conversión imagen -> patrón EN EL NAVEGADOR.
// Respaldo de emergencia: el flujo intenta primero POST /api/patterns/convert
// y solo cae aquí si la API falla (la UI muestra un aviso visible).
import type { ConvertOptions, PaletteColor, PatternData } from "../../api/types";
import { fallbackPaletteFor } from "./fallbackPalette";
import { colorDistance, hexToRgb, nearestColorIndex, rgbToHex } from "./patternUtils";

type RGB = [number, number, number];

const SIMPLIFY_FACTOR = [1, 0.8, 0.6, 0.42];

export async function convertImageLocally(file: Blob, opts: ConvertOptions): Promise<PatternData> {
  const bitmap = await createImageBitmap(file);
  try {
    const width = Math.max(4, Math.min(128, Math.round(opts.width)));
    const height = Math.max(1, Math.min(128, Math.round((width * bitmap.height) / bitmap.width)));
    const pixels = rasterize(bitmap, width, height, opts.simplify);

    if (opts.remove_background) removeBackground(pixels, width, height);

    const keep: number[] = [];
    for (let i = 0; i < width * height; i++) if (pixels[i * 4 + 3] > 32) keep.push(i);

    const palette = fallbackPaletteFor(opts.craft);
    const targetColors = Math.max(2, Math.min(64, Math.round(opts.max_colors * SIMPLIFY_FACTOR[opts.simplify])));
    const centroids = medianCut(pixels, keep, targetColors);

    // Centroide -> color real más cercano de la paleta del fabricante.
    const mappedPalette: PaletteColor[] = [];
    const centroidToPalette: number[] = centroids.map((rgb) => {
      const idx = nearestColorIndex(palette, rgb);
      const color = palette[idx];
      let existing = mappedPalette.findIndex((c) => c.id === color.id);
      if (existing < 0) {
        mappedPalette.push({ ...color });
        existing = mappedPalette.length - 1;
      }
      return existing;
    });

    const cells = new Array<number>(width * height).fill(-1);
    const centroidOf: number[] = new Array(width * height).fill(-1);
    for (let i = 0; i < width * height; i++) {
      if (pixels[i * 4 + 3] <= 32) continue;
      const rgb: RGB = [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]];
      const c = nearestCentroid(centroids, rgb, centroidOf[i] >= 0 ? centroidOf[i] : -1);
      centroidOf[i] = c;
      cells[i] = centroidToPalette[c];
    }

    if (opts.outline) applyOutline(cells, width, height, mappedPalette, opts.craft);

    return { craft: opts.craft, width, height, palette: mappedPalette, cells };
  } finally {
    bitmap.close?.();
  }
}

function rasterize(bitmap: ImageBitmap, width: number, height: number, simplify: number): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  // "Simplificar": media 3x3 repetida -> aspecto de dibujo con manchas planas.
  const passes = Math.min(3, Math.max(0, simplify));
  if (passes > 0) boxBlur(data, width, height, passes);
  return data;
}

function boxBlur(data: Uint8ClampedArray, width: number, height: number, passes: number) {
  const src = new Uint8ClampedArray(data);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            const i = (yy * width + xx) * 4;
            r += src[i];
            g += src[i + 1];
            b += src[i + 2];
            a += src[i + 3];
            n++;
          }
        }
        const o = (y * width + x) * 4;
        data[o] = r / n;
        data[o + 1] = g / n;
        data[o + 2] = b / n;
        data[o + 3] = a / n;
      }
    }
    src.set(data);
  }
}

/** Convierte en vacías las celdas conectadas al borde con color parecido al fondo. */
function removeBackground(data: Uint8ClampedArray, width: number, height: number) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] <= 16) return;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    sample(0, y);
    sample(width - 1, y);
  }
  if (!n) return;
  const bg: RGB = [r / n, g / n, b / n];
  const threshold = 44 * 44 * 3;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    if (visited[i]) continue;
    visited[i] = 1;
    const rgb: RGB = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    const alpha = data[i * 4 + 3];
    if (alpha > 32 && colorDistance(rgb, bg) > threshold) continue;
    data[i * 4 + 3] = 0;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }
}

/** Median cut: agrupa los píxeles en `k` colores dominantes. */
function medianCut(data: Uint8ClampedArray, indices: number[], k: number): RGB[] {
  if (!indices.length) return [];
  let boxes: number[][] = [indices];

  while (boxes.length < k) {
    const next: number[][] | null = splitLargest(boxes, data);
    if (!next) break;
    boxes = next;
  }
  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const i of box) {
      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
    }
    const n = box.length || 1;
    return [r / n, g / n, b / n] as RGB;
  });
}

function splitLargest(boxes: number[][], data: Uint8ClampedArray): number[][] | null {
  let best = -1;
  let bestRange = 0;
  let bestChannel = 0;
  boxes.forEach((box, bi) => {
    if (box.length < 2) return;
    const min: RGB = [255, 255, 255];
    const max: RGB = [0, 0, 0];
    for (const i of box) {
      for (let c = 0; c < 3; c++) {
        const v = data[i * 4 + c];
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
    }
    for (let c = 0; c < 3; c++) {
      const range = (max[c] - min[c]) * (c === 1 ? 1.1 : 1);
      if (range > bestRange) {
        bestRange = range;
        best = bi;
        bestChannel = c;
      }
    }
  });
  if (best < 0 || bestRange <= 0) return null;

  const box = [...boxes[best]].sort((a, b) => data[a * 4 + bestChannel] - data[b * 4 + bestChannel]);
  const mid = Math.floor(box.length / 2);
  const result = boxes.slice();
  result.splice(best, 1, box.slice(0, mid), box.slice(mid));
  return result;
}

function nearestCentroid(centroids: RGB[], rgb: RGB, hint: number): number {
  if (hint >= 0 && hint < centroids.length) {
    const d = colorDistance(rgb, centroids[hint]);
    if (d < 24 * 24) return hint;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = colorDistance(rgb, centroids[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Contorno oscuro estilo cartoon: celdas con vecino distinto se oscurecen. */
function applyOutline(cells: number[], width: number, height: number, palette: PaletteColor[], craft: PatternData["craft"]) {
  const inkHex = craft === "hama" ? "#1A1A1A" : "#000000";
  const ink = nearestColorIndex(fallbackPaletteFor(craft), hexToRgb(inkHex));
  const inkColor = { ...fallbackPaletteFor(craft)[ink] };
  let inkIndex = palette.findIndex((c) => c.id === inkColor.id);
  if (inkIndex < 0) {
    if (palette.length >= 64) {
      // Paleta llena: usa el color más oscuro que ya exista.
      let darkest = 0;
      let darkestLum = Infinity;
      palette.forEach((c, i) => {
        const rgb = hexToRgb(c.hex);
        const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
        if (lum < darkestLum) {
          darkestLum = lum;
          darkest = i;
        }
      });
      inkIndex = darkest;
    } else {
      palette.push(inkColor);
      inkIndex = palette.length - 1;
    }
  }
  const original = [...cells];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = original[i];
      if (v < 0) continue;
      const right = x < width - 1 ? original[i + 1] : v;
      const down = y < height - 1 ? original[i + width] : v;
      const differs = right !== v || down !== v;
      if (!differs) continue;
      const self = hexToRgb(palette[v]?.hex ?? "#FFFFFF");
      const lum = (0.299 * self[0] + 0.587 * self[1] + 0.114 * self[2]) / 255;
      if (lum > 0.3) cells[i] = inkIndex;
    }
  }
}

/** Vista previa rápida del hex de un píxel (útil para depurar). */
export function rgbOfIndex(data: Uint8ClampedArray, i: number): string {
  return rgbToHex(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
}
