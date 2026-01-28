import { cn } from "@/lib/utils";

interface SliderProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    disabled?: boolean;
    showValue?: boolean;
    formatValue?: (value: number) => string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    ariaDescribedby?: string;
}

export function Slider({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    className,
    disabled = false,
    showValue = true,
    formatValue = (v) => `${Math.round(v * 100)}%`,
    ariaLabel,
    ariaLabelledby,
    ariaDescribedby,
}: SliderProps) {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div className="relative flex-1">
                <input
                    type="range"
                    aria-label={ariaLabelledby ? undefined : (ariaLabel ?? "Value")}
                    aria-labelledby={ariaLabelledby}
                    aria-describedby={ariaDescribedby}
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className={cn(
                        "w-full h-1.5 appearance-none rounded-full bg-[var(--border-main)] cursor-pointer transition-opacity",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)]",
                        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 motion-reduce:[&::-webkit-slider-thumb]:hover:scale-100",
                        "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--accent)] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-110 motion-reduce:[&::-moz-range-thumb]:hover:scale-100",
                        disabled && "opacity-50 cursor-not-allowed [&::-webkit-slider-thumb]:cursor-not-allowed [&::-moz-range-thumb]:cursor-not-allowed"
                    )}
                    style={{
                        background: disabled
                            ? undefined
                            : `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percentage}%, var(--border-main) ${percentage}%, var(--border-main) 100%)`,
                    }}
                />
            </div>
            {showValue && (
                <span
                    className={cn(
                        "min-w-[3rem] text-right text-sm font-medium tabular-nums",
                        disabled ? "text-[var(--fg-muted)]" : "text-[var(--fg-primary)]"
                    )}
                >
                    {formatValue(value)}
                </span>
            )}
        </div>
    );
}
