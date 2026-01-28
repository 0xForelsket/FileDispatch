import { Switch } from "@/components/ui/Switch";
import React from "react";

interface SettingRowProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

export function SettingRow({ title, description, children }: SettingRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] p-3">
            <div>
                <div className="font-medium text-[var(--fg-primary)]">{title}</div>
                <div className="text-xs text-[var(--fg-muted)]">{description}</div>
            </div>
            {children}
        </div>
    );
}

interface SettingToggleProps {
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    highlight?: boolean;
    disabled?: boolean;
}

export function SettingToggle({
    title,
    description,
    checked,
    onChange,
    highlight = false,
    disabled = false,
}: SettingToggleProps) {
    return (
        <div
            onClick={() => !disabled && onChange(!checked)}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={checked}
            aria-disabled={disabled}
            onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onChange(!checked);
                }
            }}
            className={`flex w-full items-center justify-between rounded-[var(--radius)] border p-3 text-left transition-colors ${
                disabled
                    ? "cursor-not-allowed opacity-50"
                    : highlight
                        ? "cursor-pointer border-[var(--accent)] bg-[var(--accent-muted)]"
                        : "cursor-pointer border-transparent hover:border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
            }`}
        >
            <div>
                <div className="font-medium text-[var(--fg-primary)]">{title}</div>
                <div className="text-xs text-[var(--fg-muted)]">{description}</div>
            </div>
            <Switch
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                ariaLabel={title}
            />
        </div>
    );
}
