import { useEffect, useRef, useState } from "react";

export interface RoundedSelectOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface RoundedSelectProps<TValue extends string> {
  value: TValue;
  options: Array<RoundedSelectOption<TValue>>;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  autoFocus?: boolean;
}

export function RoundedSelect<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
  title,
  autoFocus = false,
}: RoundedSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className={`rounded-select${isOpen ? " open" : ""}${disabled ? " disabled" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <button
        type="button"
        className="rounded-select-control"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        title={title}
        autoFocus={autoFocus}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? "Выберите вариант"}</span>
        <span className="rounded-select-chevron" aria-hidden="true" />
      </button>

      {isOpen && !disabled && (
        <div className="rounded-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "active" : ""}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
