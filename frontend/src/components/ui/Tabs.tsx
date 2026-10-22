import { cn } from "./cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  variant?: "line" | "pill";
  className?: string;
  ariaLabel?: string;
}

/** Pestañas accesibles y genéricas (feed, perfil, búsqueda). */
export function Tabs<T extends string>({
  items, value, onChange, variant = "line", className, ariaLabel,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        variant === "line" && "flex gap-1 overflow-x-auto border-b border-line",
        variant === "pill" && "flex gap-1.5 overflow-x-auto",
        "no-scrollbar",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "shrink-0 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              variant === "line" &&
                cn(
                  "-mb-px border-b-2 px-4 py-3",
                  active
                    ? "border-brand text-ink"
                    : "border-transparent text-ink-soft hover:border-line hover:text-ink",
                ),
              variant === "pill" &&
                cn(
                  "rounded-full px-3.5 py-1.5",
                  active
                    ? "bg-ink text-white"
                    : "border border-line bg-white text-ink-soft hover:border-ink-soft/40 hover:text-ink",
                ),
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className={cn("ml-1.5 text-xs", active ? "opacity-80" : "text-ink-soft/70")}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
