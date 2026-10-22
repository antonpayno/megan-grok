// Paso 2: imagen original + conversión con controles (ancho, colores, simplificar…).
import { useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import type { ConvertOptions, Craft, PatternData } from "../../api/types";
import PatternCanvas from "../../components/pattern/PatternCanvas";
import type { ConversionSource } from "./useImageConversion";

export interface ImageStepProps {
  craft: Craft;
  previewUrl: string | null;
  /** Tamaño real de la imagen en píxeles (naturalWidth/naturalHeight). */
  naturalSize?: { width: number; height: number } | null;
  pattern: PatternData | null;
  busy: boolean;
  error: string | null;
  options: ConvertOptions;
  source: ConversionSource | null;
  /** La vista previa viene del respaldo local (la API falló). */
  fallback?: boolean;
  onRetry?: () => void;
  onChange: (patch: Partial<ConvertOptions>) => void;
  /** Pone el ancho al tamaño real de la imagen (máx. 128). */
  onOriginalWidth?: () => void;
  onFile: (file: File) => void;
  onBack: () => void;
  onEdit: () => void;
}

const SIMPLIFY_LABELS = ["Foto", "Suave", "Dibujo", "Cómic"] as const;

export default function ImageStep({
  craft,
  previewUrl,
  naturalSize = null,
  pattern,
  busy,
  error,
  options,
  source,
  fallback = false,
  onRetry,
  onChange,
  onOriginalWidth,
  onFile,
  onBack,
  onEdit,
}: ImageStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const maxWidth = naturalSize ? Math.max(4, Math.min(128, naturalSize.width)) : 128;
  const expectedHeight =
    naturalSize && naturalSize.width > 0
      ? Math.max(1, Math.round((options.width * naturalSize.height) / naturalSize.width))
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-sm text-ink-soft shadow-sm transition hover:border-ink/25 hover:text-ink"
        >
          <ArrowLeft size={16} /> Cambiar origen
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {source === "backend" && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <Check size={12} /> Convertida en el servidor
            </span>
          )}
          <button
            type="button"
            onClick={onEdit}
            disabled={!pattern || busy}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-40"
          >
            Editar patrón
          </button>
        </div>
      </div>

      {fallback && (
        <div
          role="status"
          className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>Vista previa generada en tu dispositivo.</strong> El servidor no respondió, así
              que los colores y el detalle pueden no coincidir con la conversión real.
            </span>
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-white/70 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-white"
            >
              <RefreshCw size={12} /> Reintentar
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <p className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-full border border-red-300 bg-white/70 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-white"
            >
              <RefreshCw size={12} /> Reintentar
            </button>
          )}
        </div>
      )}

      <div
        className={`grid gap-4 rounded-3xl lg:grid-cols-[1fr_320px] ${
          dragging ? "ring-2 ring-brand/40 ring-offset-2 ring-offset-paper" : ""
        }`}
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
          <figure className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="flex h-56 items-center justify-center bg-ink/[0.03]">
              {previewUrl ? (
                <img src={previewUrl} alt="Imagen original" className="max-h-56 w-full object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-ink-soft">
                  <ImageIcon size={22} /> Sin imagen
                </span>
              )}
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-ink-soft">
              <span className="font-medium">Original</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-brand hover:underline"
              >
                <Upload size={13} /> Cambiar
              </button>
            </figcaption>
          </figure>

          <figure className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="relative flex h-56 items-center justify-center overflow-hidden bg-ink/[0.03] p-2">
              {pattern ? (
                <PatternPreview pattern={pattern} />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-ink-soft">
                  <Sparkles size={20} className="text-brand" />
                  Ajusta y verás la vista previa
                </span>
              )}
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-white/75 backdrop-blur-sm">
                  <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
                    <Loader2 className="animate-spin text-brand" size={16} /> Convirtiendo…
                  </span>
                </div>
              )}
            </div>
            <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-ink-soft">
              <span className="font-medium">Resultado</span>
              {pattern ? (
                <span>
                  {pattern.width} × {pattern.height} · {pattern.palette.length} colores
                </span>
              ) : (
                <span>—</span>
              )}
            </figcaption>
          </figure>
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-white p-4 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Ajustes</h2>

          <label className="block text-sm">
            <span className="flex items-center justify-between text-ink-soft">
              Ancho <strong className="text-ink">{options.width} celdas</strong>
            </span>
            <input
              type="range"
              min={4}
              max={maxWidth}
              value={options.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
              className="mt-2 w-full accent-brand"
            />
            <span className="mt-0.5 flex justify-between text-[10px] text-ink/40">
              <span>4</span>
              <span>{maxWidth}</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft">
            <span>
              {naturalSize
                ? `Imagen ${naturalSize.width} × ${naturalSize.height} px`
                : "Imagen sin cargar"}
              {expectedHeight !== null && (
                <>
                  {" · Salida "}
                  <strong className="text-ink">
                    {options.width} × {expectedHeight}
                  </strong>{" "}
                  celdas
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onOriginalWidth}
              disabled={!naturalSize || options.width >= maxWidth}
              className="rounded-full border border-line bg-white px-2.5 py-1 font-medium text-ink transition hover:border-brand/50 hover:text-brand disabled:opacity-40"
              title={
                naturalSize && naturalSize.width > 128
                  ? "Máximo permitido: 128 celdas de ancho"
                  : "1 píxel = 1 celda"
              }
            >
              Tamaño original
            </button>
          </div>

          <label className="block text-sm">
            <span className="flex items-center justify-between text-ink-soft">
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
            <span className="mt-0.5 flex justify-between text-[10px] text-ink/40">
              <span>2</span>
              <span>64</span>
            </span>
          </label>

          <label className="block text-sm">
            <span className="flex items-center justify-between text-ink-soft">
              Estilo
              <strong className="text-ink">{SIMPLIFY_LABELS[options.simplify]}</strong>
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
            <span className="mt-0.5 flex justify-between text-[10px] text-ink/40">
              <span>Foto</span>
              <span>Cómic</span>
            </span>
          </label>

          <div className="space-y-2 border-t border-line pt-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={!!options.outline}
                onChange={(e) => onChange({ outline: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
              Contorno oscuro
            </label>
          </div>

          <p className="flex items-start gap-1.5 rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-brand" />
            Para {craft === "hama" ? "HAMA" : "punto de cruz"} conviene poca resolución y 8–16
            colores.
          </p>

          {busy && (
            <p className="flex items-center gap-1.5 text-xs text-ink-soft" role="status">
              <Loader2 size={13} className="animate-spin" /> Actualizando la vista previa…
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

/** Vista previa que cabe entera en el hueco, centrada y sin deformar. */
function PatternPreview({ pattern }: { pattern: PatternData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(4);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      const next = Math.floor(Math.min(width / pattern.width, height / pattern.height));
      setCellSize(Math.max(1, Math.min(32, next)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [pattern.width, pattern.height]);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <PatternCanvas pattern={pattern} cellSize={cellSize} className="rounded [image-rendering:pixelated]" />
    </div>
  );
}
