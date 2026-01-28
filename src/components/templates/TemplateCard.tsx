import type { Template } from "@/types";

interface TemplateCardProps {
    template: Template;
    onClick: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    photography: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400" },
    finance: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
    development: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
    downloads: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" },
    general: { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-400" },
    custom: { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-400" },
};

export function TemplateCard({ template, onClick }: TemplateCardProps) {
    const colors = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.general;

    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative flex flex-col items-start gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] p-4 text-left transition duration-200 hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-app)]"
        >
            {/* Icon & Category Badge */}
            <div className="flex w-full items-start justify-between">
                <span
                    className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-xl ${colors.bg} ${colors.border} border`}
                >
                    {template.icon}
                </span>
                <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors.bg} ${colors.text}`}
                >
                    {template.category}
                </span>
            </div>

            {/* Name & Description */}
            <div className="mt-1 flex-1">
                <h3 className="text-sm font-semibold text-[var(--fg-primary)] group-hover:text-[var(--accent)]">
                    {template.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--fg-secondary)]">
                    {template.description}
                </p>
            </div>

            {/* Tags */}
            <div className="mt-2 flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map((tag) => (
                    <span
                        key={tag}
                        className="rounded-full border border-[var(--border-dim)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]"
                    >
                        {tag}
                    </span>
                ))}
            </div>

            {/* Hover overlay */}
            <div
                className="absolute inset-0 flex items-center justify-center rounded-[var(--radius)] bg-[var(--accent)]/5 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
            >
                <span className="rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] shadow-lg">
                    Use Template
                </span>
            </div>
        </button>
    );
}
