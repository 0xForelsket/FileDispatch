import { useState } from "react";
import { AlertTriangle, FolderOpen, GripVertical, Plus, X } from "lucide-react";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { MagiSelect } from "@/components/ui/MagiSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSettingsStore } from "@/stores/settingsStore";


import type { Action, ArchiveFormat, ConflictResolution } from "@/types";

interface ActionBuilderProps {
  actions: Action[];
  onChange: (actions: Action[]) => void;
}

const actionTypes = [
  { value: "move", label: "Move" },
  { value: "copy", label: "Copy" },
  { value: "rename", label: "Rename" },
  { value: "sortIntoSubfolder", label: "Sort into subfolder" },
  { value: "archive", label: "Archive" },
  { value: "unarchive", label: "Unarchive" },
  { value: "delete", label: "Delete (Trash)" },
  { value: "deletePermanently", label: "Delete Permanently" },
  { value: "runScript", label: "Run Script" },
  { value: "notify", label: "Notify" },
  { value: "open", label: "Open (Default App)" },
  { value: "openWith", label: "Open With…" },
  { value: "showInFileManager", label: "Show in File Manager" },
  { value: "makePdfSearchable", label: "Make PDF Searchable (OCR)" },
  { value: "pause", label: "Pause" },
  { value: "continue", label: "Continue Matching Rules" },
  { value: "ignore", label: "Ignore" },
];

const conflictOptions: { value: ConflictResolution; label: string }[] = [
  { value: "rename", label: "Rename" },
  { value: "replace", label: "Replace" },
  { value: "skip", label: "Skip" },
];

const fieldClass =
  "rounded-[var(--radius)] bg-[var(--bg-panel)] border border-[var(--border-main)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-none outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]";
const longFieldClass = `${fieldClass} min-w-[220px]`;

export function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
  const allowPermanentDelete = useSettingsStore((state) => state.settings.allowPermanentDelete);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  const updateAction = (index: number, updated: Action) => {
    const next = [...actions];
    next[index] = updated;
    onChange(next);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, idx) => idx !== index));
  };

  const addAction = (type = "move") => {
    onChange([...actions, createAction(type)]);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const next = [...actions];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(dragOverIndex, 0, removed);
      onChange(next);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-3">
      {/* Natural language header */}
      <div className="text-[13px] text-[var(--fg-secondary)]">
        Do the following to the matched file or folder:
      </div>

      {actions.map((action, index) => {
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={index}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              handleDragStart(index);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              handleDragOver(index);
            }}
            onDragEnd={handleDragEnd}
            className={`group rounded-[var(--radius)] border bg-[var(--bg-subtle)] p-3 transition ${
              isDragging ? "opacity-50 scale-[0.98] motion-reduce:transform-none" : "hover:border-[var(--border-strong)]"
            } ${isDragOver ? "border-[var(--accent)] border-2" : action.type === "deletePermanently" ? "border-red-500/50" : "border-[var(--border-main)]"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="cursor-grab active:cursor-grabbing text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--fg-secondary)]">
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <MagiSelect
                width="w-40"
                value={action.type}
                onChange={(val) => {
                  if (val === "deletePermanently") {
                    setConfirmDeleteIndex(index);
                    return;
                  }
                  updateAction(index, createAction(val));
                }}
                options={actionTypes}
                ariaLabel="Action type"
              />
              {renderActionFields(action, (updated) => updateAction(index, updated))}
              <button
                className="ml-auto rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--fg-alert)]/15 hover:text-[var(--fg-alert)]"
                onClick={() => removeAction(index)}
                type="button"
                aria-label="Remove action"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {action.type === "deletePermanently" && (
              <div className="flex items-center gap-2 mt-2 text-xs text-red-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>
                  {allowPermanentDelete
                    ? "Files will be permanently deleted and cannot be recovered."
                    : "Permanent deletes are disabled in settings."}
                </span>
              </div>
            )}
          </div>
        );
      })}
      <button
        className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
        type="button"
        onClick={() => addAction()}
      >
        <Plus className="h-3 w-3" />
        Add action
      </button>
      <ConfirmDialog
        isOpen={confirmDeleteIndex !== null}
        onClose={() => setConfirmDeleteIndex(null)}
        onConfirm={() => {
          if (confirmDeleteIndex !== null) {
            updateAction(confirmDeleteIndex, createAction("deletePermanently"));
          }
          setConfirmDeleteIndex(null);
        }}
        title="Delete permanently?"
        message="This action permanently deletes files and cannot be undone."
        confirmLabel="Add Action"
        variant="danger"
      />
    </div>
  );
}

function createAction(type: string): Action {
  switch (type) {
    case "copy":
      return {
        type: "copy",
        destination: "",
        onConflict: "rename",
        skipDuplicates: false,
      };
    case "rename":
      return { type: "rename", pattern: "", onConflict: "rename" };
    case "sortIntoSubfolder":
      return { type: "sortIntoSubfolder", destination: "", onConflict: "rename" };
    case "archive":
      return {
        type: "archive",
        destination: "",
        format: "zip",
        deleteAfter: false,
      };
    case "unarchive":
      return {
        type: "unarchive",
        destination: "",
        deleteAfter: false,
      };
    case "delete":
      return { type: "delete", permanent: false };
    case "deletePermanently":
      return { type: "deletePermanently", permanent: true };
    case "runScript":
      return { type: "runScript", command: "" };
    case "notify":
      return { type: "notify", message: "" };
    case "open":
      return { type: "open" };
    case "openWith":
      return { type: "openWith", appPath: "" };
    case "makePdfSearchable":
      return { type: "makePdfSearchable", skipIfText: true, overwrite: true };
    case "showInFileManager":
      return { type: "showInFileManager" };
    case "pause":
      return { type: "pause", durationSeconds: 5 };
    case "continue":
      return { type: "continue" };
    case "ignore":
      return { type: "ignore" };
    case "move":
    default:
      return {
        type: "move",
        destination: "",
        onConflict: "rename",
        skipDuplicates: false,
      };
  }
}

async function pickFolder(currentPath?: string): Promise<string | null> {
  try {
    const selected = await openFolderDialog({
      directory: true,
      multiple: false,
      defaultPath: currentPath || undefined,
      title: "Select destination folder",
    });
    return selected as string | null;
  } catch {
    return null;
  }
}

function FolderInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const handlePickFolder = async () => {
    const folder = await pickFolder(value || undefined);
    if (folder) {
      onChange(folder);
    }
  };

  return (
    <div className="flex items-center gap-1.5 min-w-[220px]">
      <input
        className={`${fieldClass} flex-1`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={handlePickFolder}
        className="flex items-center justify-center h-[30px] w-[30px] rounded-[var(--radius)] border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] hover:border-[var(--border-strong)] transition-colors"
        title="Browse for folder"
      >
        <FolderOpen className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Sample file info for preview
const SAMPLE_FILE = {
  name: "document",
  ext: "pdf",
  fullname: "document.pdf",
  date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  time: new Date().toTimeString().slice(0, 8).replace(/:/g, "-"), // HH-MM-SS
  year: new Date().getFullYear().toString(),
  month: String(new Date().getMonth() + 1).padStart(2, "0"),
  day: String(new Date().getDate()).padStart(2, "0"),
  hour: String(new Date().getHours()).padStart(2, "0"),
  minute: String(new Date().getMinutes()).padStart(2, "0"),
  second: String(new Date().getSeconds()).padStart(2, "0"),
  counter: "1",
  random: Math.random().toString(36).substring(2, 8),
};

function resolvePatternPreview(pattern: string): string {
  if (!pattern) return "";

  let output = pattern;
  const tokens: Record<string, string> = {
    name: SAMPLE_FILE.name,
    ext: SAMPLE_FILE.ext,
    fullname: SAMPLE_FILE.fullname,
    date: SAMPLE_FILE.date,
    time: SAMPLE_FILE.time,
    year: SAMPLE_FILE.year,
    month: SAMPLE_FILE.month,
    day: SAMPLE_FILE.day,
    hour: SAMPLE_FILE.hour,
    minute: SAMPLE_FILE.minute,
    second: SAMPLE_FILE.second,
    counter: SAMPLE_FILE.counter,
    random: SAMPLE_FILE.random,
    weekday: "Mon",
    monthname: "Jan",
  };

  // Replace all {token} patterns
  output = output.replace(/\{([^}:]+)(?::[^}]*)?\}/g, (match, token) => {
    return tokens[token] ?? match;
  });

  return output;
}

function RenamePreview({ pattern }: { pattern: string }) {
  const preview = resolvePatternPreview(pattern);

  if (!pattern) {
    return (
      <div className="text-[11px] text-[var(--fg-muted)] pl-1">
        Available tokens: {"{name}"}, {"{ext}"}, {"{date}"}, {"{year}"}, {"{month}"}, {"{day}"}, {"{counter}"}, {"{random}"}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px] pl-1">
      <span className="text-[var(--fg-muted)]">Preview:</span>
      <span className="text-[var(--fg-secondary)] font-mono">{SAMPLE_FILE.fullname}</span>
      <span className="text-[var(--fg-muted)]">→</span>
      <span className="text-[var(--accent)] font-medium font-mono">{preview}</span>
    </div>
  );
}

function DestinationPreview({ destination }: { destination: string }) {
  if (!destination) {
    return (
      <div className="text-[11px] text-[var(--fg-muted)]">
        Tokens available: {"{name}"}, {"{ext}"}, {"{date}"}, {"{year}"}, {"{month}"}, {"{day}"}
      </div>
    );
  }
  const preview = resolvePatternPreview(destination);
  return (
    <div className="text-[11px] text-[var(--fg-muted)]">
      Preview: <span className="font-mono text-[var(--fg-secondary)]">{preview}</span>
    </div>
  );
}

function conflictHint(mode: ConflictResolution) {
  switch (mode) {
    case "rename":
      return "If a file exists, add a suffix to keep both.";
    case "replace":
      return "If a file exists, overwrite it.";
    case "skip":
      return "If a file exists, skip this action.";
    default:
      return "";
  }
}

function renderActionFields(action: Action, onChange: (action: Action) => void) {
  if (action.type === "move" || action.type === "copy" || action.type === "sortIntoSubfolder") {
    return (
      <>
        <span className="text-[13px] text-[var(--fg-muted)]">to folder:</span>
        <FolderInput
          value={action.destination}
          onChange={(val) => onChange({ ...action, destination: val })}
            placeholder="Select folder…"
        />
        <MagiSelect
          width="w-32"
          value={action.onConflict}
          onChange={(val) =>
            onChange({ ...action, onConflict: val as ConflictResolution })
          }
          options={conflictOptions}
          ariaLabel="On conflict"
        />
        <div className="w-full space-y-1 pl-1">
          <DestinationPreview destination={action.destination} />
          <div className="text-[11px] text-[var(--fg-muted)]">
            {conflictHint(action.onConflict)}
          </div>
        </div>
        {action.type !== "sortIntoSubfolder" ? (
          <label className="flex items-center gap-2 text-[11px] text-[var(--fg-secondary)]">
            <input
              className="accent-[var(--accent)]"
              type="checkbox"
              checked={action.skipDuplicates}
              onChange={(e) => onChange({ ...action, skipDuplicates: e.target.checked })}
            />
            Skip duplicates
          </label>
        ) : null}
      </>
    );
  }

  if (action.type === "rename") {
    return (
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-[var(--fg-muted)]">to:</span>
          <input
            className={longFieldClass}
            placeholder="e.g. {date}_{name}.{ext}"
            value={action.pattern}
            onChange={(e) => onChange({ ...action, pattern: e.target.value })}
          />
          <MagiSelect
            width="w-32"
            value={action.onConflict}
            onChange={(val) =>
              onChange({ ...action, onConflict: val as ConflictResolution })
            }
            options={conflictOptions}
            ariaLabel="On conflict"
          />
        </div>
        <RenamePreview pattern={action.pattern} />
      </div>
    );
  }

  if (action.type === "archive") {
    return (
      <>
        <span className="text-[13px] text-[var(--fg-muted)]">to:</span>
        <FolderInput
          value={action.destination}
          onChange={(val) => onChange({ ...action, destination: val })}
          placeholder="Select destination…"
        />
        <MagiSelect
          width="w-32"
          value={action.format}
          onChange={(val) =>
            onChange({
              ...action,
              format: val as ArchiveFormat,
            })
          }
          options={[
            { label: "zip", value: "zip" },
            { label: "tar", value: "tar" },
            { label: "tar.gz", value: "tarGz" },
          ]}
          ariaLabel="Archive format"
        />
        <label className="flex items-center gap-2 text-[11px] text-[var(--fg-secondary)]">
          <input
            className="accent-[var(--accent)]"
            type="checkbox"
            checked={action.deleteAfter}
            onChange={(e) => onChange({ ...action, deleteAfter: e.target.checked })}
          />
          Delete original
        </label>
      </>
    );
  }

  if (action.type === "unarchive") {
    return (
      <>
        <span className="text-[13px] text-[var(--fg-muted)]">to:</span>
        <FolderInput
          value={action.destination ?? ""}
          onChange={(val) => onChange({ ...action, destination: val || undefined })}
          placeholder="Same folder (optional)"
        />
        <label className="flex items-center gap-2 text-[11px] text-[var(--fg-secondary)]">
          <input
            className="accent-[var(--accent)]"
            type="checkbox"
            checked={action.deleteAfter}
            onChange={(e) => onChange({ ...action, deleteAfter: e.target.checked })}
          />
          Delete archive
        </label>
      </>
    );
  }

  if (action.type === "runScript") {
    return (
      <input
        className={longFieldClass}
        placeholder="Command"
        value={action.command}
        onChange={(e) => onChange({ ...action, command: e.target.value })}
      />
    );
  }

  if (action.type === "notify") {
    return (
      <input
        className={longFieldClass}
        placeholder="Notification message"
        value={action.message}
        onChange={(e) => onChange({ ...action, message: e.target.value })}
      />
    );
  }

  if (action.type === "pause") {
    return (
      <>
        <input
          className={`${fieldClass} w-20`}
          type="number"
          min={1}
          value={action.durationSeconds}
          onChange={(e) =>
            onChange({ ...action, durationSeconds: Number(e.target.value) })
          }
        />
        <span className="text-[11px] text-[var(--fg-secondary)]">seconds</span>
      </>
    );
  }

  if (action.type === "openWith") {
    return (
      <input
        className={longFieldClass}
        placeholder="Path to application"
        value={action.appPath}
        onChange={(e) => onChange({ ...action, appPath: e.target.value })}
      />
    );
  }

  if (action.type === "makePdfSearchable") {
    return (
      <>
        <MagiSelect
          width="w-44"
          value={action.overwrite ? "overwrite" : "copy"}
          onChange={(val) =>
            onChange({ ...action, overwrite: val === "overwrite" })
          }
          options={[
            { label: "Overwrite original", value: "overwrite" },
            { label: "Save copy (same folder)", value: "copy" },
          ]}
          ariaLabel="PDF output mode"
        />
        <label className="flex items-center gap-2 text-[11px] text-[var(--fg-secondary)]">
          <input
            className="accent-[var(--accent)]"
            type="checkbox"
            checked={action.skipIfText}
            onChange={(e) => onChange({ ...action, skipIfText: e.target.checked })}
          />
          Skip if text already exists
        </label>
        <span className="text-[11px] text-[var(--fg-muted)]">
          Adds a selectable text layer using OCR.
        </span>
      </>
    );
  }

  return null;
}
