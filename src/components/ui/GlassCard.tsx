import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassCard({ children, className = "", hoverEffect = false }: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden bevel-out bg-panel shadow-none ${
        hoverEffect
          ? "transition-colors duration-200 active:bevel-in"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
