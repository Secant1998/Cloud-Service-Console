import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "danger" | "ghost" | "secondary";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    loading?: boolean;
    block?: boolean;
  }
>;

export function Button({
  variant = "primary",
  loading = false,
  block = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const finalClass = [
    "button",
    `button-${variant}`,
    block ? "button-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={finalClass} disabled={disabled || loading} {...rest}>
      {loading ? "处理中..." : children}
    </button>
  );
}
