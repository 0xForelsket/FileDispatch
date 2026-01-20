import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export function HelpTooltip({ content, className = "" }: HelpTooltipProps) {
  const showTooltips = useSettingsStore((state) => state.settings.showTooltips);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipWidth = 240;

      // Position tooltip above the icon, centered
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      let top = rect.top - 8;

      // Ensure tooltip stays within viewport
      if (left < 8) left = 8;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8;
      }

      setPosition({ top, left });
    }
  }, [isVisible]);

  if (!showTooltips) {
    return null;
  }

  const tooltip = isVisible && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[100] w-60 -translate-y-full rounded-md border border-[var(--border-main)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-primary)] shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          {content}
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full">
            <div className="border-8 border-transparent border-t-[var(--bg-elevated)]" />
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] transition-colors ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {tooltip}
    </>
  );
}
