// PROPIETARIO: Persona 4. Versión básica funcional para que P5 pueda usarla
// desde el minuto 0 (miniaturas del feed). P4 puede mejorarla SIN romper estas props.
import { useEffect, useRef } from "react";
import type { PatternData } from "../../api/types";

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
}

export default function PatternCanvas({
  pattern, cellSize = 16, fit = false, showGrid = false, showSymbols = false, className, onCellPointer,
}: PatternCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width: W, height: H } = pattern;
  const cs = fit ? 8 : cellSize; // en modo fit dibujamos a 8px y escalamos con CSS

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * cs * dpr;
    cv.height = H * cs * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W * cs, H * cs);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W * cs, H * cs);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = pattern.cells[y * W + x];
        if (idx < 0) continue;
        const color = pattern.palette[idx];
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
            ctx.fillStyle = luminance(color.hex) > 0.55 ? "#000" : "#fff";
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
        if (i <= W) { ctx.beginPath(); ctx.moveTo(i * cs, 0); ctx.lineTo(i * cs, H * cs); ctx.stroke(); }
        if (i <= H) { ctx.beginPath(); ctx.moveTo(0, i * cs); ctx.lineTo(W * cs, i * cs); ctx.stroke(); }
      }
    }
  }, [pattern, cs, W, H, showGrid, showSymbols]);

  const handle = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onCellPointer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
    if (x >= 0 && y >= 0 && x < W && y < H) onCellPointer(x, y, e);
  };

  return (
    <canvas
      ref={ref}
      className={className}
      style={fit
        ? { width: "100%", aspectRatio: `${W} / ${H}`, imageRendering: "pixelated" }
        : { width: W * cs, height: H * cs, touchAction: "none" }}
      onPointerDown={handle}
      onPointerMove={(e) => e.buttons === 1 && handle(e)}
    />
  );
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
