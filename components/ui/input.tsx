import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="flex w-full flex-col gap-1 md:gap-1.5">
      {label ? (
        <span className="text-2xs font-medium text-primary md:text-xs-tight">
          {label}
        </span>
      ) : null}
      <input
        id={inputId}
        className={`rounded-xl border border-border bg-canvas px-2.5 py-2 text-xs-tight text-primary outline-none transition-colors placeholder:text-muted focus:border-primary md:rounded-[10px] md:px-3.5 md:py-2.5 md:text-sm ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
      {error ? <span className="text-2xs text-danger">{error}</span> : null}
    </label>
  );
}
