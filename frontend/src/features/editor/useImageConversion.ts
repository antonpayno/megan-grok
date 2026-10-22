// Conversión imagen -> patrón con debounce. Garantiza:
//   - una sola petición en vuelo (las siguientes esperan y solo se lanza la última)
//   - las respuestas viejas se ignoran (no pisan la vista previa)
//   - el fallback local SOLO se usa si la API falla, marcándolo para avisar en la UI
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../api/client";
import type { ConvertOptions, PatternData } from "../../api/types";
import { convertImageLocally } from "./fallbackConvert";
import { normalizePattern } from "./patternUtils";

export type ConversionSource = "backend" | "local";

interface Job {
  file: File;
  options: ConvertOptions;
  version: number;
}

export interface ImageConversionState {
  pattern: PatternData | null;
  busy: boolean;
  error: string | null;
  source: ConversionSource | null;
  /** true si la última vista previa vino del fallback local. */
  fallback: boolean;
  retry: () => void;
}

const DEBOUNCE_MS = 450;

export function useImageConversion(
  file: File | null,
  options: ConvertOptions,
  craft: ConvertOptions["craft"],
  paletteId: string,
): ImageConversionState {
  const [pattern, setPattern] = useState<PatternData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ConversionSource | null>(null);

  const mounted = useRef(true);
  const versionRef = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef<Job | null>(null);
  const lastFile = useRef<File | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current = null;
      versionRef.current++;
    };
  }, []);

  const makeJob = (version: number): Job | null => {
    if (!file) return null;
    const cleaned: ConvertOptions = { ...options, craft, palette_id: paletteId };
    delete cleaned.remove_background;
    return { file, options: cleaned, version };
  };

  const runJob = async (job: Job): Promise<void> => {
    if (inFlight.current) {
      pending.current = job;
      return;
    }
    inFlight.current = true;
    if (mounted.current) {
      setBusy(true);
      setError(null);
    }

    try {
      const result = await api.convertImage(job.file, job.options);
      if (!mounted.current || job.version !== versionRef.current) return;
      setPattern(normalizePattern(result));
      setSource("backend");
    } catch (apiError) {
      if (!mounted.current || job.version !== versionRef.current) return;
      // Respaldo local: el servidor falló. Se avisa en la UI (source === "local").
      try {
        const local = await convertImageLocally(job.file, job.options);
        if (!mounted.current || job.version !== versionRef.current) return;
        setPattern(normalizePattern(local));
        setSource("local");
      } catch {
        if (!mounted.current || job.version !== versionRef.current) return;
        setSource(null);
        setError(
          apiError instanceof ApiError
            ? apiError.message || "No se pudo convertir la imagen."
            : "No se pudo convertir la imagen. Comprueba tu conexión o prueba con otra foto.",
        );
      }
    } finally {
      inFlight.current = false;
      if (!mounted.current) return;
      if (job.version === versionRef.current) setBusy(false);

      const next = pending.current;
      pending.current = null;
      // Solo arrancamos lo pendiente si sigue siendo la versión vigente.
      if (next && next.version === versionRef.current) void runJob(next);
    }
  };

  useEffect(() => {
    if (!file) {
      versionRef.current++;
      pending.current = null;
      setBusy(false);
      setError(null);
      setSource(null);
      return;
    }

    const fileChanged = lastFile.current !== file;
    lastFile.current = file;
    if (fileChanged) {
      setPattern(null);
      setSource(null);
      setError(null);
    }

    const version = ++versionRef.current;
    const job = makeJob(version);
    if (!job) return;
    setBusy(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void runJob(job);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
    // `makeJob`/`runJob` se recrean en cada render, pero solo usan refs y setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, options, craft, paletteId]);

  const retry = useCallback(() => {
    if (!file) return;
    const version = ++versionRef.current;
    const cleaned: ConvertOptions = { ...options, craft, palette_id: paletteId };
    delete cleaned.remove_background;
    const job: Job = { file, options: cleaned, version };
    setBusy(true);
    setError(null);
    void runJob(job);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, options, craft, paletteId]);

  return {
    pattern,
    busy,
    error,
    source,
    fallback: source === "local",
    retry,
  };
}
