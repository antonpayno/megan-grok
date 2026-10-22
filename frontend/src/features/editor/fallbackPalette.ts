// Paletas locales de respaldo si GET /api/palettes no responde.
// Cuando la API funciona, se usan las del backend (ver usePalettes.ts).
import type { Craft, Palette, PaletteColor } from "../../api/types";

/** Símbolos para las cartas de punto de cruz (uno por color, únicos). */
const SYMBOLS = [
  "●", "▲", "■", "◆", "★", "✚", "✖", "▼", "◐", "◑",
  "○", "□", "△", "◇", "☆", "✕", "♥", "♠", "♣", "♦",
  "☀", "☂", "☘", "☾", "♫", "∞", "≡", "≈", "÷", "×",
  "+", "-", "=", "?", "!", "&", "%", "@", "#", "§",
  "¶", "µ", "Ω", "π", "Δ", "Σ", "Φ", "Ψ", "λ", "θ",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
];

type Raw = [id: string, name: string, hex: string];

const HAMA_RAW: Raw[] = [
  ["H01", "Blanco", "#FFFFFF"],
  ["H02", "Crema", "#F7ECD1"],
  ["H03", "Amarillo", "#FFD400"],
  ["H04", "Naranja", "#FF7A00"],
  ["H05", "Rojo", "#D7263D"],
  ["H06", "Burdeos", "#8A1538"],
  ["H07", "Rosa", "#FF6FA5"],
  ["H08", "Rosa claro", "#FFB3C7"],
  ["H09", "Lila", "#B39DDB"],
  ["H10", "Morado", "#6A3FA0"],
  ["H11", "Azul cielo", "#7EC8E3"],
  ["H12", "Azul", "#1F6FD1"],
  ["H13", "Azul marino", "#17324D"],
  ["H14", "Verde lima", "#A8E06A"],
  ["H15", "Verde", "#3FA34D"],
  ["H16", "Verde oscuro", "#1F5C2E"],
  ["H17", "Marrón", "#8B5A2B"],
  ["H18", "Marrón claro", "#C89B6A"],
  ["H19", "Beige", "#E6D0B3"],
  ["H20", "Gris claro", "#C9C9C9"],
  ["H21", "Gris", "#8A8A8A"],
  ["H22", "Negro", "#1A1A1A"],
  ["H23", "Amarillo pastel", "#FFE9A8"],
  ["H24", "Melocotón", "#FFB38A"],
  ["H25", "Turquesa", "#30C9C9"],
  ["H26", "Azul pastel", "#B3DFF5"],
  ["H27", "Lavanda", "#D6C6F5"],
  ["H28", "Fucsia", "#E5007D"],
  ["H29", "Oliva", "#7A8B3C"],
  ["H30", "Arena", "#D9C6A5"],
];

const DMC_RAW: Raw[] = [
  ["B5200", "Blanco", "#FFFFFF"],
  ["819", "Blanco hueso", "#F7F2E7"],
  ["310", "Negro", "#000000"],
  ["666", "Rojo", "#E31D42"],
  ["321", "Rojo ladrillo", "#C72B3B"],
  ["815", "Burdeos", "#870B2C"],
  ["605", "Rosa chicle", "#FF9CC0"],
  ["603", "Rosa", "#FF7FA0"],
  ["963", "Rosa palo", "#FFD1DC"],
  ["818", "Rosa bebé", "#FFE0E4"],
  ["553", "Morado", "#A45AA5"],
  ["550", "Morado oscuro", "#5C2A6B"],
  ["3746", "Lila", "#B39DDB"],
  ["743", "Amarillo", "#FFD94A"],
  ["744", "Amarillo claro", "#FFE9A8"],
  ["726", "Amarillo sol", "#FFE066"],
  ["741", "Naranja", "#FFA300"],
  ["946", "Naranja fuerte", "#EB5B00"],
  ["471", "Verde claro", "#A8C97F"],
  ["704", "Verde lima", "#B9D96A"],
  ["703", "Verde", "#7BB661"],
  ["700", "Verde oscuro", "#00764B"],
  ["3345", "Verde bosque", "#3C6E47"],
  ["3846", "Turquesa", "#00B3B0"],
  ["3841", "Azul cielo", "#CBE8F5"],
  ["995", "Azul eléctrico", "#0072CE"],
  ["798", "Azul", "#3E6FB0"],
  ["796", "Azul oscuro", "#113B75"],
  ["3750", "Azul marino", "#17324D"],
  ["738", "Beige", "#E8D3B9"],
  ["437", "Marrón claro", "#C89B6A"],
  ["433", "Marrón", "#8B5A2B"],
  ["3371", "Marrón oscuro", "#4A2C1A"],
  ["415", "Gris claro", "#D3D3D3"],
  ["414", "Gris", "#8C8C8C"],
  ["3799", "Gris oscuro", "#4A4A4A"],
];

function build(raws: Raw[]): PaletteColor[] {
  return raws.map(([id, name, hex], i) => ({
    id,
    name,
    hex,
    symbol: SYMBOLS[i % SYMBOLS.length],
  }));
}

export const HAMA_COLORS: PaletteColor[] = build(HAMA_RAW);
export const DMC_COLORS: PaletteColor[] = build(DMC_RAW);

export const FALLBACK_PALETTES: Palette[] = [
  { id: "hama_midi", name: "Hama midi", craft: "hama", colors: HAMA_COLORS },
  { id: "dmc", name: "DMC", craft: "cross_stitch", colors: DMC_COLORS },
];

/** Paleta completa (todos los colores disponibles) para una técnica. */
export function fallbackPaletteFor(craft: Craft): PaletteColor[] {
  return craft === "hama" ? HAMA_COLORS : DMC_COLORS;
}

export function fallbackPaletteIdFor(craft: Craft): string {
  return craft === "hama" ? "hama_midi" : "dmc";
}

/** Tamaños predefinidos del lienzo. */
export const PRESET_SIZES: Record<Craft, { label: string; width: number; height: number }[]> = {
  hama: [
    { label: "29 × 29 · placa cuadrada", width: 29, height: 29 },
    { label: "15 × 15 · mini", width: 15, height: 15 },
    { label: "58 × 58 · 4 placas", width: 58, height: 58 },
  ],
  cross_stitch: [
    { label: "30 × 30", width: 30, height: 30 },
    { label: "50 × 50", width: 50, height: 50 },
    { label: "80 × 80", width: 80, height: 80 },
  ],
};
