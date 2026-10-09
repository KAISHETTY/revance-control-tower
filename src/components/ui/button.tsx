import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "default" | "ghost" | "outline" | "subtle" | "danger";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  default: "bg-accent text-accent-fg hover:opacity-90",
  ghost: "text-fg hover:bg-panel-2",
  outline: "border border-line text-fg hover:bg-panel-2",
  subtle: "bg-panel-2 text-fg hover:brightness-110",
  danger: "bg-bad text-white hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3 text-sm gap-2",
  icon: "h-9 w-9",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "outline", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
