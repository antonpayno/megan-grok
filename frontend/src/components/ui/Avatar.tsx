import { cn } from "./cn";

const SIZES = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-xl",
  xl: "size-28 text-3xl",
} as const;

const COLORS = ["#e8456b", "#7c5cff", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

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
