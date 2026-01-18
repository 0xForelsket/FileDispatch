import { Plus, X } from "lucide-react";
import { MagiSelect } from "@/components/ui/MagiSelect";


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
  "rounded-none bg-black border border-[var(--border-dim)] px-2 py-1 text-sm text-[var(--fg-primary)] font-bold font-mono shadow-none outline-none focus:border-[var(--fg-primary)] focus:text-[var(--fg-primary)] transition-colors";
const longFieldClass = `${fieldClass} min-w-[220px]`;

export function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
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

  return (
    <div className="space-y-3">
      {actions.map((action, index) => (
        <div key={index} className="p-3 magi-border-sm bg-black relative hover:border-[var(--fg-secondary)] transition-colors">
          <div className="flex flex-wrap items-center gap-2">
            <MagiSelect
              width="w-40"
              value={action.type}
              onChange={(val) => updateAction(index, createAction(val))}
              options={actionTypes}
            />
            {renderActionFields(action, (updated) => updateAction(index, updated))}
            <button
              className="ml-auto p-1 text-[var(--fg-alert)] hover:bg-[var(--fg-alert)] hover:text-black"
              onClick={() => removeAction(index)}
              type="button"
              aria-label="Remove action"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        className="flex items-center gap-2 px-3 py-1.5 bg-black border border-[var(--fg-secondary)] text-[var(--fg-secondary)] hover:bg-[var(--fg-secondary)] hover:text-black text-xs font-bold font-mono tracking-wider uppercase"
        type="button"
        onClick={() => addAction()}
      >
        <Plus className="h-3 w-3" />
        Execute Action
      </button>
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

function renderActionFields(action: Action, onChange: (action: Action) => void) {
  if (action.type === "move" || action.type === "copy" || action.type === "sortIntoSubfolder") {
    return (
      <>
        <input
          className={longFieldClass}
          placeholder="Destination path"
          value={action.destination}
          onChange={(e) => onChange({ ...action, destination: e.target.value })}
        />
        <MagiSelect
          width="w-32"
          value={action.onConflict}
          onChange={(val) =>
            onChange({ ...action, onConflict: val as ConflictResolution })
          }
          options={conflictOptions}
        />
        {action.type !== "sortIntoSubfolder" ? (
          <label className="flex items-center gap-2 text-[11px] text-gray-600">
            <input
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
      <>
        <input
          className={longFieldClass}
          placeholder="New name pattern"
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
        />
      </>
    );
  }

  if (action.type === "archive") {
    return (
      <>
        <input
          className={longFieldClass}
          placeholder="Destination (folder or file path)"
          value={action.destination}
          onChange={(e) => onChange({ ...action, destination: e.target.value })}
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
        />
        <label className="flex items-center gap-2 text-[11px] text-gray-600">
          <input
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
        <input
          className={longFieldClass}
          placeholder="Destination (optional)"
          value={action.destination ?? ""}
          onChange={(e) =>
            onChange({ ...action, destination: e.target.value || undefined })
          }
        />
        <label className="flex items-center gap-2 text-[11px] text-gray-600">
          <input
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
        <span className="text-[11px] text-gray-600">seconds</span>
      </>
    );
  }

  return null;
}
