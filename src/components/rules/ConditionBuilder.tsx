import { useState } from "react";
import { GripVertical, LayersPlus, Plus, X } from "lucide-react";
import { MagiSelect } from "@/components/ui/MagiSelect";


import type {
  Condition,
  ConditionGroup,
  MatchType,
  StringOperator,
  ComparisonOperator,
  DateOperator,
  TimeOperator,
  TimeUnit,
  FileKind,
  SizeUnit,
} from "@/types";

interface ConditionBuilderProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  depth?: number;
}

const conditionTypes = [
  { value: "name", label: "Name" },
  { value: "extension", label: "Extension" },
  { value: "fullName", label: "Full Name" },
  { value: "contents", label: "Contents" },
  { value: "size", label: "Size" },
  { value: "dateCreated", label: "Date Created" },
  { value: "dateModified", label: "Date Modified" },
  { value: "dateAdded", label: "Date Added" },
  { value: "dateLastMatched", label: "Date Last Matched" },
  { value: "currentTime", label: "Current Time" },
  { value: "kind", label: "Kind" },
  { value: "shellScript", label: "Shell Script" },
];

const stringOperators: { value: StringOperator; label: string }[] = [
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "doesNotContain", label: "does not contain" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "matches", label: "matches regex" },
  { value: "doesNotMatch", label: "does not match" },
];

const sizeOperators: { value: ComparisonOperator; label: string }[] = [
  { value: { type: "equals" }, label: "equals" },
  { value: { type: "notEquals" }, label: "not equals" },
  { value: { type: "greaterThan" }, label: "greater than" },
  { value: { type: "lessThan" }, label: "less than" },
  { value: { type: "greaterOrEqual" }, label: "greater or equal" },
  { value: { type: "lessOrEqual" }, label: "less or equal" },
  { value: { type: "between", min: 0, max: 0 }, label: "between" },
];

const today = (() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
})();

const defaultTime = "09:00";

const dateOperators: { value: DateOperator; label: string }[] = [
  { value: { type: "is", date: today }, label: "is" },
  { value: { type: "isBefore", date: today }, label: "is before" },
  { value: { type: "isAfter", date: today }, label: "is after" },
  { value: { type: "between", start: today, end: today }, label: "between" },
  { value: { type: "inTheLast", amount: 1, unit: "days" }, label: "in the last" },
  { value: { type: "notInTheLast", amount: 1, unit: "days" }, label: "not in the last" },
];

const timeOperators: { value: TimeOperator; label: string }[] = [
  { value: { type: "is", time: defaultTime }, label: "is" },
  { value: { type: "isBefore", time: defaultTime }, label: "is before" },
  { value: { type: "isAfter", time: defaultTime }, label: "is after" },
  { value: { type: "between", start: defaultTime, end: defaultTime }, label: "between" },
];

const timeUnits: TimeUnit[] = ["minutes", "hours", "days", "weeks", "months", "years"];

const kinds: FileKind[] = [
  "file",
  "folder",
  "image",
  "video",
  "audio",
  "document",
  "archive",
  "code",
  "other",
];

const matchOptions: { value: MatchType; label: string }[] = [
  { value: "all", label: "all" },
  { value: "any", label: "any" },
  { value: "none", label: "none" },
];

const fieldClass =
  "rounded-[var(--radius)] bg-[var(--bg-panel)] border border-[var(--border-main)] px-2 py-1 text-sm text-[var(--fg-primary)] shadow-none outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent)]";
const smallFieldClass = `${fieldClass} w-20`;
const longFieldClass = `${fieldClass} min-w-[220px]`;
const addConditionButtonClass =
  "flex items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]";
const addGroupButtonClass =
  "flex items-center gap-2 rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--accent-hover)]";
const addControlsWrapperClass =
  "flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)]/60 px-2.5 py-2";

export function ConditionBuilder({ group, onChange, depth = 0 }: ConditionBuilderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const isNested = depth > 0;

  const updateGroup = (updates: Partial<ConditionGroup>) =>
    onChange({ ...group, ...updates });

  const updateCondition = (index: number, updated: Condition) => {
    const next = [...group.conditions];
    next[index] = updated;
    updateGroup({ conditions: next });
  };

  const removeCondition = (index: number) => {
    const next = group.conditions.filter((_, idx) => idx !== index);
    updateGroup({ conditions: next });
  };

  const addCondition = (type = "name") => {
    updateGroup({ conditions: [...group.conditions, createCondition(type)] });
  };

  const addGroup = () => {
    updateGroup({
      conditions: [
        ...group.conditions,
        {
          type: "nested",
          matchType: "all",
          conditions: [],
        },
      ],
    });
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
      const next = [...group.conditions];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(dragOverIndex, 0, removed);
      updateGroup({ conditions: next });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div
      className={`space-y-3 ${
        isNested
          ? "relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-main)]/70 before:content-['']"
          : ""
      }`}
    >
      {/* Natural language header: "If [all] of the following conditions are met" */}
      <div
        className={`flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--fg-secondary)] ${
          isNested
            ? "relative before:absolute before:-left-4 before:top-1/2 before:h-px before:w-3 before:bg-[var(--border-main)]/70 before:content-['']"
            : ""
        }`}
      >
        <span>If</span>
        <MagiSelect
          width="w-20"
          value={group.matchType}
          onChange={(val) => updateGroup({ matchType: val as MatchType })}
          options={matchOptions}
        />
        <span>of the following conditions are met</span>
      </div>

      {group.conditions.map((condition, index) => {
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index;

        if (condition.type === "nested") {
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
              className={`space-y-3 rounded-[var(--radius)] border bg-[var(--bg-subtle)] p-3 ml-4 transition-all ${
                isDragging ? "opacity-50 scale-[0.98]" : ""
              } ${isDragOver ? "border-[var(--accent)] border-2" : "border-[var(--border-main)]"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="cursor-grab active:cursor-grabbing text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]">
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
                    Nested group
                  </span>
                </div>
                <button
                  className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--fg-alert)]/15 hover:text-[var(--fg-alert)]"
                  onClick={() => removeCondition(index)}
                  type="button"
                  aria-label="Remove group"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ConditionBuilder
                group={{
                  matchType: condition.matchType,
                  conditions: condition.conditions,
                }}
                onChange={(nextGroup) =>
                  updateCondition(index, {
                    type: "nested",
                    matchType: nextGroup.matchType,
                    conditions: nextGroup.conditions,
                  })
                }
                depth={depth + 1}
              />
            </div>
          );
        }

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
            className={`group rounded-[var(--radius)] border bg-[var(--bg-panel)] p-2 transition-all ${
              isDragging ? "opacity-50 scale-[0.98]" : "hover:border-[var(--border-strong)]"
            } ${isDragOver ? "border-[var(--accent)] border-2" : "border-[var(--border-main)]"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="cursor-grab active:cursor-grabbing text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--fg-secondary)]">
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <MagiSelect
                width="w-40"
                value={condition.type}
                onChange={(val) => updateCondition(index, createCondition(val))}
                options={conditionTypes}
              />
              {renderConditionFields(condition, (updated) => updateCondition(index, updated))}
              <button
                className="ml-auto rounded-[var(--radius)] p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--fg-alert)]/15 hover:text-[var(--fg-alert)]"
                onClick={() => removeCondition(index)}
                type="button"
                aria-label="Remove condition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
      <div className={addControlsWrapperClass}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Add
        </span>
        <button
          className={addConditionButtonClass}
          type="button"
          onClick={() => addCondition()}
        >
          <Plus className="h-3 w-3" />
          Add condition
        </button>
        <button
          className={addGroupButtonClass}
          type="button"
          onClick={addGroup}
        >
          <LayersPlus className="h-3 w-3" />
          Add rule group
        </button>
      </div>
    </div>
  );
}

function createCondition(type: string): Condition {
  switch (type) {
    case "extension":
      return { type: "extension", operator: "is", value: "", caseSensitive: false };
    case "fullName":
      return { type: "fullName", operator: "is", value: "", caseSensitive: false };
    case "contents":
      return { type: "contents", operator: "contains", value: "", caseSensitive: false, source: "auto" };
    case "size":
      return { type: "size", operator: { type: "greaterThan" }, value: 1, unit: "megabytes" };
    case "dateCreated":
      return { type: "dateCreated", operator: { type: "is", date: "" } };
    case "dateModified":
      return { type: "dateModified", operator: { type: "is", date: "" } };
    case "dateAdded":
      return { type: "dateAdded", operator: { type: "is", date: "" } };
    case "dateLastMatched":
      return { type: "dateLastMatched", operator: { type: "inTheLast", amount: 7, unit: "days" } };
    case "currentTime":
      return { type: "currentTime", operator: { type: "is", time: defaultTime } };
    case "kind":
      return { type: "kind", kind: "file", negate: false };
    case "shellScript":
      return { type: "shellScript", command: "" };
    case "name":
    default:
      return { type: "name", operator: "contains", value: "", caseSensitive: false };
  }
}

function renderConditionFields(
  condition: Condition,
  onChange: (condition: Condition) => void,
) {
  if (
    condition.type === "name" ||
    condition.type === "extension" ||
    condition.type === "fullName" ||
    condition.type === "contents"
  ) {
    return (
      <>
        <MagiSelect
          width="w-36"
          value={condition.operator}
          onChange={(val) =>
            onChange({ ...condition, operator: val as StringOperator })
          }
          options={stringOperators}
        />
        <input
          className={fieldClass}
          placeholder="Value"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
        {condition.type === "contents" ? (
          <MagiSelect
            width="w-28"
            value={condition.source}
            onChange={(val) => onChange({ ...condition, source: val as "text" | "ocr" | "auto" })}
            options={[
              { label: "Auto", value: "auto" },
              { label: "Text", value: "text" },
              { label: "OCR", value: "ocr" },
            ]}
          />
        ) : null}
        <label className="flex items-center gap-2 text-[11px] text-[var(--fg-secondary)]">
          <input
            className="accent-[var(--accent)]"
            type="checkbox"
            checked={condition.caseSensitive}
            onChange={(e) => onChange({ ...condition, caseSensitive: e.target.checked })}
          />
          Case sensitive
        </label>
      </>
    );
  }

  if (condition.type === "size") {
    const operator = condition.operator;
    return (
      <>
        <MagiSelect
          width="w-32"
          value={operator.type}
          onChange={(val) => {
            const selected = sizeOperators.find((op) => op.value.type === val);
            onChange({
              ...condition,
              operator: selected?.value ?? { type: "greaterThan" },
            });
          }}
          options={sizeOperators.map(op => ({ label: op.label, value: op.value.type }))}
        />
        {operator.type === "between" ? (
          <>
            <input
              className={smallFieldClass}
              type="number"
              value={operator.min}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, min: Number(e.target.value) },
                })
              }
            />
            <span className="text-[11px] text-[var(--fg-muted)]">and</span>
            <input
              className={smallFieldClass}
              type="number"
              value={operator.max}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, max: Number(e.target.value) },
                })
              }
            />
          </>
        ) : (
          <input
            className={smallFieldClass}
            type="number"
            value={condition.value ?? 0}
            onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
          />
        )}
        <MagiSelect
          width="w-24"
          value={condition.unit}
          onChange={(val) => onChange({ ...condition, unit: val as SizeUnit })}
          options={[
             { label: "Bytes", value: "bytes" },
             { label: "KB", value: "kilobytes" },
             { label: "MB", value: "megabytes" },
             { label: "GB", value: "gigabytes" }
          ]}
        />
      </>
    );
  }

  if (
    condition.type === "dateCreated" ||
    condition.type === "dateModified" ||
    condition.type === "dateAdded" ||
    condition.type === "dateLastMatched"
  ) {
    const operator = condition.operator;
    return (
      <>
        <MagiSelect
          width="w-32"
          value={operator.type}
          onChange={(val) => {
            const selected = dateOperators.find((op) => op.value.type === val);
            onChange({
              ...condition,
              operator: selected?.value ?? { type: "is", date: "" },
            });
          }}
          options={dateOperators.map(op => ({ label: op.label, value: op.value.type }))}
        />
        {operator.type === "between" ? (
          <>
            <input
              className={fieldClass}
              type="date"
              value={operator.start}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, start: e.target.value },
                })
              }
            />
            <input
              className={fieldClass}
              type="date"
              value={operator.end}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, end: e.target.value },
                })
              }
            />
          </>
        ) : operator.type === "inTheLast" || operator.type === "notInTheLast" ? (
          <>
            <input
              className={smallFieldClass}
              type="number"
              value={operator.amount}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, amount: Number(e.target.value) },
                })
              }
            />
            <MagiSelect
              width="w-24"
              value={operator.unit}
              onChange={(val) =>
                onChange({
                  ...condition,
                  operator: { ...operator, unit: val as TimeUnit },
                })
              }
              options={timeUnits.map(unit => ({ label: unit, value: unit }))}
            />
          </>
        ) : (
          <input
            className={fieldClass}
            type="date"
            value={"date" in operator ? operator.date : ""}
            onChange={(e) =>
              onChange({
                ...condition,
                operator: { ...operator, date: e.target.value } as DateOperator,
              })
            }
          />
        )}
      </>
    );
  }

  if (condition.type === "currentTime") {
    const operator = condition.operator;
    return (
      <>
        <MagiSelect
          width="w-32"
          value={operator.type}
          onChange={(val) => {
            const selected = timeOperators.find((op) => op.value.type === val);
            onChange({
              ...condition,
              operator: selected?.value ?? { type: "is", time: defaultTime },
            });
          }}
          options={timeOperators.map(op => ({ label: op.label, value: op.value.type }))}
        />
        {operator.type === "between" ? (
          <>
            <input
              className={fieldClass}
              type="time"
              value={operator.start}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, start: e.target.value },
                })
              }
            />
            <input
              className={fieldClass}
              type="time"
              value={operator.end}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, end: e.target.value },
                })
              }
            />
          </>
        ) : (
          <input
            className={fieldClass}
            type="time"
            value={"time" in operator ? operator.time : defaultTime}
            onChange={(e) =>
              onChange({
                ...condition,
                operator: { ...operator, time: e.target.value } as TimeOperator,
              })
            }
          />
        )}
      </>
    );
  }

  if (condition.type === "kind") {
    return (
      <>
        <MagiSelect
          width="w-32"
          value={condition.kind}
          onChange={(val) => onChange({ ...condition, kind: val as FileKind })}
          options={kinds.map(k => ({ label: k, value: k }))}
        />
        <label className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
          <input
            className="accent-[var(--accent)]"
            type="checkbox"
            checked={condition.negate}
            onChange={(e) => onChange({ ...condition, negate: e.target.checked })}
          />
          Not
        </label>
      </>
    );
  }

  if (condition.type === "shellScript") {
    return (
      <input
        className={longFieldClass}
        placeholder="bash command"
        value={condition.command}
        onChange={(e) => onChange({ ...condition, command: e.target.value })}
      />
    );
  }

  return null;
}
