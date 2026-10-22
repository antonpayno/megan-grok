// Selector de color del patrón + añadir/quitar colores de la paleta completa.
import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type { PaletteColor, PatternData } from "../../api/types";
import { contrastInk } from "./patternUtils";

export interface ColorPickerProps {
  pattern: PatternData;
  colorIndex: number;
  onSelect: (index: number) => void;
  onAdd: (color: PaletteColor) => void;
  onRemove: (index: number) => void;
  /** Todos los colores disponibles (paleta del fabricante). */
  allColors: PaletteColor[];
  maxColors?: number;
}

export default function ColorPicker({
  pattern,
  colorIndex,
  onSelect,
  onAdd,
  onRemove,
  allColors,
  maxColors = 64,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allColors;
    return allColors.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [allColors, query]);

  const usedIds = useMemo(() => new Set(pattern.palette.map((c) => c.id)), [pattern.palette]);
  const full = pattern.palette.length >= maxColors;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {pattern.palette.map((color, i) => {
          const selected = i === colorIndex;
          return (
            <div key={`${color.id}-${i}`} className="relative">
              <button
                type="button"
                onClick={() => onSelect(i)}
                title={`${color.id} · ${color.name}`}
                className={`grid h-9 w-9 place-items-center rounded-xl border text-[11px] font-bold transition ${
                  selected ? "scale-105 border-ink ring-2 ring-ink/70" : "border-ink/15 hover:border-ink/40"
                }`}
                style={{ background: color.hex, color: contrastInk(color.hex) }}
              >
                {color.symbol ?? ""}
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  title="Quitar este color"
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white shadow"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={full}
          title={full ? "Máximo 64 colores" : "Añadir color"}
          className="grid h-9 w-9 place-items-center rounded-xl border border-dashed border-ink/30 text-ink/60 transition hover:border-brand hover:text-brand disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>

      {pattern.palette.length === 0 && (
        <p className="text-xs text-ink/50">Elige «+» para añadir tu primer color.</p>
      )}

      {open && (
        <div className="rounded-2xl border border-ink/10 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-paper px-3 py-1.5">
            <Search size={14} className="text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar color o código…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5 overflow-auto pr-1">
            {filtered.map((color) => {
              const used = usedIds.has(color.id);
              return (
                <button
                  key={color.id}
                  type="button"
                  title={`${color.id} · ${color.name}`}
                  onClick={() => {
                    onAdd(color);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="relative grid aspect-square place-items-center rounded-lg border border-ink/10 text-[10px] font-bold transition hover:scale-105"
                  style={{ background: color.hex, color: contrastInk(color.hex) }}
                >
                  {used ? <Check size={12} /> : color.symbol ?? ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
