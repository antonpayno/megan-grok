// PROPIETARIO: Persona 4. Crear patrón: desde imagen o dibujando, y publicarlo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Keyboard,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { ApiError, api, downloadBlob } from "../api/client";
import type { ConvertOptions, Craft, PaletteColor, PatternData } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import PatternCanvas from "../components/pattern/PatternCanvas";
import StartStep from "../features/editor/StartStep";
import ImageStep from "../features/editor/ImageStep";
import EditorToolbar from "../features/editor/EditorToolbar";
import ColorPicker from "../features/editor/ColorPicker";
import MaterialsList from "../features/editor/MaterialsList";
import PublishDialog, { type PublishData } from "../features/editor/PublishDialog";
import ZoomPanView, { clampZoom } from "../features/editor/ZoomPanView";
import { usePatternEditor } from "../features/editor/usePatternEditor";
import { usePalettes } from "../features/editor/usePalettes";
import { useImageConversion } from "../features/editor/useImageConversion";
import { patternToPngBlob } from "../features/editor/exportLocal";
import { createBlankPattern, fitZoomFor, normalizePattern } from "../features/editor/patternUtils";

type Step = "start" | "image" | "editor";

const DRAFT_KEY = "pp_draft_v1";

interface Draft {
  v: 1;
  step: Step;
  craft: Craft;
  pattern: PatternData | null;
  title: string;
  description: string;
  tags: string[];
  remixOf: number | null;
  imageName?: string;
  options?: ConvertOptions;
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (draft?.v !== 1 || !draft.pattern) return null;
    return { ...draft, pattern: normalizePattern(draft.pattern) };
  } catch {
    return null;
  }
}

interface StrokeState {
  active: boolean;
  lastX: number;
  lastY: number;
  pendingX: number;
  pendingY: number;
  raf: number;
}

const EMPTY_STROKE: StrokeState = { active: false, lastX: 0, lastY: 0, pendingX: 0, pendingY: 0, raf: 0 };

export default function CreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const remixParam = params.get("remix");
  const { user } = useAuth();
  const { colorsFor, paletteIdFor } = usePalettes();

  const [step, setStep] = useState<Step>("start");
  const [craft, setCraft] = useState<Craft>("hama");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<ConvertOptions>({
    craft: "hama",
    width: 29,
    max_colors: 12,
    simplify: 2,
    outline: false,
  });
  const [zoom, setZoom] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [remixOf, setRemixOf] = useState<number | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const restored = useRef(false);

  const editor = usePatternEditor(useMemo(() => createBlankPattern("hama", 29), []));
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const { pattern, tool, colorIndex } = editor;

  const conversion = useImageConversion(file, options, craft, paletteIdFor(craft));
  const stroke = useRef<StrokeState>({ ...EMPTY_STROKE });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyZoomFor = useCallback((w: number, h: number) => {
    setZoom(fitZoomFor(w, h));
  }, []);

  // ---------- borrador ----------
  const saveDraft = useCallback(() => {
    const payload: Draft = {
      v: 1,
      step,
      craft,
      pattern: editor.pattern,
      title,
      description,
      tags,
      remixOf,
      imageName: file?.name,
      options,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setDraft(payload);
    } catch {
      /* cuota llena: seguimos sin borrador */
    }
  }, [step, craft, editor.pattern, title, description, tags, remixOf, file, options]);

  useEffect(() => {
    // No pisar el borrador guardado al entrar de cero o al abrir un remix.
    if (remixParam) return;
    if (step === "start" && !editor.pattern.cells.some((c) => c >= 0)) return;
    const t = window.setTimeout(saveDraft, 500);
    return () => window.clearTimeout(t);
  }, [saveDraft, step, remixParam, editor.pattern]);

  // restaurar borrador al entrar (salvo que vengamos de un remix)
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (remixParam) return;
    const stored = readDraft();
    if (!stored) return;
    setDraft(stored);
    setCraft(stored.craft);
    setTitle(stored.title);
    setDescription(stored.description);
    setTags(stored.tags);
    setRemixOf(stored.remixOf);
    if (stored.options) {
      const restoredOptions = { ...stored.options };
      delete restoredOptions.remove_background;
      setOptions(restoredOptions);
    }
    if (stored.pattern && stored.pattern.cells.some((c) => c >= 0)) {
      editorRef.current.load(stored.pattern, { resetHistory: true });
      applyZoomFor(stored.pattern.width, stored.pattern.height);
      // El paso "imagen" no se puede restaurar (el File no se guarda): si hay patrón,
      // volvemos directamente al editor.
      setStep("editor");
    }
  }, [remixParam, applyZoomFor]);

  const resumeDraft = () => {
    if (!draft?.pattern) return;
    editor.load(draft.pattern, { resetHistory: true });
    applyZoomFor(draft.pattern.width, draft.pattern.height);
    setStep("editor");
  };

  // ---------- remix ----------
  useEffect(() => {
    if (!remixParam) return;
    const id = Number(remixParam);
    if (!Number.isFinite(id)) return;
    let alive = true;
    const load = async () => {
      try {
        const post = await api.getPost(id);
        if (!alive) return;
        setCraft(post.pattern.craft);
        editorRef.current.load(post.pattern, { resetHistory: true });
        applyZoomFor(post.pattern.width, post.pattern.height);
        setRemixOf(post.id);
        setTitle(`${post.title} (remix)`.slice(0, 80));
        setStep("editor");
      } catch (err) {
        if (!alive) return;
        const message =
          err instanceof ApiError && err.status === 404
            ? "Ese patrón ya no existe."
            : err instanceof ApiError && err.status === 401
              ? "Inicia sesión para remezclar este patrón."
              : "No se pudo cargar el patrón para el remix.";
        setNotice(message);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [remixParam, applyZoomFor]);

  // ---------- imagen ----------
  const onPickFile = (f: File) => {
    setFile(f);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    setOptions((o) => ({ ...o, craft }));
    setStep("image");
  };

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // ---------- editor: puntero ----------
  const finishStroke = useCallback(() => {
    const s = stroke.current;
    if (s.raf) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    }
    if (s.active && (s.pendingX !== s.lastX || s.pendingY !== s.lastY)) {
      editorRef.current.paintPath(s.lastX, s.lastY, s.pendingX, s.pendingY);
    }
    stroke.current = { ...EMPTY_STROKE };
    editorRef.current.endStroke();
  }, []);

  const cellHandler = (x: number, y: number, e: React.PointerEvent<HTMLCanvasElement>) => {
    const ed = editorRef.current;
    if (tool === "picker") {
      if (e.type === "pointerdown") ed.pickAt(x, y);
      return;
    }
    if (tool === "fill") {
      if (e.type === "pointerdown") ed.fillAt(x, y);
      return;
    }
    if (tool === "pan") return;

    if (e.type === "pointerdown") {
      finishStroke();
      ed.beginStroke();
      ed.paint(x, y);
      stroke.current = { active: true, lastX: x, lastY: y, pendingX: x, pendingY: y, raf: 0 };
      return;
    }

    const s = stroke.current;
    if (!s.active) return;
    s.pendingX = x;
    s.pendingY = y;
    if (s.raf) return;
    // Coalescemos varios pointermove en un frame: trazo continuo y sin re-renders de más.
    s.raf = requestAnimationFrame(() => {
      const current = stroke.current;
      current.raf = 0;
      if (!current.active) return;
      editorRef.current.paintPath(current.lastX, current.lastY, current.pendingX, current.pendingY);
      current.lastX = current.pendingX;
      current.lastY = current.pendingY;
    });
  };

  useEffect(() => {
    const up = () => finishStroke();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (stroke.current.raf) cancelAnimationFrame(stroke.current.raf);
    };
  }, [finishStroke]);

  useEffect(() => {
    if (step !== "editor") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const ed = editorRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        ed.redo();
        return;
      }
      const map: Record<string, typeof tool> = { "1": "pencil", "2": "eraser", "3": "fill", "4": "picker", "5": "pan" };
      if (map[e.key]) ed.setTool(map[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // ---------- acciones ----------
  const openBlank = (width: number, height: number) => {
    editor.load(createBlankPattern(craft, width, height), { resetHistory: true });
    applyZoomFor(width, height);
    setStep("editor");
  };

  const startFromImage = () => {
    fileInputRef.current?.click();
  };

  const goEdit = () => {
    if (!conversion.pattern) return;
    editor.load(conversion.pattern, { resetHistory: true });
    applyZoomFor(conversion.pattern.width, conversion.pattern.height);
    setStep("editor");
  };

  const handleExport = async (format: "png" | "pdf") => {
    setExporting(true);
    setNotice(null);
    try {
      const blob = await api.exportPattern(editor.pattern, format);
      downloadBlob(blob, `pixel-pattern.${format}`);
    } catch (err) {
      if (format === "png") {
        try {
          const blob = await patternToPngBlob(editor.pattern, 20);
          downloadBlob(blob, "pixel-pattern.png");
          setNotice("PNG generado en tu dispositivo (el servidor no respondió).");
        } catch {
          setNotice("No se pudo exportar el PNG.");
        }
      } else {
        setNotice(
          err instanceof ApiError ? err.message : "No se pudo exportar el PDF. Inténtalo de nuevo.",
        );
      }
    } finally {
      setExporting(false);
    }
  };

  const handlePublishClick = () => {
    if (!user) {
      saveDraft();
      navigate("/login?next=/create");
      return;
    }
    setPublishError(null);
    setPublishOpen(true);
  };

  const handlePublish = async (data: PublishData) => {
    setPublishing(true);
    setPublishError(null);
    try {
      const post = await api.createPost({
        title: data.title,
        description: data.description,
        tags: data.tags,
        pattern: editor.pattern,
        remix_of: remixOf,
      });
      localStorage.removeItem(DRAFT_KEY);
      setDraft(null);
      navigate(`/p/${post.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Tu sesión ha caducado. Inicia sesión otra vez."
            : err.message
          : "No se pudo publicar el patrón. Comprueba tu conexión.";
      setPublishError(message);
      saveDraft();
    } finally {
      setPublishing(false);
    }
  };

  const hasContent = useMemo(() => pattern.cells.some((c) => c >= 0), [pattern]);
  const cellSize = Math.max(4, Math.round(16 * zoom));
  const allColors: PaletteColor[] = colorsFor(craft);

  return (
    <div className="space-y-4 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
            Estudio de patrones
          </p>
          <h1 className="mt-0.5 text-xl font-bold sm:text-2xl">
            {step === "editor" ? "Editor de patrón" : step === "image" ? "Desde imagen" : "Crear patrón"}
          </h1>
          <p className="text-sm text-ink-soft">
            {remixOf
              ? `Remix del patrón #${remixOf}`
              : step === "editor"
                ? "Pinta, ajusta colores y publica. Se guarda solo."
                : "Elige técnica y empieza en blanco o desde una foto."}
          </p>
        </div>
        {step === "editor" && (
          <button
            type="button"
            onClick={() => setStep("start")}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-sm text-ink-soft shadow-sm transition hover:border-ink/25 hover:text-ink"
          >
            <ArrowLeft size={16} /> <span className="hidden sm:inline">Empezar de nuevo</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        )}
      </header>

      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <Sparkles size={15} className="mt-0.5 shrink-0" /> {notice}
        </p>
      )}

      {step === "start" && (
        <StartStep
          craft={craft}
          onCraft={(c) => {
            setCraft(c);
            setOptions((o) => ({ ...o, craft: c }));
          }}
          onBlank={openBlank}
          onPickImage={startFromImage}
          onFile={onPickFile}
          draftInfo={
            draft?.pattern?.cells.some((c) => c >= 0)
              ? `${draft.pattern.width} × ${draft.pattern.height} · ${draft.pattern.palette.length} colores`
              : null
          }
          onResumeDraft={resumeDraft}
        />
      )}

      {step === "image" && (
        <ImageStep
          craft={craft}
          previewUrl={previewUrl}
          pattern={conversion.pattern}
          busy={conversion.busy}
          error={conversion.error}
          options={options}
          source={conversion.source}
          fallback={conversion.fallback}
          onRetry={conversion.retry}
          onChange={(patch) => setOptions((o) => ({ ...o, ...patch }))}
          onFile={onPickFile}
          onBack={() => setStep("start")}
          onEdit={goEdit}
        />
      )}

      {step === "editor" && (
        <>
          <div className="sticky top-14 z-20 -mx-3 border-b border-line bg-paper/95 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <EditorToolbar
              tool={tool}
              onTool={editor.setTool}
              canUndo={editor.canUndo}
              canRedo={editor.canRedo}
              onUndo={editor.undo}
              onRedo={editor.redo}
              symmetry={editor.symmetry}
              onSymmetry={editor.setSymmetry}
              width={pattern.width}
              height={pattern.height}
              onResize={(w, h) => {
                editor.resize(w, h);
                applyZoomFor(w, h);
              }}
              onClear={editor.clear}
              onExport={handleExport}
              exporting={exporting}
              onPublish={handlePublishClick}
              canPublish={hasContent}
            />
          </div>

          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft shadow-sm lg:hidden"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={15} className="text-brand" />
              {panelOpen ? "Ocultar materiales y ayuda" : "Ver materiales y ayuda"}
            </span>
            <ChevronDown size={16} className={panelOpen ? "rotate-180 transition" : "transition"} />
          </button>

          {pattern.palette.length === 0 && (
            <p className="flex items-start gap-2 rounded-2xl border border-brand/20 bg-brand-soft/60 px-3 py-2 text-sm text-brand">
              <Plus size={16} className="mt-0.5 shrink-0" />
              El lienzo está vacío: añade tu primer color con el botón <strong>+</strong> de la paleta y
              empieza a pintar.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-line bg-white p-2 shadow-card">
                <ZoomPanView
                  zoom={zoom}
                  onZoom={(z) => setZoom(clampZoom(z, 0.25, 6))}
                  min={0.25}
                  panEnabled={tool === "pan"}
                >
                  <PatternCanvas
                    pattern={pattern}
                    cellSize={cellSize}
                    showGrid
                    showSymbols={pattern.craft === "cross_stitch"}
                    onCellPointer={cellHandler}
                    className="rounded-lg shadow-sm"
                  />
                </ZoomPanView>
              </div>

              <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
                <div className="mb-2 flex items-center justify-between text-xs text-ink-soft">
                  <span className="font-semibold uppercase tracking-wide">Colores del patrón</span>
                  <span>
                    {pattern.palette.length} colores · {pattern.width} × {pattern.height}
                  </span>
                </div>
                <ColorPicker
                  pattern={pattern}
                  colorIndex={colorIndex}
                  onSelect={editor.setColorIndex}
                  onAdd={editor.addColor}
                  onRemove={editor.removeColor}
                  allColors={allColors}
                />
              </div>
            </div>

            <aside className={`space-y-3 ${panelOpen ? "" : "hidden"} lg:block`}>
              <MaterialsList pattern={pattern} showBoards={pattern.craft === "hama"} />

              <div className="rounded-2xl border border-line bg-white p-4 text-sm text-ink-soft shadow-card">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink/60">
                  <Keyboard size={15} /> Atajos
                </h2>
                <ul className="space-y-1 text-xs">
                  <li>1–5 · lápiz, goma, cubo, cuentagotas, mover</li>
                  <li>Ctrl+Z / Ctrl+Shift+Z · deshacer / rehacer</li>
                  <li>Rueda del ratón · zoom</li>
                  <li>Arrastra con «Mover» para recorrer el lienzo</li>
                </ul>
                {!hasContent && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    Añade un color con «+» y pinta alguna celda para poder publicar.
                  </p>
                )}
              </div>

              {publishing && (
                <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">
                  <Loader2 size={14} className="animate-spin" /> Publicando…
                </p>
              )}
            </aside>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />

      <PublishDialog
        open={publishOpen}
        busy={publishing}
        error={publishError}
        initial={{ title, description, tags }}
        isRemix={remixOf !== null}
        onClose={() => setPublishOpen(false)}
        onSubmit={handlePublish}
      />
    </div>
  );
}
