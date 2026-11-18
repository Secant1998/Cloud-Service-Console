import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type AppSelectProps = {
  className?: string;
  label: string;
  value: string;
  options: AppSelectOption[];
  placeholder: string;
  disabled?: boolean;
  constrainMenu?: boolean;
  onChange: (value: string) => void;
};

export function AppSelect({ className = "", label, value, options, placeholder, disabled = false, constrainMenu = false, onChange }: AppSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useLayoutEffect(() => {
    if (!open || !constrainMenu) return;
    function positionMenu() {
      const root = rootRef.current, menu = menuRef.current;
      if (!root || !menu) return;
      const rect = root.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16, above = rect.top - 16;
      const upwards = below < Math.min(200, above);
      menu.style.maxHeight = `${Math.max(0, Math.min(320, upwards ? above : below))}px`;
      menu.style.top = upwards ? "auto" : "calc(100% + 6px)";
      menu.style.bottom = upwards ? "calc(100% + 6px)" : "auto";
    }
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, constrainMenu]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function focusOption(index: number) {
    const option = optionRefs.current[index], menu = menuRef.current;
    if (!option) return;
    if (!constrainMenu || !menu) { option.focus(); return; }
    option.focus({ preventScroll: true });
    const target = option.getBoundingClientRect(), bounds = menu.getBoundingClientRect();
    if (target.top < bounds.top + 8) menu.scrollTop -= bounds.top + 8 - target.top;
    else if (target.bottom > bounds.bottom - 8) menu.scrollTop += target.bottom - bounds.bottom + 8;
  }

  function openAt(index: number) {
    if (disabled || options.length === 0) {
      return;
    }
    setOpen(true);
    window.requestAnimationFrame(() => focusOption(Math.max(0, Math.min(index, options.length - 1))));
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const fallbackIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const targetIndex = event.key === "End" ? options.length - 1 : event.key === "ArrowUp" ? Math.max(0, fallbackIndex - 1) : event.key === "ArrowDown" ? Math.min(options.length - 1, fallbackIndex + 1) : 0;
      openAt(targetIndex);
    }
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const targetIndex = event.key === "End" ? options.length - 1 : event.key === "Home" ? 0 : event.key === "ArrowDown" ? Math.min(options.length - 1, index + 1) : Math.max(0, index - 1);
      focusOption(targetIndex);
    }
  }

  return (
    <div className={`field ${className}`.trim()}>
      <span>{label}</span>
      <div className={`app-select-shell${open ? " open" : ""}${disabled ? " disabled" : ""}`} ref={rootRef}>
        <button
          type="button"
          className="input app-select-trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-label={label}
          aria-expanded={open}
          onKeyDown={handleTriggerKeyDown}
          onClick={() => {
            if (disabled) {
              return;
            }
            setOpen((current) => !current);
          }}
        >
          <span className="app-select-trigger-main">{selectedOption?.label || placeholder}</span>
          <span className="app-select-trigger-arrow" aria-hidden="true" />
        </button>
        {open && !disabled ? (
          <div className="app-select-menu" ref={menuRef} role="listbox" aria-label={label}>
            {options.map((option, index) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || "__empty__"}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  className={`app-select-option${active ? " selected" : ""}`}
                  role="option"
                  aria-selected={active}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="app-select-option-main">{option.label}</span>
                  {option.description ? <span className="app-select-option-sub">{option.description}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
