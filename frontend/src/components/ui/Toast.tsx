import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "./cn";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((fn) => fn());
}

function push(message: string, kind: ToastKind, ms: number) {
  const id = nextId++;
  items = [...items, { id, kind, message }];
  emit();
  timers.set(
    id,
    setTimeout(() => dismiss(id), ms),
  );
  return id;
}

export function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  items = items.filter((t) => t.id !== id);
  emit();
}

/** API imperativa: `toast.error("No se pudo guardar")`. */
export const toast = {
  success: (message: string, ms = 3500) => push(message, "success", ms),
  error: (message: string, ms = 5000) => push(message, "error", ms),
  info: (message: string, ms = 3500) => push(message, "info", ms),
};

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return items;
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const TONES: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-white text-ink",
  error: "border-red-200 bg-white text-ink",
  info: "border-line bg-white text-ink",
};

const ICON_TONES: Record<ToastKind, string> = {
  success: "text-emerald-600",
  error: "text-red-600",
  info: "text-brand-dark",
};

/** Contenedor global. Se monta una sola vez desde el Layout. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
    >
      {list.map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-float animate-slide-up",
              TONES[item.kind],
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_TONES[item.kind])} aria-hidden />
            <p className="flex-1 leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Cerrar aviso"
              className="-mr-1 rounded-full p-1 text-ink-soft transition-colors hover:bg-black/5 hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
