// PROPIETARIO: Persona 4. Modo "hacer este patrón": progreso, colores y materiales.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Hand,
  Loader2,
  PartyPopper,
  Pencil,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { ApiError, api, downloadBlob } from "../api/client";
import type { PatternData, PostOut } from "../api/types";
import PatternCanvas from "../components/pattern/PatternCanvas";
import MaterialsList from "../features/editor/MaterialsList";
import ZoomPanView from "../features/editor/ZoomPanView";
import { colorCounts, contrastInk, fitZoomFor, HAMA_BOARD, linePoints } from "../features/editor/patternUtils";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";

const maskKey = (id: number) => `pp_make_${id}_done`;
const haveKey = (id: number) => `pp_make_${id}_have`;

function loadMask(id: number, size: number): Uint8Array {
  const mask = new Uint8Array(size);
  try {
    const raw = localStorage.getItem(maskKey(id));
    if (!raw) return mask;
    for (let i = 0; i < Math.min(raw.length, size); i++) mask[i] = raw[i] === "1" ? 1 : 0;
  } catch {
    /* sin progreso guardado */
  }
  return mask;
}

function saveMask(id: number, mask: Uint8Array) {
  // Trozos para no encadenar miles de strings de una en una.
  const parts: string[] = [];
  const chunk = 4096;
  for (let start = 0; start < mask.length; start += chunk) {
    let part = "";
    const end = Math.min(mask.length, start + chunk);
    for (let i = start; i < end; i++) part += mask[i] ? "1" : "0";
    parts.push(part);
  }
  try {
    localStorage.setItem(maskKey(id), parts.join(""));
  } catch {
    /* cuota llena */
  }
}

export default function MakePage() {
  const { id: idParam } = useParams();
  const postId = Number(idParam);
  const navigate = useNavigate();

  const [post, setPost] = useState<PostOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [mask, setMask] = useState<Uint8Array>(new Uint8Array(0));
  const [highlight, setHighlight] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const strokeValue = useRef<number | null>(null);
  const lastMark = useRef<{ x: number; y: number } | null>(null);
  const maskRef = useRef(mask);
  maskRef.current = mask;

  // ---------- cargar post ----------
  useEffect(() => {
    if (!Number.isFinite(postId)) {
      setError("Patrón no válido");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const load = async () => {
      try {
        const data = await api.getPost(postId);
        if (!alive) return;
        setPost(data);
        setMask(loadMask(postId, data.pattern.width * data.pattern.height));
        setZoom(fitZoomFor(data.pattern.width, data.pattern.height));
      } catch (err) {
        if (!alive) return;
        const message =
          err instanceof ApiError
            ? err.status === 404
              ? "Ese patrón no existe o ha sido borrado."
              : err.message || "No se pudo cargar el patrón."
            : "No se pudo cargar el patrón. Comprueba tu conexión.";
        setError(message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [postId]);

  // ---------- "ya lo tengo" ----------
  useEffect(() => {
    if (!post) return;
    try {
      const raw = localStorage.getItem(haveKey(postId));
      setHave(new Set<string>(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setHave(new Set());
    }
  }, [post, postId]);

  const toggleHave = useCallback(
    (colorId: string) => {
      setHave((prev) => {
        const next = new Set(prev);
        if (next.has(colorId)) next.delete(colorId);
        else next.add(colorId);
        try {
          localStorage.setItem(haveKey(postId), JSON.stringify([...next]));
        } catch {
          /* cuota llena */
        }
        return next;
      });
    },
    [postId],
  );

  // ---------- progreso ----------
  const pattern: PatternData | null = post?.pattern ?? null;

  // Guardar con debounce: marcar en 128×128 no debe serializar 16k celdas en cada pointermove.
  useEffect(() => {
    if (!mask.length) return;
    const t = window.setTimeout(() => saveMask(postId, maskRef.current), 400);
    return () => window.clearTimeout(t);
  }, [mask, postId]);

  useEffect(() => () => {
    if (maskRef.current.length) saveMask(postId, maskRef.current);
  }, [postId]);

  const stats = useMemo(() => {
    if (!pattern) return { total: 0, done: 0, pct: 0, perColor: [] as { done: number; total: number }[] };
    const counts = colorCounts(pattern);
    const perColor = counts.map((total) => ({ done: 0, total }));
    let total = 0;
    let done = 0;
    for (let i = 0; i < pattern.cells.length; i++) {
      const c = pattern.cells[i];
      if (c < 0) continue;
      total++;
      if (mask[i]) {
        done++;
        perColor[c].done++;
      }
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, perColor };
  }, [pattern, mask]);

  const applyMask = useCallback((next: Uint8Array) => {
    setMask(next);
  }, []);

  const markCells = useCallback((indices: number[], value: number) => {
    setMask((prev) => {
      const next = new Uint8Array(prev);
      for (const i of indices) next[i] = value;
      return next;
    });
  }, []);

  const cellHandler = (x: number, y: number, e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pattern || panMode) return;
    const W = pattern.width;
    const i = y * W + x;

    if (e.type === "pointerdown") {
      if (pattern.cells[i] < 0) {
        strokeValue.current = -1; // empezar en una celda vacía no marca nada
        lastMark.current = null;
        return;
      }
      strokeValue.current = maskRef.current[i] ? 0 : 1;
      lastMark.current = { x, y };
      markCells([i], strokeValue.current);
      return;
    }

    if (strokeValue.current === null || strokeValue.current < 0) return;
    const start = lastMark.current ?? { x, y };
    const indices: number[] = [];
    for (const point of linePoints(start.x, start.y, x, y)) {
      if (point.x < 0 || point.y < 0 || point.x >= W || point.y >= pattern.height) continue;
      const index = point.y * W + point.x;
      if (pattern.cells[index] >= 0) indices.push(index);
    }
    lastMark.current = { x, y };
    if (indices.length) markCells(indices, strokeValue.current);
  };

  useEffect(() => {
    const up = () => {
      strokeValue.current = null;
      lastMark.current = null;
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const markWholeLine = (kind: "row" | "col", index: number) => {
    if (!pattern) return;
    const indices: number[] = [];
    if (kind === "row") {
      for (let x = 0; x < pattern.width; x++) {
        const i = index * pattern.width + x;
        if (pattern.cells[i] >= 0) indices.push(i);
      }
    } else {
      for (let y = 0; y < pattern.height; y++) {
        const i = y * pattern.width + index;
        if (pattern.cells[i] >= 0) indices.push(i);
      }
    }
    if (!indices.length) return;
    setMask((prev) => {
      const allDone = indices.every((i) => prev[i]);
      const next = new Uint8Array(prev);
      const value = allDone ? 0 : 1;
      for (const i of indices) next[i] = value;
      return next;
    });
  };

  const exportPdf = async () => {
    if (!pattern) return;
    setNotice(null);
    setExportingPdf(true);
    try {
      const blob = await api.exportPattern(pattern, "pdf");
      downloadBlob(blob, `patron-${postId}.pdf`);
    } catch (err) {
      setNotice(
        err instanceof ApiError ? err.message : "No se pudo generar el PDF. Inténtalo de nuevo.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-28 rounded-full skeleton-shimmer" />
        <div className="h-8 w-64 max-w-full rounded-xl skeleton-shimmer" />
        <div className="h-72 w-full rounded-2xl skeleton-shimmer" />
        <Spinner label="Cargando patrón…" />
      </div>
    );
  }

  if (error || !post || !pattern) {
    return (
      <EmptyState
        icon={<AlertCircle size={26} />}
        title="No pudimos abrir este patrón"
        description={error ?? "No se pudo cargar el patrón."}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              to="/"
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:border-ink/25"
            >
              Volver al feed
            </Link>
            {Number.isFinite(postId) && (
              <Link
                to={`/create?remix=${postId}`}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
              >
                Crear mi versión
              </Link>
            )}
          </div>
        }
      />
    );
  }

  const isHama = pattern.craft === "hama";
  const cellSize = Math.max(4, Math.round(16 * zoom));
  const completed = stats.total > 0 && stats.done === stats.total;
  const unit = isHama ? "cuentas" : "puntadas";

  return (
    <div className="space-y-4 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/p/${postId}`}
            className="flex items-center gap-1 text-sm text-ink-soft transition hover:text-ink"
          >
            <ArrowLeft size={15} /> Volver al patrón
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-xl font-bold sm:text-2xl">Hacer: {post.title}</h1>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
              {isHama ? "HAMA" : "Punto de cruz"}
            </span>
          </div>
          <p className="text-sm text-ink-soft">
            {pattern.width} × {pattern.height} · {pattern.palette.length} colores ·{" "}
            {isHama ? "cuentas HAMA" : "punto de cruz"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanMode((v) => !v)}
            aria-pressed={panMode}
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${
              panMode ? "bg-ink text-white shadow-sm" : "bg-white text-ink-soft shadow-sm hover:text-ink"
            }`}
            title="Mover el lienzo en vez de marcar celdas"
          >
            {panMode ? <Hand size={16} /> : <Pencil size={16} />}
            {panMode ? "Moviendo" : "Marcando"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm text-ink-soft shadow-sm transition hover:text-ink"
          >
            <RotateCcw size={16} /> <span className="hidden sm:inline">Reiniciar</span>
          </button>
        </div>
      </header>

      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <Sparkles size={15} className="mt-0.5 shrink-0" /> {notice}
        </p>
      )}

      {completed && (
        <div className="animate-fade-in flex items-center gap-3 rounded-2xl border border-brand/25 bg-brand-soft px-4 py-3 text-brand">
          <PartyPopper size={22} className="shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">¡Patrón completado!</p>
            <p className="text-xs text-brand/80">
              Has hecho las {stats.total.toLocaleString("es-ES")} {unit}. Compártelo o prueba un remix.
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        aria-expanded={panelOpen}
        className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink-soft shadow-sm lg:hidden"
      >
        <span className="flex items-center gap-2">
          <Sparkles size={15} className="text-brand" />
          {panelOpen ? "Ocultar colores y materiales" : "Ver colores y materiales"}
        </span>
        <ChevronDown size={16} className={panelOpen ? "rotate-180 transition" : "transition"} />
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                Progreso <strong className="text-brand">{stats.pct}%</strong>
              </span>
              <span className="text-xs tabular-nums text-ink-soft">
                {stats.done.toLocaleString("es-ES")} / {stats.total.toLocaleString("es-ES")} {unit}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-ink/10"
              role="progressbar"
              aria-valuenow={stats.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso del patrón"
            >
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
            {completed && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand">
                <CheckCircle2 size={14} /> Todas las celdas marcadas
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-2 shadow-card">
            <ZoomPanView
              zoom={zoom}
              onZoom={(z) => setZoom(Math.max(0.25, Math.min(6, z)))}
              min={0.25}
              panEnabled={panMode}
            >
              <PatternCanvas
                pattern={pattern}
                cellSize={cellSize}
                showGrid
                showRulers
                showSymbols={!isHama}
                boardSize={isHama ? HAMA_BOARD : null}
                doneMask={mask}
                highlightIndex={highlight}
                onCellPointer={panMode ? undefined : cellHandler}
                onRulerPointer={panMode ? undefined : (kind, index) => markWholeLine(kind, index)}
                className="rounded-lg shadow-sm"
              />
            </ZoomPanView>
          </div>

          <p className="px-1 text-xs leading-relaxed text-ink-soft">
            Toca o arrastra para marcar celdas hechas. Toca un número de fila o columna para
            marcarla entera.
            {highlight !== null && " Modo por color activo: pulsa otro color o «Todos»."}
          </p>
        </div>

        <aside className={`space-y-3 ${panelOpen ? "" : "hidden"} lg:block`}>
          <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Por color</h2>
              <button
                type="button"
                onClick={() => setHighlight(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  highlight === null ? "bg-ink text-white" : "bg-ink/5 text-ink-soft hover:text-ink"
                }`}
              >
                Todos
              </button>
            </div>
            <ul className="space-y-1.5">
              {pattern.palette.map((color, i) => {
                const { done, total } = stats.perColor[i] ?? { done: 0, total: 0 };
                const pct = total ? Math.round((done / total) * 100) : 0;
                const active = highlight === i;
                return (
                  <li key={`${color.id}-${i}`}>
                    <button
                      type="button"
                      onClick={() => setHighlight(active ? null : i)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                        active ? "bg-brand/10 ring-1 ring-brand/40" : "hover:bg-ink/5"
                      }`}
                    >
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-ink/10 text-[10px] font-bold"
                        style={{ background: color.hex, color: contrastInk(color.hex) }}
                      >
                        {color.symbol ?? ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-medium">{color.name}</span>
                          <span className="tabular-nums text-ink-soft">
                            {done}/{total}
                          </span>
                        </span>
                        <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-ink/10">
                          <span className="block h-full bg-brand/70" style={{ width: `${pct}%` }} />
                        </span>
                      </span>
                      {pct === 100 && total > 0 && <Check size={14} className="shrink-0 text-brand" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <MaterialsList pattern={pattern} doneMask={mask} have={have} onToggleHave={toggleHave} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportPdf}
              disabled={exportingPdf}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm transition hover:border-ink/25 disabled:opacity-50"
            >
              {exportingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PDF
            </button>
            <button
              type="button"
              onClick={() => navigate(`/create?remix=${postId}`)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
            >
              <Shuffle size={16} /> Remix
            </button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="¿Borrar el progreso?"
        description={`Se desmarcarán las ${stats.done.toLocaleString("es-ES")} celdas que llevas hechas. Esta acción no se puede deshacer.`}
        confirmLabel="Borrar progreso"
        danger
        onConfirm={() => {
          applyMask(new Uint8Array(pattern.width * pattern.height));
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
