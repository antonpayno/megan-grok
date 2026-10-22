// PROPIETARIO: Persona 4. Canvas del patrón, compartido con el feed (P5).
//
// Rendimiento: el dibujo se separa en capas fuera de pantalla.
//   - celdas: se parchean solo las celdas que cambian (no se redibuja 128×128 en cada trazo)
//   - rejilla/placas: estática, se cachea
//   - celdas hechas: se parchea solo lo que cambia en el mask
//   - modo "por color": capa de atenuación cacheada
// Las props originales no cambian; las nuevas son todas opcionales.
import { useEffect, useRef } from "react";
import type { PatternData } from "../../api/types";
import { contrastInk, hexToRgb } from "../../features/editor/patternUtils";

export interface PatternCanvasProps {
  pattern: PatternData;
  /** Tamaño en px de cada celda. Para miniaturas usa `fit` en su lugar. */
  cellSize?: number;
  /** Ajusta el canvas al ancho del contenedor (miniaturas del feed). */
  fit?: boolean;
  showGrid?: boolean;
  /** Mostrar símbolos (punto de cruz) cuando la celda es suficientemente grande. */
  showSymbols?: boolean;
  className?: string;
  onCellPointer?: (x: number, y: number, e: React.PointerEvent<HTMLCanvasElement>) => void;
  // ---- nuevas, opcionales ----
  highlightIndex?: number | null;
  doneMask?: ArrayLike<number> | null;
  boardSize?: number | null;
  showRulers?: boolean;
  onRulerPointer?: (kind: "row" | "col", index: number, e: React.PointerEvent<HTMLCanvasElement>) => void;
}

const RULER = 20;
const CHECK_THRESHOLD = 0.35;

interface CellLayer {
  key: string;
  canvas: HTMLCanvasElement;
  cells: Int16Array;
}

interface SimpleLayer {
  key: string;
  canvas: HTMLCanvasElement;
}

interface DoneLayer extends SimpleLayer {
  mask: Uint8Array;
  cs: number;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function paletteKey(pattern: PatternData): string {
  return pattern.palette.map((c) => `${c.hex}${c.symbol ?? ""}`).join("|");
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  pattern: PatternData,
  index: number,
  cs: number,
  showSymbols: boolean,
  ink: string,
) {
  const W = pattern.width;
  const x = index % W;
  const y = (index - x) / W;
  const px = x * cs;
  const py = y * cs;
  ctx.clearRect(px, py, cs, cs);

  const colorIndex = pattern.cells[index];
  if (colorIndex < 0) return;
  const color = pattern.palette[colorIndex];
  if (!color) return;

  ctx.fillStyle = color.hex;
  if (pattern.craft === "hama") {
    const r = cs / 2;
    ctx.beginPath();
    ctx.arc(px + r, py + r, r * 0.92, 0, Math.PI * 2);
    ctx.arc(px + r, py + r, r * 0.35, 0, Math.PI * 2, true); // agujero de la cuenta
    ctx.fill();
  } else {
    ctx.fillRect(px, py, cs, cs);
    if (showSymbols && color.symbol && cs >= 12) {
      ctx.fillStyle = ink;
      ctx.font = `${Math.floor(cs * 0.7)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(color.symbol, px + cs / 2, py + cs / 2 + 1);
    }
  }
}

function redrawAllCells(layer: CellLayer, pattern: PatternData, cs: number, showSymbols: boolean) {
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  const W = pattern.width;
  const H = pattern.height;
  ctx.clearRect(0, 0, W * cs, H * cs);
  const inks = pattern.palette.map((c) => contrastInk(c.hex));
  for (let i = 0; i < W * H; i++) drawCell(ctx, pattern, i, cs, showSymbols, inks[pattern.cells[i]] ?? "#1f1d2b");
}

function drawGridLayer(W: number, H: number, cs: number, showGrid: boolean, boardSize: number | null): HTMLCanvasElement {
  const canvas = makeCanvas(W * cs, H * cs);
  const ctx = canvas.getContext("2d")!;

  if (showGrid) {
    for (let i = 0; i <= Math.max(W, H); i++) {
      const strong = i % 10 === 0;
      ctx.strokeStyle = strong ? "rgba(31,29,43,0.42)" : "rgba(31,29,43,0.13)";
      ctx.lineWidth = strong ? 1.5 : 1;
      if (i <= W) {
        ctx.beginPath();
        ctx.moveTo(i * cs, 0);
        ctx.lineTo(i * cs, H * cs);
        ctx.stroke();
      }
      if (i <= H) {
        ctx.beginPath();
        ctx.moveTo(0, i * cs);
        ctx.lineTo(W * cs, i * cs);
        ctx.stroke();
      }
    }
  }

  // Separación de placas HAMA (29×29): línea continua con el color de marca.
  if (boardSize && boardSize > 0) {
    ctx.strokeStyle = "rgba(232,69,107,0.6)";
    ctx.lineWidth = 2;
    for (let i = boardSize; i < Math.max(W, H); i += boardSize) {
      if (i < W) {
        ctx.beginPath();
        ctx.moveTo(i * cs, 0);
        ctx.lineTo(i * cs, H * cs);
        ctx.stroke();
      }
      if (i < H) {
        ctx.beginPath();
        ctx.moveTo(0, i * cs);
        ctx.lineTo(W * cs, i * cs);
        ctx.stroke();
      }
    }
  }

  return canvas;
}

function drawDoneMark(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number) {
  ctx.clearRect(x * cs, y * cs, cs, cs);
  ctx.fillStyle = "rgba(255,255,255,0.64)";
  ctx.fillRect(x * cs, y * cs, cs, cs);
  if (cs >= 10) {
    ctx.strokeStyle = "rgba(31,29,43,0.58)";
    ctx.lineWidth = Math.max(1.5, cs * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x * cs + cs * 0.24, y * cs + cs * 0.52);
    ctx.lineTo(x * cs + cs * 0.44, y * cs + cs * 0.74);
    ctx.lineTo(x * cs + cs * 0.78, y * cs + cs * 0.28);
    ctx.stroke();
  }
}

function buildDoneLayer(
  W: number,
  H: number,
  cs: number,
  doneMask: ArrayLike<number>,
): DoneLayer {
  const canvas = makeCanvas(W * cs, H * cs);
  const ctx = canvas.getContext("2d")!;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!doneMask[i]) continue;
    mask[i] = 1;
    drawDoneMark(ctx, i % W, Math.floor(i / W), cs);
  }
  return { key: `${W}x${H}@${cs}`, canvas, mask, cs };
}

function patchDoneLayer(layer: DoneLayer, W: number, doneMask: ArrayLike<number>) {
  const ctx = layer.canvas.getContext("2d")!;
  const total = layer.mask.length;
  for (let i = 0; i < total; i++) {
    const next = doneMask[i] ? 1 : 0;
    if (next === layer.mask[i]) continue;
    layer.mask[i] = next;
    const x = i % W;
    const y = (i - x) / W;
    if (next) {
      drawDoneMark(ctx, x, y, layer.cs);
    } else {
      ctx.clearRect(x * layer.cs, y * layer.cs, layer.cs, layer.cs);
    }
  }
}

function drawRulers(ctx: CanvasRenderingContext2D, W: number, H: number, cs: number, pad: number) {
  const step = cs >= 7 ? 5 : 10;
  const font = Math.max(7, Math.min(10, cs));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let x = 0; x < W; x++) {
    const n = x + 1;
    if (n % step !== 0 && n !== 1) continue;
    ctx.font = `${n % 10 === 0 ? font + 1 : font}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = n % 10 === 0 ? "rgba(31,29,43,0.85)" : "rgba(31,29,43,0.5)";
    ctx.fillText(String(n), pad + x * cs + cs / 2, pad / 2);
  }
  for (let y = 0; y < H; y++) {
    const n = y + 1;
    if (n % step !== 0 && n !== 1) continue;
    ctx.font = `${n % 10 === 0 ? font + 1 : font}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = n % 10 === 0 ? "rgba(31,29,43,0.85)" : "rgba(31,29,43,0.5)";
    const label = String(n);
    const w = ctx.measureText(label).width;
    ctx.fillText(w > pad ? label.slice(-1) : label, pad / 2, pad + y * cs + cs / 2);
  }
}

export default function PatternCanvas({
  pattern,
  cellSize = 16,
  fit = false,
  showGrid = false,
  showSymbols = false,
  className,
  onCellPointer,
  highlightIndex = null,
  doneMask = null,
  boardSize = null,
  showRulers = false,
  onRulerPointer,
}: PatternCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cellLayer = useRef<CellLayer | null>(null);
  const gridLayer = useRef<SimpleLayer | null>(null);
  const doneLayer = useRef<DoneLayer | null>(null);
  const highlightLayer = useRef<SimpleLayer | null>(null);

  const { width: W, height: H } = pattern;
  const cs = fit ? 8 : cellSize; // en modo fit dibujamos a 8px y escalamos con CSS
  const pad = showRulers && !fit ? RULER : 0;
  const cssW = W * cs + pad * 2;
  const cssH = H * cs + pad * 2;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const pixelW = Math.max(1, Math.round(cssW * dpr));
    const pixelH = Math.max(1, Math.round(cssH * dpr));
    if (cv.width !== pixelW || cv.height !== pixelH) {
      cv.width = pixelW;
      cv.height = pixelH;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);

    // --- capa de celdas: solo se repintan las celdas que cambian ---
    const colorsKey = paletteKey(pattern);
    const cellKey = `${W}x${H}@${cs}:${pattern.craft}:${showSymbols ? 1 : 0}:${colorsKey}`;
    let cells = cellLayer.current;
    let cellsChanged = false;
    if (!cells || cells.key !== cellKey) {
      const canvas = makeCanvas(W * cs, H * cs);
      cells = { key: cellKey, canvas, cells: Int16Array.from({ length: W * H }, () => -1) };
      redrawAllCells(cells, pattern, cs, showSymbols);
      cells.cells = Int16Array.from(pattern.cells);
      cellLayer.current = cells;
      cellsChanged = true;
    } else {
      const previous = cells.cells;
      const changed: number[] = [];
      const total = Math.min(previous.length, pattern.cells.length);
      for (let i = 0; i < total; i++) {
        if (previous[i] === pattern.cells[i]) continue;
        previous[i] = pattern.cells[i];
        changed.push(i);
      }
      if (changed.length > 0) {
        cellsChanged = true;
        if (changed.length > W * H * CHECK_THRESHOLD) {
          redrawAllCells(cells, pattern, cs, showSymbols);
        } else {
          const cellCtx = cells.canvas.getContext("2d");
          if (cellCtx) {
            const inks = pattern.palette.map((c) => contrastInk(c.hex));
            for (const i of changed) {
              drawCell(cellCtx, pattern, i, cs, showSymbols, inks[pattern.cells[i]] ?? "#1f1d2b");
            }
          }
        }
      }
    }

    // --- rejilla / placas ---
    const gridKey = `${W}x${H}@${cs}:${showGrid ? 1 : 0}:${boardSize ?? 0}`;
    if (!gridLayer.current || gridLayer.current.key !== gridKey) {
      gridLayer.current = {
        key: gridKey,
        canvas: drawGridLayer(W, H, cs, showGrid, boardSize),
      };
    }

    // --- celdas hechas ---
    if (!doneMask) {
      doneLayer.current = null;
    } else if (!doneLayer.current || doneLayer.current.key !== `${W}x${H}@${cs}`) {
      doneLayer.current = buildDoneLayer(W, H, cs, doneMask);
    } else {
      patchDoneLayer(doneLayer.current, W, doneMask);
    }

    // --- modo "por color" ---
    const highlightKey = `${W}x${H}@${cs}:${highlightIndex ?? -1}`;
    if (highlightIndex === null || highlightIndex < 0) {
      highlightLayer.current = null;
    } else if (!highlightLayer.current || highlightLayer.current.key !== highlightKey || cellsChanged) {
      const canvas = makeCanvas(W * cs, H * cs);
      const hctx = canvas.getContext("2d")!;
      hctx.fillStyle = "rgba(251,248,244,0.76)";
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = pattern.cells[y * W + x];
          if (idx < 0 || idx === highlightIndex) continue;
          hctx.fillRect(x * cs, y * cs, cs, cs);
        }
      }
      highlightLayer.current = { key: highlightKey, canvas };
    }

    // --- composición final ---
    ctx.drawImage(cells.canvas, pad, pad, W * cs, H * cs);
    if (gridLayer.current) ctx.drawImage(gridLayer.current.canvas, pad, pad);
    if (doneLayer.current) ctx.drawImage(doneLayer.current.canvas, pad, pad);
    if (highlightLayer.current) ctx.drawImage(highlightLayer.current.canvas, pad, pad);
    if (pad > 0) drawRulers(ctx, W, H, cs, pad);
  }, [pattern, cs, W, H, showGrid, showSymbols, pad, cssW, cssH, doneMask, highlightIndex, boardSize]);

  const handle = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * cssW;
    const ly = ((e.clientY - rect.top) / rect.height) * cssH;

    if (pad > 0) {
      if (ly < pad) {
        const cx = Math.floor((lx - pad) / cs);
        if (cx >= 0 && cx < W) {
          onRulerPointer?.("col", cx, e);
          return;
        }
      }
      if (lx < pad) {
        const cy = Math.floor((ly - pad) / cs);
        if (cy >= 0 && cy < H) {
          onRulerPointer?.("row", cy, e);
          return;
        }
      }
    }

    const x = Math.floor((lx - pad) / cs);
    const y = Math.floor((ly - pad) / cs);
    if (x >= 0 && y >= 0 && x < W && y < H) onCellPointer?.(x, y, e);
  };

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label={`Patrón de ${W} × ${H} (${pattern.craft === "hama" ? "cuentas HAMA" : "punto de cruz"})`}
      style={
        fit
          ? { width: "100%", aspectRatio: `${W} / ${H}`, imageRendering: "pixelated" }
          : { width: cssW, height: cssH, touchAction: "none" }
      }
      onPointerDown={handle}
      onPointerMove={(e) => (e.buttons === 1 || e.pointerType !== "mouse") && handle(e)}
    />
  );
}

/** Color con contraste legible sobre él (lo usa la leyenda del editor). */
export function inkFor(hex: string): string {
  return contrastInk(hex);
}

/** Convierte un hex #RRGGBB a "r,g,b" (por si hace falta en overlays). */
export function rgbTuple(hex: string): [number, number, number] {
  return hexToRgb(hex);
}
