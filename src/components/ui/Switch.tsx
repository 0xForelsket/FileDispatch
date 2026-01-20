import { cn } from "@/lib/utils";

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
}

export function Switch({
    checked,
    onCheckedChange,
    className,
    disabled = false,
}: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                onCheckedChange(!checked);
            }}
            className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-[var(--accent)]" : "bg-[var(--bg-panel)] border-[var(--border-main)]",
                className
            )}
        >
            <span
                className={cn(
                    "pointer-events-none block h-3.5 w-3.5 rounded-full bg-[var(--bg-elevated)] shadow-lg ring-0 transition-transform",
                    checked ? "translate-x-4" : "translate-x-0.5 bg-[var(--fg-muted)]"
                )}
            />
        </button>
    );
}
