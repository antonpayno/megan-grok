import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

export interface DropdownProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  className?: string;
  label?: string;
}

/** Menú desplegable simple: cierra al hacer clic fuera o con Escape. */
export function Dropdown({ trigger, children, align = "right", className, label }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            "absolute top-full z-40 mt-2 min-w-52 overflow-hidden rounded-2xl border border-line bg-white py-1.5 shadow-float animate-slide-up",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children, onClick, href, danger, icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  icon?: ReactNode;
}) {
  const classes = cn(
    "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper",
    danger ? "text-red-600" : "text-ink",
  );
  if (href) {
    return (
      <a role="menuitem" href={href} className={classes}>
        {icon && <span className="text-ink-soft" aria-hidden>{icon}</span>}
        {children}
      </a>
    );
  }
  return (
    <button role="menuitem" type="button" onClick={onClick} className={classes}>
      {icon && <span className={cn(danger ? "text-red-500" : "text-ink-soft")} aria-hidden>{icon}</span>}
      {children}
    </button>
  );
}
