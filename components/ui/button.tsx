import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline-light";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-ink text-brand hover:bg-brand-mid disabled:opacity-50",
  secondary:
    "border border-border bg-canvas text-primary hover:bg-surface disabled:opacity-50",
  ghost: "text-secondary hover:bg-surface hover:text-primary disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:opacity-50",
  "outline-light":
    "border border-white/35 bg-transparent text-white hover:bg-white/10 disabled:opacity-50",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "xs" | "sm" | "md";
};

const sizes = {
  xs: "rounded-lg px-2.5 py-1.5 text-2xs md:rounded-[10px] md:px-3.5 md:py-2 md:text-xs-tight",
  sm: "rounded-xl px-3 py-1.5 text-xs-tight md:rounded-[10px] md:px-4 md:py-2 md:text-body",
  md: "rounded-xl px-3.5 py-2 text-xs-tight md:rounded-[10px] md:px-5 md:py-2.5 md:text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
