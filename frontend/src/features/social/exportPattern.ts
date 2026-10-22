import type { PatternData } from "../../api/types";

/** Pinta un patrón en un canvas fuera de pantalla (export local, sin backend). */
export function renderPatternToCanvas(pattern: PatternData, cell = 16): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const size = Math.max(2, cell) * dpr;
  canvas.width = pattern.width * size;
  canvas.height = pattern.height * size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no soporta canvas.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      const index = pattern.cells[y * pattern.width + x];
      const color = pattern.palette[index];
      if (index < 0 || !color) continue;
      ctx.fillStyle = color.hex;
      if (pattern.craft === "hama") {
        const radius = size / 2;
        ctx.beginPath();
        ctx.arc(x * size + radius, y * size + radius, radius * 0.92, 0, Math.PI * 2);
        ctx.arc(x * size + radius, y * size + radius, radius * 0.34, 0, Math.PI * 2, true);
        ctx.fill();
      } else {
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
  }

  return canvas;
}

/** PNG listo para descargar, generado en el navegador. */
export function patternToPngBlob(pattern: PatternData, cell = 16): Promise<Blob> {
  const canvas = renderPatternToCanvas(pattern, cell);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo generar el PNG."));
    }, "image/png");
  });
}

export function fileSlug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "patron"
  );
}
