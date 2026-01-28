import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { Rule, Template, TemplateCategory } from "@/types";
import { saveUserTemplate } from "@/lib/userTemplates";
import { MagiSelect } from "@/components/ui/MagiSelect";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface TemplateSaveDialogProps {
  open: boolean;
  onClose: () => void;
  rule: Rule;
}

export function TemplateSaveDialog({ open, onClose, rule }: TemplateSaveDialogProps) {
  const [name, setName] = useState(rule.name || "New Template");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("custom");
  const [icon, setIcon] = useState("✨");
  const [tags, setTags] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  const parsedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  );

  const handleSave = () => {
    const template: Template = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Template",
      description: description.trim() || "Custom template",
      category,
      icon: icon.trim() || "✨",
      tags: parsedTags.length > 0 ? parsedTags : ["custom"],
      preset: {
        id: crypto.randomUUID(),
        name: name.trim() || "Untitled Template",
        description: description.trim() || "Custom template",
        variables: [],
        rules: [
          {
            name: rule.name,
            enabled: rule.enabled,
            stopProcessing: rule.stopProcessing,
            conditions: rule.conditions,
            actions: rule.actions,
          },
        ],
      },
    };

    saveUserTemplate(template);
    onClose();
  };

  useFocusTrap(open, dialogRef);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close template dialog"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-save-title"
        className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-main)] px-5 py-4">
          <div>
            <h2 id="template-save-title" className="text-lg font-semibold text-[var(--fg-primary)]">Save as template</h2>
            <p className="text-xs text-[var(--fg-muted)]">Create a reusable template from this rule</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius)] p-2 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
            aria-label="Close template dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Template name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="e.g. Sort screenshots"
              aria-label="Template name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-24 w-full resize-none rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="What does this template do?"
              aria-label="Template description"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                Category
              </label>
              <MagiSelect
                value={category}
                onChange={(val) => setCategory(val as TemplateCategory)}
                options={[
                  { label: "Custom", value: "custom" },
                  { label: "General", value: "general" },
                  { label: "Downloads", value: "downloads" },
                  { label: "Development", value: "development" },
                  { label: "Finance", value: "finance" },
                  { label: "Photography", value: "photography" },
                ]}
                ariaLabel="Template category"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                Icon
              </label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="✨"
                aria-label="Template icon"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="comma, separated, tags"
              aria-label="Template tags"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--border-main)] bg-[var(--bg-subtle)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] hover:opacity-90"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}
