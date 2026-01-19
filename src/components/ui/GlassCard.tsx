import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassCard({ children, className = "", hoverEffect = false }: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-sm)] ${
        hoverEffect
          ? "transition-colors duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
