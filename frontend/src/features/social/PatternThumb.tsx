import type { PatternData } from "../../api/types";
import PatternCanvas from "../../components/pattern/PatternCanvas";
import { cn } from "../../components/ui/cn";
import { useCellSize } from "./useCellSize";

/**
 * Miniatura cuadrada y centrada de un patrón.
 * Calcula el tamaño de celda según el contenedor para que se vea nítida (sin reescalado).
 */
export function PatternThumb({
  pattern,
  showGrid = false,
  padding = "p-3",
  className,
  ariaLabel,
}: {
  pattern: PatternData;
  showGrid?: boolean;
  padding?: string;
  className?: string;
  /** Texto alternativo; si se omite, la miniatura es decorativa. */
  ariaLabel?: string;
}) {
  const side = Math.max(pattern.width, pattern.height);
  const { ref, cellSize } = useCellSize(side);

  return (
    <div className={cn("relative aspect-square w-full overflow-hidden bg-paper", className)}>
      <div className={cn("absolute inset-0 flex items-center justify-center", padding)}>
        <div
          ref={ref}
          role={ariaLabel ? "img" : undefined}
          aria-label={ariaLabel}
          aria-hidden={ariaLabel ? undefined : true}
          className="flex h-full w-full items-center justify-center"
        >
          <PatternCanvas
            pattern={pattern}
            cellSize={cellSize}
            showGrid={showGrid}
            className="block max-w-full rounded-[3px] ring-1 ring-line/70 [image-rendering:pixelated]"
          />
        </div>
      </div>
    </div>
  );
}
