import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassCard({ children, className = "", hoverEffect = false }: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[calc(var(--radius)+2px)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-sm)] ${
        hoverEffect
          ? "transition-all duration-200 ease-out hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
