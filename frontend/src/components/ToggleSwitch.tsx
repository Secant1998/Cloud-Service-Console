import type { ButtonHTMLAttributes } from "react";

type ToggleSwitchProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  checked: boolean;
  busy?: boolean;
  ariaLabel: string;
  size?: "md" | "lg";
};

export function ToggleSwitch({
  checked,
  busy = false,
  ariaLabel,
  size = "md",
  className = "",
  disabled,
  ...rest
}: ToggleSwitchProps) {
  const finalClass = [
    "toggle-switch",
    `toggle-switch-${size}`,
    checked ? "checked" : "",
    busy ? "busy" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={finalClass}
      disabled={disabled || busy}
      {...rest}
    >
      <span className="toggle-switch-track">
        <span className="toggle-switch-thumb" />
      </span>
    </button>
  );
}
