import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import type { Rule, Template, TemplateCategory } from "@/types";
import { BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES, searchTemplates, filterByCategory } from "@/data/templates";
import { TemplateCard } from "./TemplateCard";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { useUserTemplates } from "@/hooks/useUserTemplates";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface TemplateGalleryProps {
    folderId: string;
    isOpen: boolean;
    onClose: () => void;
    onRulesCreated?: (rules: Rule[]) => void;
}

export function TemplateGallery({ folderId, isOpen, onClose, onRulesCreated }: TemplateGalleryProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
    const userTemplates = useUserTemplates();
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(isOpen, dialogRef);

    const filteredTemplates = useMemo(() => {
        let result = [...userTemplates, ...BUILTIN_TEMPLATES];
        result = filterByCategory(result, selectedCategory);
        result = searchTemplates(result, searchQuery);
        return result;
    }, [searchQuery, selectedCategory, userTemplates]);

    const handleTemplateClick = (template: Template) => {
        setPreviewTemplate(template);
    };

    const handlePreviewClose = () => {
        setPreviewTemplate(null);
    };

    const handleInstallComplete = () => {
        setPreviewTemplate(null);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close template gallery"
                tabIndex={-1}
            />

            {/* Modal */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="template-gallery-title"
                className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--border-main)] px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📦</span>
                        <div>
                            <h2 id="template-gallery-title" className="text-base font-semibold text-[var(--fg-primary)]">Template Gallery</h2>
                            <p className="text-xs text-[var(--fg-muted)]">
                                Choose a template to get started quickly
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-[var(--radius)] p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                        aria-label="Close template gallery"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="border-b border-[var(--border-main)] px-6 py-4">
                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
                        <input
                            type="text"
                            placeholder="Search templates…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-subtle)] py-2.5 pl-10 pr-4 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            aria-label="Search templates"
                        />
                    </div>

                    {/* Category Pills */}
                    <div className="flex flex-wrap gap-2">
                        {TEMPLATE_CATEGORIES.map((cat) => {
                            const isActive = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id as TemplateCategory | "all")}
                                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${isActive
                                            ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                                            : "border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--fg-secondary)] hover:border-[var(--accent)] hover:text-[var(--fg-primary)]"
                                        }`}
                                >
                                    <span>{cat.icon}</span>
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Template Grid */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {filteredTemplates.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredTemplates.map((template) => (
                                <TemplateCard
                                    key={template.id}
                                    template={template}
                                    onClick={() => handleTemplateClick(template)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <span className="text-4xl">🔍</span>
                            <p className="mt-4 text-sm font-medium text-[var(--fg-secondary)]">
                                No templates found
                            </p>
                            <p className="mt-1 text-xs text-[var(--fg-muted)]">
                                Try adjusting your search or filter
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-[var(--border-main)] px-6 py-3">
                    <p className="text-center text-xs text-[var(--fg-muted)]">
                        {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} available
                    </p>
                </div>
            </div>

            {/* Preview Modal */}
            {previewTemplate && (
                <TemplatePreviewModal
                    template={previewTemplate}
                    folderId={folderId}
                    onClose={handlePreviewClose}
                    onInstallComplete={handleInstallComplete}
                    onRulesCreated={onRulesCreated}
                />
            )}
        </div>,
        document.body
    );
}
