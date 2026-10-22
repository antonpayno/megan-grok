import { cn } from "./cn";

/** Bloque gris con brillo, para estados de carga. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-shimmer rounded-lg", className)} />;
}
