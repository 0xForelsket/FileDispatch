import { Plus, X } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
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
  { value: "size", label: "Size" },
  { value: "dateCreated", label: "Date Created" },
  { value: "dateModified", label: "Date Modified" },
  { value: "dateAdded", label: "Date Added" },
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
  { value: "all", label: "All" },
  { value: "any", label: "Any" },
  { value: "none", label: "None" },
];

const fieldClass =
  "rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20";

export function ConditionBuilder({ group, onChange, depth = 0 }: ConditionBuilderProps) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
          Match
        </span>
        <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/60 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
          {matchOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateGroup({ matchType: option.value })}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                group.matchType === option.value
                  ? "bg-blue-500/10 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {group.conditions.map((condition, index) => {
        if (condition.type === "nested") {
          return (
            <GlassCard
              key={index}
              className={`space-y-3 p-4 ${depth > 0 ? "bg-white/30 dark:bg-white/5" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                  Nested Group
                </span>
                <button
                  className="rounded-full border border-transparent p-1 text-slate-400 transition-colors hover:border-white/40 hover:bg-white/60 hover:text-slate-700 dark:text-neutral-500 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-neutral-200"
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
            </GlassCard>
          );
        }

        return (
          <GlassCard key={index} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={fieldClass}
                value={condition.type}
                onChange={(e) => updateCondition(index, createCondition(e.target.value))}
              >
                {conditionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {renderConditionFields(condition, (updated) => updateCondition(index, updated))}
              <button
                className="ml-auto rounded-full border border-transparent p-1 text-slate-400 transition-colors hover:border-white/40 hover:bg-white/60 hover:text-slate-700 dark:text-neutral-500 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-neutral-200"
                onClick={() => removeCondition(index)}
                type="button"
                aria-label="Remove condition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </GlassCard>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/40 bg-white/40 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-white/70 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
          type="button"
          onClick={() => addCondition()}
        >
          <Plus className="h-4 w-4" />
          Add Condition
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/40 bg-white/40 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-white/70 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
          type="button"
          onClick={addGroup}
        >
          <Plus className="h-4 w-4" />
          Add Group
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
    case "size":
      return { type: "size", operator: { type: "greaterThan" }, value: 1, unit: "megabytes" };
    case "dateCreated":
      return { type: "dateCreated", operator: { type: "is", date: "" } };
    case "dateModified":
      return { type: "dateModified", operator: { type: "is", date: "" } };
    case "dateAdded":
      return { type: "dateAdded", operator: { type: "is", date: "" } };
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
    condition.type === "fullName"
  ) {
    return (
      <>
        <select
          className={fieldClass}
          value={condition.operator}
          onChange={(e) =>
            onChange({ ...condition, operator: e.target.value as StringOperator })
          }
        >
          {stringOperators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
        <input
          className={fieldClass}
          placeholder="Value"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
        <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
          <input
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
        <select
          className={fieldClass}
          value={operator.type}
          onChange={(e) => {
            const selected = sizeOperators.find((op) => op.value.type === e.target.value);
            onChange({
              ...condition,
              operator: selected?.value ?? { type: "greaterThan" },
            });
          }}
        >
          {sizeOperators.map((op) => (
            <option key={op.value.type} value={op.value.type}>
              {op.label}
            </option>
          ))}
        </select>
        {operator.type === "between" ? (
          <>
            <input
              className="w-20 rounded-xl border border-white/50 bg-white/70 px-2 py-1 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
              type="number"
              value={operator.min}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, min: Number(e.target.value) },
                })
              }
            />
            <span className="text-[11px] text-slate-400 dark:text-neutral-500">and</span>
            <input
              className="w-20 rounded-xl border border-white/50 bg-white/70 px-2 py-1 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
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
            className="w-20 rounded-xl border border-white/50 bg-white/70 px-2 py-1 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
            type="number"
            value={condition.value ?? 0}
            onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
          />
        )}
        <select
          className={fieldClass}
          value={condition.unit}
          onChange={(e) => onChange({ ...condition, unit: e.target.value as SizeUnit })}
        >
          <option value="bytes">Bytes</option>
          <option value="kilobytes">KB</option>
          <option value="megabytes">MB</option>
          <option value="gigabytes">GB</option>
        </select>
      </>
    );
  }

  if (
    condition.type === "dateCreated" ||
    condition.type === "dateModified" ||
    condition.type === "dateAdded"
  ) {
    const operator = condition.operator;
    return (
      <>
        <select
          className={fieldClass}
          value={operator.type}
          onChange={(e) => {
            const selected = dateOperators.find((op) => op.value.type === e.target.value);
            onChange({
              ...condition,
              operator: selected?.value ?? { type: "is", date: "" },
            });
          }}
        >
          {dateOperators.map((op) => (
            <option key={op.value.type} value={op.value.type}>
              {op.label}
            </option>
          ))}
        </select>
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
              className="w-20 rounded-xl border border-white/50 bg-white/70 px-2 py-1 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
              type="number"
              value={operator.amount}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, amount: Number(e.target.value) },
                })
              }
            />
            <select
              className={fieldClass}
              value={operator.unit}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, unit: e.target.value as TimeUnit },
                })
              }
            >
              {timeUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
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
        <select
          className={fieldClass}
          value={operator.type}
          onChange={(e) => {
            const selected = timeOperators.find((op) => op.value.type === e.target.value);
            onChange({
              ...condition,
              operator: selected?.value ?? { type: "is", time: defaultTime },
            });
          }}
        >
          {timeOperators.map((op) => (
            <option key={op.value.type} value={op.value.type}>
              {op.label}
            </option>
          ))}
        </select>
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
        <select
          className={fieldClass}
          value={condition.kind}
          onChange={(e) => onChange({ ...condition, kind: e.target.value as FileKind })}
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
          <input
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
        className="min-w-[260px] rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-500/20"
        placeholder="bash command"
        value={condition.command}
        onChange={(e) => onChange({ ...condition, command: e.target.value })}
      />
    );
  }

  return null;
}
