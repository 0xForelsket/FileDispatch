import { cn } from "@/lib/utils";

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
    size?: "sm" | "default";
}

export function Switch({
    checked,
    onCheckedChange,
    className,
    disabled = false,
    size = "default",
}: SwitchProps) {
    const isSmall = size === "sm";

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
                "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-50",
                isSmall ? "h-4 w-7" : "h-5 w-9",
                checked
                    ? "bg-[var(--accent)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
                    : "bg-[var(--border-main)] hover:bg-[var(--border-strong)]",
                className
            )}
        >
            <span
                className={cn(
                    "pointer-events-none block rounded-full shadow-sm ring-0 transition-all duration-200 ease-out",
                    isSmall ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
                    checked
                        ? cn(isSmall ? "translate-x-3" : "translate-x-4", "bg-white")
                        : "translate-x-0.5 bg-white"
                )}
            />
        </button>
    );
}
