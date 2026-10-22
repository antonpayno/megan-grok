// Paso 2: imagen original + conversión con controles (ancho, colores, simplificar…).
import { useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, Sparkles, Upload } from "lucide-react";
import type { ConvertOptions, Craft, PatternData } from "../../api/types";
import PatternCanvas from "../../components/pattern/PatternCanvas";

export interface ImageStepProps {
  craft: Craft;
  previewUrl: string | null;
  pattern: PatternData | null;
  busy: boolean;
  error: string | null;
  options: ConvertOptions;
  source: "backend" | "local";
  onChange: (patch: Partial<ConvertOptions>) => void;
  onFile: (file: File) => void;
  onBack: () => void;
  onEdit: () => void;
}

export default function ImageStep({
  craft,
  previewUrl,
  pattern,
  busy,
  error,
  options,
  source,
  onChange,
  onFile,
  onBack,
  onEdit,
}: ImageStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
        >
          <ArrowLeft size={16} /> Cambiar origen
        </button>
        <div className="flex items-center gap-2">
          {source === "local" && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
              Conversión local (P2 aún no conectado)
            </span>
          )}
          <button
            type="button"
            onClick={onEdit}
            disabled={!pattern}
            className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-40"
          >
            Editar patrón
          </button>
        </div>
      </div>

      <div
        className={`grid gap-4 lg:grid-cols-[1fr_320px] ${dragging ? "ring-2 ring-brand/40" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith("image/")) onFile(file);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <div className="flex h-56 items-center justify-center bg-ink/5">
              {previewUrl ? (
                <img src={previewUrl} alt="Imagen original" className="max-h-56 w-full object-contain" />
              ) : (
                <span className="text-sm text-ink/40">Sin imagen</span>
              )}
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-ink/55">
              <span>Original</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-brand hover:underline"
              >
                <Upload size={13} /> Cambiar
              </button>
            </figcaption>
          </figure>

          <figure className="relative overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <div className="flex h-56 items-center justify-center bg-ink/5 p-2">
              {pattern ? (
                <PatternCanvas pattern={pattern} fit className="max-h-52 w-auto" />
              ) : (
                <span className="text-sm text-ink/40">Sin resultado</span>
              )}
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm">
                  <Loader2 className="animate-spin text-brand" size={26} />
                </div>
              )}
            </div>
            <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-ink/55">
              <span>Resultado</span>
              {pattern && (
                <span>
                  {pattern.width} × {pattern.height} · {pattern.palette.length} colores
                </span>
              )}
            </figcaption>
          </figure>
        </div>

        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Ajustes</h2>

          <label className="block text-sm">
            <span className="flex items-center justify-between text-ink/60">
              Ancho <strong className="text-ink">{options.width} celdas</strong>
            </span>
            <input
              type="range"
              min={4}
              max={128}
              value={options.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
              className="mt-2 w-full accent-brand"
            />
          </label>

          <label className="block text-sm">
            <span className="flex items-center justify-between text-ink/60">
              Colores <strong className="text-ink">{options.max_colors}</strong>
            </span>
            <input
              type="range"
              min={2}
              max={64}
              value={options.max_colors}
              onChange={(e) => onChange({ max_colors: Number(e.target.value) })}
              className="mt-2 w-full accent-brand"
            />
          </label>

          <label className="block text-sm">
            <span className="flex items-center justify-between text-ink/60">
              Simplificar{" "}
              <strong className="text-ink">
                {["Foto", "Suave", "Dibujo", "Cómic"][options.simplify]}
              </strong>
            </span>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={options.simplify}
              onChange={(e) => onChange({ simplify: Number(e.target.value) as 0 | 1 | 2 | 3 })}
              className="mt-2 w-full accent-brand"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={!!options.outline}
              onChange={(e) => onChange({ outline: e.target.checked })}
              className="h-4 w-4 accent-brand"
            />
            Contorno oscuro
          </label>

          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={!!options.remove_background}
              onChange={(e) => onChange({ remove_background: e.target.checked })}
              className="h-4 w-4 accent-brand"
            />
            Quitar fondo
          </label>

          <p className="flex items-start gap-1.5 rounded-xl bg-paper px-3 py-2 text-xs text-ink/50">
            <Sparkles size={13} className="mt-0.5 shrink-0" />
            Para {craft === "hama" ? "HAMA" : "punto de cruz"} conviene poca resolución y 8–16 colores.
          </p>

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
