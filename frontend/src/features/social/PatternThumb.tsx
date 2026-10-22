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
}: {
  pattern: PatternData;
  showGrid?: boolean;
  padding?: string;
  className?: string;
}) {
  const side = Math.max(pattern.width, pattern.height);
  const { ref, cellSize } = useCellSize(side);

  return (
    <div className={cn("relative aspect-square w-full overflow-hidden bg-paper", className)}>
      <div className={cn("absolute inset-0 flex items-center justify-center", padding)}>
        <div ref={ref} className="flex h-full w-full items-center justify-center">
          <PatternCanvas pattern={pattern} cellSize={cellSize} showGrid={showGrid} className="block rounded-[2px]" />
        </div>
      </div>
    </div>
  );
}
