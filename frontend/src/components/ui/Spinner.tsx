import { Loader2 } from "lucide-react";
import { cn } from "./cn";

/** Indicador de carga centrado, con etiqueta accesible. */
export function Spinner({ label = "Cargando…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 py-8 text-sm text-ink-soft", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
