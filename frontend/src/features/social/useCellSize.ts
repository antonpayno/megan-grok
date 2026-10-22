import { useEffect, useRef, useState } from "react";

/**
 * Tamaño de celda (en px reales) para que un patrón quepa nítido en su contenedor.
 * Evita el escalado borroso de pintar siempre a 8 px/celda.
 */
export function useCellSize(side: number, maxCell = 64) {
  const ref = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(2);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const width = element.clientWidth;
      if (width <= 0) return;
      const next = Math.floor(width / Math.max(1, side));
      setCellSize(Math.max(1, Math.min(maxCell, next)));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [side, maxCell]);

  return { ref, cellSize };
}
