import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface MagiSelectOption {
  label: string;
  value: string;
}

interface MagiSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: MagiSelectOption[];
  className?: string;
  width?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function MagiSelect({
  value,
  onChange,
  options,
  className = "",
  width = "w-full",
  placeholder = "SELECT",
  disabled = false,
}: MagiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${width} ${className}`}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={`flex w-full items-center justify-between border ${
          isOpen ? "border-[var(--accent)]" : "border-[var(--border-main)]"
        } bg-[var(--bg-panel)] px-2 py-1 text-left text-xs font-medium text-[var(--fg-primary)] focus:outline-none transition-colors rounded-[var(--radius)] ${
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
        }`}
        style={{ fontFamily: "inherit" }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        {isOpen ? (
          <ChevronUp className="h-3 w-3 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 ml-2" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)] rounded-[var(--radius)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`block w-full px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                option.value === value
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "text-[var(--fg-primary)] hover:bg-[var(--accent-muted)]"
              }`}
              style={{ fontFamily: "inherit" }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
