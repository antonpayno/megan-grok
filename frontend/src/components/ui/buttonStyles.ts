import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-dark text-white shadow-sm hover:brightness-95",
  secondary: "bg-white text-ink border border-brand-soft hover:bg-brand-soft/60",
  ghost: "text-ink hover:bg-brand-soft/60",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-11 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-base",
  icon: "size-10",
};

/** Clases compartidas por `Button` y `ButtonLink` (mismo aspecto, semántica distinta). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-full font-medium transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
    "disabled:cursor-not-allowed disabled:opacity-55",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fullWidth && "w-full",
    className,
  );
}
