// Visor con zoom (rueda + botones) y arrastre para desplazar.
import { useEffect, useRef, type ReactNode } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

export interface ZoomPanViewProps {
  zoom: number;
  onZoom: (z: number) => void;
  min?: number;
  max?: number;
  /** Activa el arrastre para moverse por el lienzo. */
  panEnabled?: boolean;
  className?: string;
  children: ReactNode;
  showControls?: boolean;
}

export function clampZoom(z: number, min = 0.4, max = 6): number {
  return Math.max(min, Math.min(max, z));
}

export default function ZoomPanView({
  zoom,
  onZoom,
  min = 0.4,
  max = 6,
  panEnabled = false,
  className = "",
  children,
  showControls = true,
}: ZoomPanViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0016);
      onZoom(clampZoom(zoom * factor, min, max));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, onZoom, min, max]);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panEnabled) return;
    const el = ref.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    el.scrollLeft = d.left - (e.clientX - d.x);
    el.scrollTop = d.top - (e.clientY - d.y);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    ref.current?.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        className="overflow-auto rounded-xl bg-white/70 p-2"
        style={{
          maxHeight: "min(68vh, 620px)",
          touchAction: panEnabled ? "none" : "pan-x pan-y",
          cursor: panEnabled ? "grab" : "auto",
        }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="flex min-h-full min-w-full items-center justify-center">{children}</div>
      </div>

      {showControls && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-ink/85 px-1.5 py-1 text-white shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => onZoom(clampZoom(zoom / 1.25, min, max))}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
            title="Alejar"
          >
            <ZoomOut size={16} />
          </button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => onZoom(clampZoom(zoom * 1.25, min, max))}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
            title="Acercar"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => onZoom(1)}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
            title="Ajustar al 100 %"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
