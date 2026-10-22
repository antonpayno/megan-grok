// Hook con todo el estado del editor de patrones: herramientas, paleta, historial.
import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import type { PaletteColor, PatternData } from "../../api/types";
import {
  addColor as addColorToPattern,
  linePoints,
  normalizePattern,
  removeColor as removeColorFromPattern,
  resizePattern,
} from "./patternUtils";

export type EditorTool = "pencil" | "eraser" | "fill" | "picker" | "pan";

const HISTORY_LIMIT = 50;

interface Snapshot {
  width: number;
  height: number;
  palette: PaletteColor[];
  cells: Int16Array;
}

function snapshotOf(p: PatternData): Snapshot {
  return {
    width: p.width,
    height: p.height,
    palette: p.palette.map((c) => ({ ...c })),
    cells: Int16Array.from(p.cells),
  };
}

function patternFromSnapshot(s: Snapshot, craft: PatternData["craft"]): PatternData {
  return {
    craft,
    width: s.width,
    height: s.height,
    palette: s.palette.map((c) => ({ ...c })),
    cells: Array.from(s.cells),
  };
}

export interface PatternEditor {
  pattern: PatternData;
  tool: EditorTool;
  setTool: (t: EditorTool) => void;
  colorIndex: number;
  setColorIndex: (i: number) => void;
  symmetry: boolean;
  setSymmetry: (v: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** Llamar al empezar un trazo (pointerdown): agrupa muchas celdas en un solo paso de deshacer. */
  beginStroke: () => void;
  /** Llamar al soltar el puntero. */
  endStroke: () => void;
  paint: (x: number, y: number) => void;
  /** Pinta la línea entre dos celdas (trazo continuo sin copiar el array por celda). */
  paintPath: (x0: number, y0: number, x1: number, y1: number) => void;
  fillAt: (x: number, y: number) => void;
  pickAt: (x: number, y: number) => void;
  addColor: (color: PaletteColor) => number;
  removeColor: (index: number) => void;
  resize: (width: number, height: number) => void;
  clear: () => void;
  load: (p: PatternData, opts?: { resetHistory?: boolean }) => void;
}

export function usePatternEditor(initial: PatternData): PatternEditor {
  const [pattern, setPattern] = useState<PatternData>(() => normalizePattern(initial));
  const [tool, setToolState] = useState<EditorTool>("pencil");
  const [colorIndex, setColorIndexState] = useState(0);
  const [symmetry, setSymmetryState] = useState(false);
  const [historyTick, bump] = useReducer((n: number) => n + 1, 0);

  const patternRef = useRef(pattern);
  const undoRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const strokeRef = useRef<Snapshot | null>(null);

  const commit = useCallback((next: PatternData) => {
    patternRef.current = next;
    setPattern(next);
  }, []);

  const pushHistory = useCallback((s: Snapshot) => {
    const stack = undoRef.current;
    stack.push(s);
    if (stack.length > HISTORY_LIMIT) stack.shift();
    redoRef.current = [];
    bump();
  }, []);

  const beginStroke = useCallback(() => {
    if (strokeRef.current) return;
    strokeRef.current = snapshotOf(patternRef.current);
  }, []);

  const endStroke = useCallback(() => {
    const start = strokeRef.current;
    if (!start) return;
    strokeRef.current = null;
    const now = patternRef.current;
    const changed =
      start.width !== now.width ||
      start.height !== now.height ||
      start.palette.length !== now.palette.length ||
      start.cells.length !== now.cells.length ||
      start.cells.some((v, i) => v !== now.cells[i]);
    if (changed) pushHistory(start);
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (strokeRef.current) endStroke();
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(snapshotOf(patternRef.current));
    commit(patternFromSnapshot(prev, patternRef.current.craft));
    bump();
  }, [commit, endStroke]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(snapshotOf(patternRef.current));
    commit(patternFromSnapshot(next, patternRef.current.craft));
    bump();
  }, [commit]);

  const paintPoints = useCallback(
    (points: { x: number; y: number }[]) => {
      const p = patternRef.current;
      if (tool === "picker" || tool === "pan") return;
      const value = tool === "eraser" ? -1 : colorIndex;
      if (value >= p.palette.length) return; // no hay color activo válido
      let cells: number[] | null = null;
      const set = (cx: number, cy: number) => {
        if (cx < 0 || cy < 0 || cx >= p.width || cy >= p.height) return;
        const i = cy * p.width + cx;
        if (p.cells[i] === value) return;
        if (!cells) cells = [...p.cells];
        cells[i] = value;
      };
      for (const point of points) {
        set(point.x, point.y);
        if (symmetry) set(p.width - 1 - point.x, point.y);
      }
      if (!cells) return;
      commit({ ...p, cells });
    },
    [colorIndex, commit, symmetry, tool],
  );

  const paint = useCallback(
    (x: number, y: number) => paintPoints([{ x, y }]),
    [paintPoints],
  );

  const paintPath = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      paintPoints(linePoints(x0, y0, x1, y1));
    },
    [paintPoints],
  );

  const fillAt = useCallback(
    (x: number, y: number) => {
      const p = patternRef.current;
      if (tool === "picker") return;
      if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
      const value = tool === "eraser" ? -1 : colorIndex;
      if (value < 0 || value >= p.palette.length) return;
      const target = p.cells[y * p.width + x];
      if (target === value) return;
      const cells = [...p.cells];
      const stack: number[] = [y * p.width + x];
      const seen = new Uint8Array(cells.length);
      while (stack.length) {
        const i = stack.pop()!;
        if (seen[i] || cells[i] !== target) continue;
        seen[i] = 1;
        cells[i] = value;
        const cx = i % p.width;
        const cy = (i - cx) / p.width;
        if (cx > 0) stack.push(i - 1);
        if (cx < p.width - 1) stack.push(i + 1);
        if (cy > 0) stack.push(i - p.width);
        if (cy < p.height - 1) stack.push(i + p.width);
      }
      pushHistory(snapshotOf(p));
      commit({ ...p, cells });
    },
    [colorIndex, commit, pushHistory, tool],
  );

  const pickAt = useCallback((x: number, y: number) => {
    const p = patternRef.current;
    if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
    const idx = p.cells[y * p.width + x];
    if (idx >= 0 && idx < p.palette.length) setColorIndexState(idx);
  }, []);

  const addColor = useCallback((color: PaletteColor) => {
    const { pattern: next, index } = addColorToPattern(patternRef.current, color);
    if (next !== patternRef.current) {
      pushHistory(snapshotOf(patternRef.current));
      commit(next);
    }
    if (index >= 0) setColorIndexState(index);
    return index;
  }, [commit, pushHistory]);

  const removeColor = useCallback(
    (index: number) => {
      const p = patternRef.current;
      if (index < 0 || index >= p.palette.length) return;
      pushHistory(snapshotOf(p));
      commit(removeColorFromPattern(p, index));
      if (p.palette.length <= 1) setColorIndexState(0);
      else setColorIndexState(Math.max(0, Math.min(index, p.palette.length - 2)));
    },
    [commit, pushHistory],
  );

  const resize = useCallback(
    (width: number, height: number) => {
      const p = patternRef.current;
      if (p.width === width && p.height === height) return;
      pushHistory(snapshotOf(p));
      commit(resizePattern(p, width, height));
    },
    [commit, pushHistory],
  );

  const clear = useCallback(() => {
    const p = patternRef.current;
    if (!p.cells.some((c) => c >= 0)) return;
    pushHistory(snapshotOf(p));
    commit({ ...p, cells: new Array(p.width * p.height).fill(-1) });
  }, [commit, pushHistory]);

  const load = useCallback(
    (p: PatternData, opts?: { resetHistory?: boolean }) => {
      if (opts?.resetHistory) {
        undoRef.current = [];
        redoRef.current = [];
        strokeRef.current = null;
      } else if (patternRef.current) {
        pushHistory(snapshotOf(patternRef.current));
      }
      const next = normalizePattern(p);
      commit(next);
      setColorIndexState(0);
      bump();
    },
    [commit, pushHistory],
  );

  const setColorIndex = useCallback((i: number) => {
    const max = patternRef.current.palette.length - 1;
    setColorIndexState(Math.max(0, Math.min(max, i)));
  }, []);

  const setTool = useCallback((t: EditorTool) => setToolState(t), []);
  const setSymmetry = useCallback((v: boolean) => setSymmetryState(v), []);

  return useMemo(
    () => ({
      pattern,
      tool,
      setTool,
      colorIndex,
      setColorIndex,
      symmetry,
      setSymmetry,
      canUndo: undoRef.current.length > 0,
      canRedo: redoRef.current.length > 0,
      undo,
      redo,
      beginStroke,
      endStroke,
      paint,
      paintPath,
      fillAt,
      pickAt,
      addColor,
      removeColor,
      resize,
      clear,
      load,
    }),
    [
      pattern, tool, setTool, colorIndex, setColorIndex, symmetry, setSymmetry,
      historyTick, undo, redo, beginStroke, endStroke, paint, paintPath, fillAt, pickAt,
      addColor, removeColor, resize, clear, load,
    ],
  );
}
