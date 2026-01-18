import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassCard({ children, className = "", hoverEffect = false }: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-[#1f1f24] bg-[#151618] shadow-none ${
        hoverEffect
          ? "transition-colors duration-200 hover:border-[#2a2b31] hover:bg-[#1b1c1f]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
