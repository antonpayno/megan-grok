// Barra de herramientas del editor: lápiz, goma, cubo, cuentagotas, mano,
// deshacer/rehacer, simetría, redimensionar, exportar y publicar.
import { useState } from "react";
import {
  Download, Eraser, FlipHorizontal2, Hand, Maximize2, PaintBucket, Pencil,
  Pipette, Redo2, Share2, Trash2, Undo2,
} from "lucide-react";
import type { EditorTool } from "./usePatternEditor";

export interface EditorToolbarProps {
  tool: EditorTool;
  onTool: (t: EditorTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  symmetry: boolean;
  onSymmetry: (v: boolean) => void;
  width: number;
  height: number;
  onResize: (w: number, h: number) => void;
  onClear: () => void;
  onExport: (format: "png" | "pdf") => void;
  exporting: boolean;
  onPublish: () => void;
  canPublish: boolean;
}

const TOOLS: { id: EditorTool; label: string; icon: typeof Pencil; hint: string }[] = [
  { id: "pencil", label: "Lápiz", icon: Pencil, hint: "Pinta (1)" },
  { id: "eraser", label: "Goma", icon: Eraser, hint: "Borra (2)" },
  { id: "fill", label: "Cubo", icon: PaintBucket, hint: "Rellenar (3)" },
  { id: "picker", label: "Cuentagotas", icon: Pipette, hint: "Coger color (4)" },
  { id: "pan", label: "Mover", icon: Hand, hint: "Desplazar (5)" },
];

export default function EditorToolbar({
  tool,
  onTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  symmetry,
  onSymmetry,
  width,
  height,
  onResize,
  onClear,
  onExport,
  exporting,
  onPublish,
  canPublish,
}: EditorToolbarProps) {
  const [resizeOpen, setResizeOpen] = useState(false);
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-2xl bg-ink/5 p-1">
          {TOOLS.map(({ id, label, icon: Icon, hint }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTool(id)}
              title={`${label} · ${hint}`}
              aria-pressed={tool === id}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition ${
                tool === id ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              <Icon size={17} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-2xl bg-ink/5 p-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            className="rounded-xl px-2.5 py-2 text-ink/70 transition hover:bg-white/70 disabled:opacity-30"
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Shift+Z)"
            className="rounded-xl px-2.5 py-2 text-ink/70 transition hover:bg-white/70 disabled:opacity-30"
          >
            <Redo2 size={17} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSymmetry(!symmetry)}
          title="Simetría horizontal"
          aria-pressed={symmetry}
          className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm transition ${
            symmetry ? "bg-brand text-white shadow-sm" : "bg-ink/5 text-ink/70 hover:text-ink"
          }`}
        >
          <FlipHorizontal2 size={17} /> <span className="hidden sm:inline">Simetría</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setW(width);
            setH(height);
            setResizeOpen((v) => !v);
          }}
          title="Redimensionar lienzo"
          className="flex items-center gap-1.5 rounded-2xl bg-ink/5 px-3 py-2 text-sm text-ink/70 transition hover:text-ink"
        >
          <Maximize2 size={16} /> <span className="hidden sm:inline">Tamaño</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (confirm("¿Vaciar el patrón? Podrás deshacerlo.")) onClear();
          }}
          title="Vaciar"
          className="flex items-center gap-1.5 rounded-2xl bg-ink/5 px-3 py-2 text-sm text-ink/70 transition hover:text-ink"
        >
          <Trash2 size={16} />
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onExport("png")}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-2xl border border-ink/15 px-3 py-2 text-sm text-ink/80 transition hover:border-ink/40 disabled:opacity-40"
          >
            <Download size={16} /> PNG
          </button>
          <button
            type="button"
            onClick={() => onExport("pdf")}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-2xl border border-ink/15 px-3 py-2 text-sm text-ink/80 transition hover:border-ink/40 disabled:opacity-40"
          >
            <Download size={16} /> PDF
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={!canPublish}
            className="flex items-center gap-1.5 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-40"
          >
            <Share2 size={16} /> Publicar
          </button>
        </div>
      </div>

      {resizeOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-3">
          <label className="text-xs text-ink/60">
            Ancho
            <input
              type="number"
              min={1}
              max={128}
              value={w}
              onChange={(e) => setW(Number(e.target.value))}
              className="mt-1 block w-24 rounded-lg border border-ink/15 px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-ink/60">
            Alto
            <input
              type="number"
              min={1}
              max={128}
              value={h}
              onChange={(e) => setH(Number(e.target.value))}
              className="mt-1 block w-24 rounded-lg border border-ink/15 px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              onResize(Math.max(1, Math.min(128, w)), Math.max(1, Math.min(128, h)));
              setResizeOpen(false);
            }}
            className="rounded-xl bg-ink px-3 py-2 text-sm text-white"
          >
            Aplicar
          </button>
          <p className="text-xs text-ink/45">Se conserva la esquina superior izquierda.</p>
        </div>
      )}
    </div>
  );
}
