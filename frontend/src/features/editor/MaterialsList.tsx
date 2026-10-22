// Lista de materiales: cuántas cuentas/puntadas de cada color hacen falta.
import { useMemo } from "react";
import type { PatternData } from "../../api/types";
import { colorCounts, contrastInk, hamaBoards, totalBeads } from "./patternUtils";

export interface MaterialsListProps {
  pattern: PatternData;
  doneMask?: ArrayLike<number> | null;
  have?: Set<string>;
  onToggleHave?: (colorId: string) => void;
  /** Muestra placas de 29×29 necesarias (solo HAMA). */
  showBoards?: boolean;
  className?: string;
}

export default function MaterialsList({
  pattern,
  doneMask,
  have,
  onToggleHave,
  showBoards = true,
  className = "",
}: MaterialsListProps) {
  const counts = useMemo(() => colorCounts(pattern), [pattern]);
  const total = useMemo(() => totalBeads(pattern), [pattern]);

  const doneByColor = useMemo(() => {
    if (!doneMask) return null;
    const acc = new Array(pattern.palette.length).fill(0);
    for (let i = 0; i < pattern.cells.length; i++) {
      const c = pattern.cells[i];
      if (c >= 0 && doneMask[i]) acc[c]++;
    }
    return acc;
  }, [doneMask, pattern]);

  const boards = showBoards && pattern.craft === "hama" ? hamaBoards(pattern.width, pattern.height) : 0;
  const unit = pattern.craft === "hama" ? "cuentas" : "puntadas";

  return (
    <section className={`rounded-2xl border border-ink/10 bg-white p-4 shadow-sm ${className}`}>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Materiales</h2>
        <span className="text-xs text-ink/50">
          {pattern.palette.length} colores · {total.toLocaleString("es-ES")} {unit}
        </span>
      </header>

      {pattern.palette.length === 0 ? (
        <p className="text-sm text-ink/50">Aún no hay colores: pinta alguna celda para empezar.</p>
      ) : (
        <ul className="divide-y divide-ink/5">
          {pattern.palette.map((color, i) => {
            const count = counts[i] ?? 0;
            const done = doneByColor ? doneByColor[i] : 0;
            const owned = have?.has(color.id) ?? false;
            return (
              <li key={`${color.id}-${i}`} className="flex items-center gap-3 py-2">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink/10 text-[11px] font-bold"
                  style={{ background: color.hex, color: contrastInk(color.hex) }}
                  title={color.name}
                >
                  {color.symbol ?? ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="font-mono text-xs text-ink/50">{color.id}</span> {color.name}
                  </p>
                  <p className="text-xs text-ink/50">
                    {count.toLocaleString("es-ES")} {unit}
                    {doneByColor ? ` · ${done} hechas` : ""}
                  </p>
                </div>
                {onToggleHave && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={owned}
                      onChange={() => onToggleHave(color.id)}
                      className="h-4 w-4 accent-brand"
                    />
                    Ya lo tengo
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink/10 pt-3 text-xs text-ink/60">
        <span>
          Total: <strong className="text-ink">{total.toLocaleString("es-ES")}</strong> {unit}
        </span>
        {boards > 0 && (
          <span>
            Placas 29×29: <strong className="text-ink">{boards}</strong>
          </span>
        )}
        <span>
          Lienzo: <strong className="text-ink">{pattern.width} × {pattern.height}</strong>
        </span>
      </footer>
    </section>
  );
}
