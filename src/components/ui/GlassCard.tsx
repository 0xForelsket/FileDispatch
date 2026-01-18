import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassCard({ children, className = "", hoverEffect = false }: GlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/40 bg-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/40 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.35)] ${
        hoverEffect
          ? "transition-all duration-300 hover:-translate-y-1 hover:bg-white/60 hover:shadow-xl hover:border-white/60 dark:hover:bg-neutral-800/60 dark:hover:border-white/20"
          : ""
      } ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-60 dark:via-white/20" />
      {children}
    </div>
  );
}
