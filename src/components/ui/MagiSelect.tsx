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
}

export function MagiSelect({
  value,
  onChange,
  options,
  className = "",
  width = "w-full",
  placeholder = "SELECT",
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
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between border ${
          isOpen ? "border-[var(--fg-primary)]" : "border-[var(--border-dim)]"
        } bg-black px-2 py-1 text-left text-xs font-mono font-bold text-[var(--fg-primary)] hover:border-[var(--fg-primary)] focus:outline-none`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        {isOpen ? (
          <ChevronUp className="h-3 w-3 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 ml-2" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-[-1px] max-h-60 w-full overflow-auto border border-[var(--fg-primary)] bg-black shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`block w-full px-2 py-1.5 text-left text-xs font-mono font-bold uppercase transition-colors ${
                option.value === value
                  ? "bg-[var(--fg-primary)] text-black"
                  : "text-[var(--fg-primary)] hover:bg-[var(--border-dim)] hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
