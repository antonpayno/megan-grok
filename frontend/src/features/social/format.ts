import { ApiError } from "../../api/client";
import type { Craft } from "../../api/types";

/** Mensaje legible para cualquier error de la API. */
export function errorMessage(error: unknown, fallback = "Algo ha ido mal. Inténtalo de nuevo."): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Tu sesión ha caducado. Vuelve a entrar.";
    if (error.status === 403) return "No tienes permiso para hacer eso.";
    if (error.status === 404) return "No se ha encontrado lo que buscas.";
    if (error.status === 501) return "Esta parte todavía no está lista en el backend.";
    return error.message || fallback;
  }
  if (error instanceof TypeError) return "No hay conexión con el servidor.";
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function craftLabel(craft: Craft): string {
  return craft === "hama" ? "HAMA" : "Punto de cruz";
}

export function craftShortLabel(craft: Craft): string {
  return craft === "hama" ? "HAMA" : "P. de cruz";
}

/** 1234 → "1,2 mil"; 1200000 → "1,2 M". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const value = n / 1000;
    return `${trimZero(value.toFixed(value < 10 ? 1 : 0))} mil`;
  }
  const value = n / 1_000_000;
  return `${trimZero(value.toFixed(value < 10 ? 1 : 0))} M`;
}

function trimZero(value: string): string {
  return value.replace(/\.0$/, "").replace(".", ",");
}

/** "29×29 · 8 colores" */
export function patternSize(width: number, height: number, colorsCount: number): string {
  return `${width}×${height} · ${colorsCount} ${colorsCount === 1 ? "color" : "colores"}`;
}

/** Tiempo relativo en español. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** Etiqueta de tag sin almohadilla duplicada. */
export function tagLabel(tag: string): string {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

export function cleanTag(tag: string): string {
  return tag.replace(/^#+/, "").trim();
}
