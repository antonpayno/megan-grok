// Paso 1 del flujo de creación: técnica, lienzo en blanco o desde imagen.
import { Camera, Image as ImageIcon, Sparkles } from "lucide-react";
import type { Craft } from "../../api/types";
import { PRESET_SIZES } from "./fallbackPalette";

export interface StartStepProps {
  craft: Craft;
  onCraft: (c: Craft) => void;
  onBlank: (width: number, height: number) => void;
  onPickImage: () => void;
  draftInfo?: string | null;
  onResumeDraft?: () => void;
}

export default function StartStep({
  craft,
  onCraft,
  onBlank,
  onPickImage,
  draftInfo,
  onResumeDraft,
}: StartStepProps) {
  const presets = PRESET_SIZES[craft];

  return (
    <div className="space-y-6">
      {draftInfo && onResumeDraft && (
        <button
          type="button"
          onClick={onResumeDraft}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 px-4 py-3 text-left text-sm text-brand transition hover:bg-brand/10"
        >
          <span>
            <strong>Continuar borrador</strong> · {draftInfo}
          </span>
          <span aria-hidden>→</span>
        </button>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">Técnica</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { id: "hama" as Craft, title: "Cuentas HAMA", desc: "Placas de 29 × 29, cuentas redondas." },
              {
                id: "cross_stitch" as Craft,
                title: "Punto de cruz",
                desc: "Rejilla con símbolos y colores DMC.",
              },
            ]
          ).map((option) => {
            const selected = craft === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onCraft(option.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-brand bg-white shadow-sm ring-2 ring-brand/30"
                    : "border-ink/10 bg-white/70 hover:border-ink/25"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{option.title}</span>
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      selected ? "border-brand bg-brand" : "border-ink/25"
                    }`}
                  />
                </div>
                <p className="mt-1 text-sm text-ink/55">{option.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">Empezar</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <h3 className="font-semibold">Lienzo en blanco</h3>
            <p className="mt-1 text-sm text-ink/55">Dibuja punto a punto con el pincel.</p>
            <div className="mt-3 grid gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onBlank(preset.width, preset.height)}
                  className="rounded-xl border border-ink/10 px-3 py-2 text-left text-sm transition hover:border-brand hover:bg-brand/5"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-ink/10 bg-white p-4">
            <h3 className="font-semibold">Desde imagen</h3>
            <p className="mt-1 text-sm text-ink/55">
              Sube una foto y la convertimos en un dibujo con pocos colores reales.
            </p>
            <button
              type="button"
              onClick={onPickImage}
              className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/20 px-4 py-6 text-ink/60 transition hover:border-brand hover:text-brand"
            >
              <span className="flex items-center gap-2">
                <ImageIcon size={20} /> Elegir imagen
              </span>
              <span className="flex items-center gap-1 text-xs">
                <Camera size={13} /> o haz una foto desde el móvil
              </span>
            </button>
            <p className="mt-2 flex items-center gap-1 text-xs text-ink/40">
              <Sparkles size={12} /> JPG, PNG, WebP · hasta 128 × 128 celdas
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
