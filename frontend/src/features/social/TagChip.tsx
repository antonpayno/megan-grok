import { Link } from "react-router-dom";
import { cn } from "../../components/ui/cn";
import { formatCount } from "./format";

export interface TagChipProps {
  tag: string;
  count?: number;
  active?: boolean;
  className?: string;
}

/** Chip de tag que lleva al buscador (`/search?q=%23tag`). */
export function TagChip({ tag, count, active = false, className }: TagChipProps) {
  return (
    <Link
      to={`/search?q=${encodeURIComponent(`#${tag}`)}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-brand bg-brand text-white"
          : "border-line bg-white text-ink hover:border-brand/50 hover:bg-brand-soft",
        className,
      )}
    >
      <span>#{tag}</span>
      {typeof count === "number" && (
        <span className={cn("text-xs", active ? "text-white/80" : "text-ink-soft")}>{formatCount(count)}</span>
      )}
    </Link>
  );
}
