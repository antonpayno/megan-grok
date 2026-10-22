// PROPIETARIO: Persona 4. Modo "hacer este patrón": progreso, colores y materiales.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Check, Download, Hand, Loader2, Pencil, RotateCcw, Shuffle,
  Sparkles,
} from "lucide-react";
import { ApiError, api, downloadBlob } from "../api/client";
import type { PatternData, PostOut } from "../api/types";
import { mockPost } from "../api/mocks";
import PatternCanvas from "../components/pattern/PatternCanvas";
import MaterialsList from "../features/editor/MaterialsList";
import ZoomPanView from "../features/editor/ZoomPanView";
import { contrastInk, HAMA_BOARD, colorCounts } from "../features/editor/patternUtils";
import { getLocalPost, toPostOut } from "../features/editor/localPosts";

const USE_MOCKS = import.meta.env.VITE_MOCKS === "1";

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
  let s = "";
  for (let i = 0; i < mask.length; i++) s += mask[i] ? "1" : "0";
  try {
    localStorage.setItem(maskKey(id), s);
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
  const strokeValue = useRef<number | null>(null);

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
        let data: PostOut;
        if (USE_MOCKS) {
          data = mockPost(postId);
        } else {
          try {
            data = await api.getPost(postId);
          } catch (err) {
            const local = getLocalPost(postId);
            if (!local) throw err;
            data = toPostOut(local);
          }
        }
        if (!alive) return;
        setPost(data);
        setMask(loadMask(postId, data.pattern.width * data.pattern.height));
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof ApiError && err.status === 501
            ? "El backend social (P3) todavía no sirve patrones. Vuelve cuando conecten el feed."
            : err instanceof ApiError && err.status === 404
              ? "Ese patrón no existe."
              : "No se pudo cargar el patrón.",
        );
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

  const applyMask = useCallback(
    (next: Uint8Array) => {
      setMask(next);
      saveMask(postId, next);
    },
    [postId],
  );

  const markCells = useCallback(
    (indices: number[], value: number) => {
      setMask((prev) => {
        const next = new Uint8Array(prev);
        for (const i of indices) next[i] = value;
        saveMask(postId, next);
        return next;
      });
    },
    [postId],
  );

  const cellHandler = (x: number, y: number, e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pattern || panMode) return;
    const i = y * pattern.width + x;
    if (pattern.cells[i] < 0) return; // las celdas vacías no se marcan
    if (e.type === "pointerdown") strokeValue.current = mask[i] ? 0 : 1;
    const value = strokeValue.current ?? 1;
    markCells([i], value);
  };

  useEffect(() => {
    const up = () => {
      strokeValue.current = null;
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const markWholeRow = (row: number) => {
    if (!pattern) return;
    const indices: number[] = [];
    let allDone = true;
    for (let x = 0; x < pattern.width; x++) {
      const i = row * pattern.width + x;
      if (pattern.cells[i] < 0) continue;
      indices.push(i);
      if (!mask[i]) allDone = false;
    }
    if (!indices.length) return;
    markCells(indices, allDone ? 0 : 1);
  };

  const restart = () => {
    if (!pattern) return;
    if (!confirm("¿Seguro que quieres borrar el progreso de este patrón?")) return;
    applyMask(new Uint8Array(pattern.width * pattern.height));
  };

  const exportPdf = async () => {
    if (!pattern) return;
    setNotice(null);
    try {
      const blob = await api.exportPattern(pattern, "pdf");
      downloadBlob(blob, `patron-${postId}.pdf`);
    } catch {
      setNotice("La exportación a PDF llega con el motor de P2. De momento puedes descargarlo desde el editor.");
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-ink/50">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error || !post || !pattern) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <p className="flex items-center justify-center gap-2 text-ink/70">
          <AlertCircle size={18} /> {error ?? "No se pudo cargar el patrón."}
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/" className="rounded-xl border border-ink/15 px-3 py-2 text-sm">
            Volver al feed
          </Link>
          <Link to={`/create?remix=${postId}`} className="rounded-xl bg-brand px-3 py-2 text-sm text-white">
            Crear mi versión
          </Link>
        </div>
      </div>
    );
  }

  const isHama = pattern.craft === "hama";
  const cellSize = Math.max(6, Math.round(16 * zoom));

  return (
    <div className="space-y-4 pb-24 sm:pb-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/p/${postId}`} className="flex items-center gap-1 text-sm text-ink/55 hover:text-ink">
            <ArrowLeft size={15} /> Volver al patrón
          </Link>
          <h1 className="mt-1 text-xl font-bold">Hacer: {post.title}</h1>
          <p className="text-sm text-ink/55">
            {pattern.width} × {pattern.height} · {pattern.palette.length} colores ·{" "}
            {isHama ? "cuentas HAMA" : "punto de cruz"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition ${
              panMode ? "bg-ink text-white" : "bg-ink/5 text-ink/70 hover:text-ink"
            }`}
            title="Mover el lienzo en vez de marcar celdas"
          >
            {panMode ? <Hand size={16} /> : <Pencil size={16} />}
            {panMode ? "Moviendo" : "Marcando"}
          </button>
          <button
            type="button"
            onClick={restart}
            className="flex items-center gap-1.5 rounded-xl bg-ink/5 px-3 py-2 text-sm text-ink/70 hover:text-ink"
          >
            <RotateCcw size={16} /> <span className="hidden sm:inline">Reiniciar</span>
          </button>
        </div>
      </header>

      {notice && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Sparkles size={15} className="mt-0.5 shrink-0" /> {notice}
        </p>
      )}

      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink/70 lg:hidden"
      >
        {panelOpen ? "Ocultar colores y materiales" : "Ver colores y materiales"}
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-ink/10 bg-white p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">
                Progreso <strong className="text-brand">{stats.pct}%</strong>
              </span>
              <span className="text-xs text-ink/50">
                {stats.done.toLocaleString("es-ES")} / {stats.total.toLocaleString("es-ES")}{" "}
                {isHama ? "cuentas" : "puntadas"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>

          <ZoomPanView zoom={zoom} onZoom={setZoom} panEnabled={panMode}>
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
              onRulerPointer={(kind, index) => {
                if (kind === "row") markWholeRow(index);
              }}
              className="rounded-lg shadow-sm"
            />
          </ZoomPanView>

          <p className="text-xs text-ink/45">
            Toca o arrastra para marcar celdas hechas. Toca un número de fila para marcarla entera.
            {highlight !== null && " Modo por color activo: pulsa otro color o «Todos»."}
          </p>
        </div>

        <div className={`space-y-3 ${panelOpen ? "" : "hidden"} lg:block`}>
          <section className="rounded-2xl border border-ink/10 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Por color</h2>
              <button
                type="button"
                onClick={() => setHighlight(null)}
                className={`rounded-lg px-2 py-1 text-xs ${
                  highlight === null ? "bg-ink text-white" : "bg-ink/5 text-ink/60"
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
                          <span className="tabular-nums text-ink/50">
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-sm text-ink/80 hover:border-ink/40"
            >
              <Download size={16} /> PDF
            </button>
            <button
              type="button"
              onClick={() => navigate(`/create?remix=${postId}`)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <Shuffle size={16} /> Remix
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
