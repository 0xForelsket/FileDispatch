import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, FileText, X } from "lucide-react";

import type { Template, Rule, Action, ConditionGroup } from "@/types";
import { ruleCreate } from "@/lib/tauri";
import { useRuleStore } from "@/stores/ruleStore";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface TemplatePreviewModalProps {
    template: Template;
    folderId: string;
    onClose: () => void;
    onInstallComplete: () => void;
    onRulesCreated?: (rules: Rule[]) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    photography: { bg: "bg-purple-500/10", text: "text-purple-400" },
    finance: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
    development: { bg: "bg-blue-500/10", text: "text-blue-400" },
    downloads: { bg: "bg-orange-500/10", text: "text-orange-400" },
    general: { bg: "bg-slate-500/10", text: "text-slate-400" },
    custom: { bg: "bg-pink-500/10", text: "text-pink-400" },
};

function substituteVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        result = result.split("${" + key + "}").join(value);
    }
    return result;
}

function substituteInActions(actions: Action[], variables: Record<string, string>): Action[] {
    return actions.map((action) => {
        const newAction = { ...action };
        if ("destination" in newAction && typeof newAction.destination === "string") {
            newAction.destination = substituteVariables(newAction.destination, variables);
        }
        if ("pattern" in newAction && typeof newAction.pattern === "string") {
            newAction.pattern = substituteVariables(newAction.pattern, variables);
        }
        if ("message" in newAction && typeof newAction.message === "string") {
            newAction.message = substituteVariables(newAction.message, variables);
        }
        if ("command" in newAction && typeof newAction.command === "string") {
            newAction.command = substituteVariables(newAction.command, variables);
        }
        return newAction;
    });
}

export function TemplatePreviewModal({
    template,
    folderId,
    onClose,
    onInstallComplete,
    onRulesCreated,
}: TemplatePreviewModalProps) {
    const loadRules = useRuleStore((state) => state.loadRules);
    const [variables, setVariables] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        template.preset.variables.forEach((v) => {
            if (v.default) {
                initial[v.id] = v.default;
            }
        });
        return initial;
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    const colors = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.general;

    useFocusTrap(true, dialogRef);

    const handleInstall = async () => {
        if (!folderId) {
            setError("Please select a folder first");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const createdRules: Rule[] = [];
            for (const presetRule of template.preset.rules) {
                const now = new Date().toISOString();
                const rule: Rule = {
                    id: crypto.randomUUID(),
                    folderId,
                    name: presetRule.name,
                    enabled: presetRule.enabled ?? true,
                    stopProcessing: presetRule.stopProcessing ?? true,
                    conditions: presetRule.conditions as ConditionGroup,
                    actions: substituteInActions(presetRule.actions, variables),
                    position: 0,
                    createdAt: now,
                    updatedAt: now,
                };
                const created = await ruleCreate(rule);
                createdRules.push(created);
            }

            await loadRules(folderId);
            if (createdRules.length > 0) {
                onRulesCreated?.(createdRules);
            }
            onInstallComplete();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="template-preview-title"
                className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]"
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-[var(--border-main)] p-5">
                    <div className="flex items-start gap-4">
                        <span
                            className={`flex h-12 w-12 items-center justify-center rounded-[var(--radius)] text-2xl ${colors.bg} border border-[var(--border-main)]`}
                        >
                            {template.icon}
                        </span>
                        <div>
                            <h2 id="template-preview-title" className="text-base font-semibold text-[var(--fg-primary)]">
                                {template.name}
                            </h2>
                            <span
                                className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors.bg} ${colors.text}`}
                            >
                                {template.category}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-[var(--radius)] p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                        aria-label="Close template preview"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="custom-scrollbar max-h-[60vh] overflow-y-auto p-5">
                    {/* Description */}
                    <p className="text-sm text-[var(--fg-secondary)]">{template.description}</p>

                    {/* Rules included */}
                    <div className="mt-5">
                        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                            <FileText className="h-3 w-3" />
                            Rules Included ({template.preset.rules.length})
                        </h3>
                        <ul className="mt-2 space-y-1.5">
                            {template.preset.rules.map((rule, idx) => (
                                <li
                                    key={idx}
                                    className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-dim)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--fg-primary)]"
                                >
                                    <Check className="h-3 w-3 text-[var(--success)]" />
                                    {rule.name}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Variables */}
                    {template.preset.variables.length > 0 && (
                        <div className="mt-5">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                                Configuration
                            </h3>
                            <div className="mt-2 space-y-3">
                                {template.preset.variables.map((variable) => (
                                    <div
                                        key={variable.id}
                                        className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-3"
                                    >
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-semibold text-[var(--fg-secondary)]">
                                                {variable.name}
                                            </span>
                                            <span className="rounded-full border border-[var(--border-main)] px-2 py-0.5 text-[9px] text-[var(--fg-muted)]">
                                                {variable.type}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            className="mt-2 w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                            value={variables[variable.id] ?? variable.default ?? ""}
                                            placeholder={variable.default ?? "Enter value"}
                                            aria-label={variable.name}
                                            onChange={(e) =>
                                                setVariables((prev) => ({
                                                    ...prev,
                                                    [variable.id]: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 rounded-[var(--radius)] border border-[var(--fg-alert)]/30 bg-[var(--fg-alert)]/10 px-3 py-2 text-xs text-[var(--fg-alert)]">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-[var(--border-main)] px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                        {template.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full border border-[var(--border-dim)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleInstall}
                        disabled={loading || !folderId}
                        className="rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Installing…" : "Install Template"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
