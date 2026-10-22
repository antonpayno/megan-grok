// Exportación local a PNG (respaldo mientras P2 no expone /patterns/export).
import type { PatternData } from "../../api/types";
import { contrastInk } from "./patternUtils";

export function patternToCanvas(pattern: PatternData, cellSize = 16): HTMLCanvasElement {
  const { width: W, height: H } = pattern;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, W * cellSize);
  canvas.height = Math.max(1, H * cellSize);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = pattern.cells[y * W + x];
      if (idx < 0) continue;
      const color = pattern.palette[idx];
      if (!color) continue;
      ctx.fillStyle = color.hex;
      if (pattern.craft === "hama") {
        const r = cellSize / 2;
        ctx.beginPath();
        ctx.arc(x * cellSize + r, y * cellSize + r, r * 0.92, 0, Math.PI * 2);
        ctx.arc(x * cellSize + r, y * cellSize + r, r * 0.35, 0, Math.PI * 2, true);
        ctx.fill();
      } else {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        if (color.symbol && cellSize >= 12) {
          ctx.fillStyle = contrastInk(color.hex);
          ctx.font = `${Math.floor(cellSize * 0.7)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(color.symbol, x * cellSize + cellSize / 2, y * cellSize + cellSize / 2 + 1);
        }
      }
    }
  }

  // Rejilla suave cada 10 y coordenadas en el borde.
  ctx.strokeStyle = "rgba(31,29,43,0.25)";
  ctx.lineWidth = 1;
  for (let i = 10; i < Math.max(W, H); i += 10) {
    if (i < W) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, H * cellSize);
      ctx.stroke();
    }
    if (i < H) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(W * cellSize, i * cellSize);
      ctx.stroke();
    }
  }

  return canvas;
}

export function patternToPngBlob(pattern: PatternData, cellSize = 16): Promise<Blob> {
  const canvas = patternToCanvas(pattern, cellSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar el PNG"))), "image/png");
  });
}
