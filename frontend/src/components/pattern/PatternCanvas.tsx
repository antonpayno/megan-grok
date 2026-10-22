// PROPIETARIO: Persona 4. Versión básica funcional para que P5 pueda usarla
// desde el minuto 0 (miniaturas del feed). P4 puede mejorarla SIN romper estas props.
//
// Props nuevas (todas opcionales, compatibles con lo anterior):
//   highlightIndex  -> atenúa el resto de colores (modo "por color" de /make/:id)
//   doneMask        -> celdas ya hechas (1) con marca de check
//   boardSize       -> líneas de separación de placas HAMA cada N celdas
//   showRulers      -> numeración de filas/columnas cada 5 (fuerte cada 10)
//   onRulerPointer  -> clic en la numeración (para "marcar fila/columna")
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
  const baseCache = useRef<{ key: unknown[]; canvas: HTMLCanvasElement } | null>(null);
  const { width: W, height: H } = pattern;
  const cs = fit ? 8 : cellSize; // en modo fit dibujamos a 8px y escalamos con CSS
  const pad = showRulers && !fit ? RULER : 0;
  const cssW = W * cs + pad * 2;
  const cssH = H * cs + pad * 2;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);

    // --- capa base (se cachea: al pintar solo se redibuja lo que cambia) ---
    const key = [pattern, cs, showGrid, showSymbols, boardSize ?? 0, W, H];
    let base = baseCache.current;
    const same = base && base.key.length === key.length && key.every((v, i) => v === base!.key[i]);
    if (!same || !base) {
      const canvas = drawBase(pattern, cs, showGrid, showSymbols, boardSize);
      base = { key, canvas };
      baseCache.current = base;
    }
    ctx.drawImage(base.canvas, pad, pad, W * cs, H * cs);

    // --- celdas hechas ---
    if (doneMask) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!doneMask[y * W + x]) continue;
          ctx.fillStyle = "rgba(255,255,255,0.62)";
          ctx.fillRect(pad + x * cs, pad + y * cs, cs, cs);
          if (cs >= 10) {
            ctx.strokeStyle = "rgba(31,29,43,0.55)";
            ctx.lineWidth = Math.max(1.5, cs * 0.12);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(pad + x * cs + cs * 0.24, pad + y * cs + cs * 0.52);
            ctx.lineTo(pad + x * cs + cs * 0.44, pad + y * cs + cs * 0.74);
            ctx.lineTo(pad + x * cs + cs * 0.78, pad + y * cs + cs * 0.28);
            ctx.stroke();
          }
        }
      }
    }

    // --- modo "por color": atenúa lo que no es del color elegido ---
    if (highlightIndex !== null && highlightIndex >= 0) {
      ctx.fillStyle = "rgba(251,248,244,0.74)";
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = pattern.cells[y * W + x];
          if (idx < 0 || idx === highlightIndex) continue;
          ctx.fillRect(pad + x * cs, pad + y * cs, cs, cs);
        }
      }
    }

    // --- numeración ---
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

function drawBase(
  pattern: PatternData,
  cs: number,
  showGrid: boolean,
  showSymbols: boolean,
  boardSize: number | null,
): HTMLCanvasElement {
  const { width: W, height: H } = pattern;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, W * cs);
  canvas.height = Math.max(1, H * cs);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W * cs, H * cs);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = pattern.cells[y * W + x];
      if (idx < 0) continue;
      const color = pattern.palette[idx];
      if (!color) continue;
      ctx.fillStyle = color.hex;
      if (pattern.craft === "hama") {
        const r = cs / 2;
        ctx.beginPath();
        ctx.arc(x * cs + r, y * cs + r, r * 0.92, 0, Math.PI * 2);
        ctx.arc(x * cs + r, y * cs + r, r * 0.35, 0, Math.PI * 2, true); // agujero de la cuenta
        ctx.fill();
      } else {
        ctx.fillRect(x * cs, y * cs, cs, cs);
        if (showSymbols && color.symbol && cs >= 12) {
          ctx.fillStyle = contrastInk(color.hex);
          ctx.font = `${Math.floor(cs * 0.7)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(color.symbol, x * cs + cs / 2, y * cs + cs / 2 + 1);
        }
      }
    }
  }

  if (showGrid) {
    for (let i = 0; i <= Math.max(W, H); i++) {
      const strong = i % 10 === 0;
      ctx.strokeStyle = strong ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.12)";
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

  // Separación de placas HAMA (29×29): línea oscura continua.
  if (boardSize && boardSize > 0) {
    ctx.strokeStyle = "rgba(232,69,107,0.55)";
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

function drawRulers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cs: number,
  pad: number,
) {
  const step = cs >= 7 ? 5 : 10;
  const font = Math.max(7, Math.min(10, cs));
  ctx.font = `${font}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(31,29,43,0.62)";

  for (let x = 0; x < W; x++) {
    const n = x + 1;
    if (n % step !== 0 && n !== 1) continue;
    if (n % 10 !== 0 && n !== 1 && cs < 7) continue;
    ctx.font = `${n % 10 === 0 ? font + 1 : font}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = n % 10 === 0 ? "rgba(31,29,43,0.85)" : "rgba(31,29,43,0.5)";
    ctx.fillText(String(n), pad + x * cs + cs / 2, pad / 2);
  }
  for (let y = 0; y < H; y++) {
    const n = y + 1;
    if (n % step !== 0 && n !== 1) continue;
    if (n % 10 !== 0 && n !== 1 && cs < 7) continue;
    ctx.font = `${n % 10 === 0 ? font + 1 : font}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = n % 10 === 0 ? "rgba(31,29,43,0.85)" : "rgba(31,29,43,0.5)";
    const label = String(n);
    const w = ctx.measureText(label).width;
    ctx.fillText(label, pad / 2, pad + y * cs + cs / 2);
    if (w > pad) ctx.fillText(label.slice(-1), pad / 2, pad + y * cs + cs / 2);
  }
}

/** Color con contraste legible sobre él (lo usa la leyenda del editor). */
export function inkFor(hex: string): string {
  return contrastInk(hex);
}

/** Convierte un hex #RRGGBB a "r,g,b" (por si hace falta en overlays). */
export function rgbTuple(hex: string): [number, number, number] {
  return hexToRgb(hex);
}
