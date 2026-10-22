// Utilidades puras sobre PatternData (sin React).
import {
  MAX_PALETTE_COLORS,
  MAX_PATTERN_SIDE,
  type Craft,
  type PaletteColor,
  type PatternData,
} from "../../api/types";

export const HAMA_BOARD = 29;

export function clampSide(n: number): number {
  return Math.max(1, Math.min(MAX_PATTERN_SIDE, Math.round(n)));
}

export function createBlankPattern(craft: Craft, width: number, height = width): PatternData {
  const w = clampSide(width);
  const h = clampSide(height);
  return { craft, width: w, height: h, palette: [], cells: new Array(w * h).fill(-1) };
}

export function clonePattern(p: PatternData): PatternData {
  return {
    craft: p.craft,
    width: p.width,
    height: p.height,
    palette: p.palette.map((c) => ({ ...c })),
    cells: [...p.cells],
  };
}

/** Garantiza que el patrón cumple el contrato (celdas dentro de rango y tamaño cuadrado). */
export function normalizePattern(p: PatternData): PatternData {
  const width = clampSide(p.width || 1);
  const height = clampSide(p.height || 1);
  const palette = (p.palette ?? []).slice(0, MAX_PALETTE_COLORS).map((c) => ({ ...c }));
  const n = palette.length;
  const cells = new Array<number>(width * height).fill(-1);
  const src = p.cells ?? [];
  const max = Math.min(src.length, cells.length);
  for (let i = 0; i < max; i++) {
    const v = src[i];
    cells[i] = v >= 0 && v < n ? v : -1;
  }
  return { craft: p.craft === "cross_stitch" ? "cross_stitch" : "hama", width, height, palette, cells };
}

export function isValidPattern(p: PatternData): boolean {
  return (
    p.width >= 1 &&
    p.width <= MAX_PATTERN_SIDE &&
    p.height >= 1 &&
    p.height <= MAX_PATTERN_SIDE &&
    p.cells.length === p.width * p.height &&
    p.cells.every((c) => c >= -1 && c < p.palette.length) &&
    p.palette.length <= MAX_PALETTE_COLORS
  );
}

/** Nº de celdas por índice de color (tamaño = palette.length). */
export function colorCounts(p: PatternData): number[] {
  const counts = new Array(p.palette.length).fill(0);
  for (const c of p.cells) if (c >= 0 && c < counts.length) counts[c]++;
  return counts;
}

export function totalBeads(p: PatternData): number {
  let n = 0;
  for (const c of p.cells) if (c >= 0) n++;
  return n;
}

/** Placas de 29×29 necesarias para cubrir el lienzo. */
export function hamaBoards(width: number, height: number): number {
  return Math.max(1, Math.ceil(width / HAMA_BOARD) * Math.ceil(height / HAMA_BOARD));
}

/** Zoom inicial razonable para que el patrón se vea entero sin hacer scroll. */
export function fitZoomFor(width: number, height: number, cellSize = 16): number {
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const availableW = Math.min(vw - 48, 760);
  const availableH = Math.min(vh * 0.58, 560);
  const raw = Math.min(availableW / (Math.max(1, width) * cellSize), availableH / (Math.max(1, height) * cellSize));
  return Math.max(0.25, Math.min(1, raw));
}

/** Puntos de una línea Bresenham entre dos celdas (trazo continuo). */
export function linePoints(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx - dy;
  while (true) {
    points.push({ x, y });
    if (x === tx && y === ty) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

/** Redimensiona conservando la esquina superior izquierda. */
export function resizePattern(p: PatternData, width: number, height: number): PatternData {
  const w = clampSide(width);
  const h = clampSide(height);
  const cells = new Array<number>(w * h).fill(-1);
  const copyW = Math.min(w, p.width);
  const copyH = Math.min(h, p.height);
  for (let y = 0; y < copyH; y++) {
    for (let x = 0; x < copyW; x++) cells[y * w + x] = p.cells[y * p.width + x];
  }
  return { ...p, width: w, height: h, cells };
}

/** Añade un color a la paleta del patrón (o devuelve el índice si ya estaba). */
export function addColor(p: PatternData, color: PaletteColor): { pattern: PatternData; index: number } {
  const existing = p.palette.findIndex((c) => c.id === color.id || c.hex.toLowerCase() === color.hex.toLowerCase());
  if (existing >= 0) return { pattern: p, index: existing };
  if (p.palette.length >= MAX_PALETTE_COLORS) return { pattern: p, index: -1 };
  return { pattern: { ...p, palette: [...p.palette, { ...color }] }, index: p.palette.length };
}

/** Quita un color: sus celdas pasan a -1 y se reindexan las de los colores posteriores. */
export function removeColor(p: PatternData, index: number): PatternData {
  if (index < 0 || index >= p.palette.length) return p;
  const palette = p.palette.filter((_, i) => i !== index);
  const cells = p.cells.map((c) => {
    if (c === index) return -1;
    if (c > index) return c - 1;
    return c;
  });
  return { ...p, palette, cells };
}

// ---------- Color ----------

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function nearestColorIndex(palette: PaletteColor[], rgb: [number, number, number]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = colorDistance(rgb, hexToRgb(palette[i].hex));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Color de contraste (negro/blanco) para pintar texto encima de un hex. */
export function contrastInk(hex: string): string {
  return luminance(hex) > 0.55 ? "#1f1d2b" : "#ffffff";
}
