import { cn } from "./cn";

const SIZES = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-xl",
  xl: "size-28 text-3xl",
} as const;

// Tonos oscuros: el texto blanco de las iniciales mantiene contraste AA.
const COLORS = ["#c22e52", "#5b3df5", "#0369a1", "#047857", "#b45309", "#6d28d9", "#b91c1c"];

export interface AvatarProps {
  src?: string | null;
  /** Nombre o @usuario; se usa para iniciales y color estable. */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Avatar con imagen o iniciales deterministas. */
export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const label = name.replace(/^@/, "").trim() || "?";
  const initials = label.slice(0, 2).toUpperCase();
  const hue = [...label].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % COLORS.length;

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        loading="lazy"
        className={cn("shrink-0 rounded-full bg-paper object-cover ring-1 ring-line", SIZES[size], className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: COLORS[hue] }}
    >
      {initials}
    </span>
  );
}
