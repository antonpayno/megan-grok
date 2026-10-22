import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const FIELD =
  "w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:bg-paper";

function fieldClass(invalid?: boolean, extra?: string) {
  return cn(FIELD, invalid ? "border-red-400 focus:ring-red-300" : "border-line focus:border-brand/60", extra);
}

function FieldShell({
  id, label, hint, error, children,
}: {
  id: string;
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? "input";
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={fieldClass(Boolean(error), cn(Boolean(icon) && "pl-10", className))}
          {...rest}
        />
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? "textarea";
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={fieldClass(Boolean(error), cn("min-h-24 resize-y", className))}
        {...rest}
      />
    </FieldShell>
  );
});
