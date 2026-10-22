// Diálogo de publicación del patrón (título, descripción y tags).
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";

export interface PublishData {
  title: string;
  description: string;
  tags: string[];
}

export interface PublishDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  initial?: PublishData;
  isRemix?: boolean;
  onClose: () => void;
  onSubmit: (data: PublishData) => void;
}

export default function PublishDialog({
  open,
  busy,
  error,
  initial,
  isRemix = false,
  onClose,
  onSubmit,
}: PublishDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setTags(initial?.tags ?? []);
    setTagDraft("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const addTag = () => {
    const raw = tagDraft.trim().replace(/^#/, "").toLowerCase();
    if (!raw) return;
    if (tags.includes(raw) || tags.length >= 10) {
      setTagDraft("");
      return;
    }
    setTags([...tags, raw]);
    setTagDraft("");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{isRemix ? "Publicar tu remix" : "Publicar patrón"}</h2>
            <p className="text-sm text-ink/55">Se verá en el feed y cualquiera podrá hacerlo.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-ink/50 hover:bg-ink/5"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ title: title.trim(), description: description.trim(), tags });
          }}
        >
          <label className="block text-sm">
            <span className="text-ink/60">Título</span>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
              placeholder="Gato pixelado"
              className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink/60">Descripción</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Cuenta cómo lo has hecho, colores, nivel…"
              className="mt-1 w-full resize-none rounded-xl border border-ink/15 px-3 py-2 outline-none focus:border-brand"
            />
          </label>

          <div className="text-sm">
            <span className="text-ink/60">Tags</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-ink/15 px-2 py-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-xs font-medium text-brand-dark"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="text-brand/70 hover:text-brand-dark"
                    aria-label={`Quitar ${tag}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === " ") {
                    e.preventDefault();
                    addTag();
                  } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                placeholder={tags.length ? "" : "gato, hama, kawaii…"}
                className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-ink/45">Enter para añadir. Máximo 10.</p>
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm text-ink/60 hover:bg-ink/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="flex items-center gap-2 rounded-xl bg-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Publicar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
