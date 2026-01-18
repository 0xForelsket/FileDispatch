import type {
  Condition,
  ConditionGroup,
  MatchType,
  StringOperator,
  ComparisonOperator,
  DateOperator,
  TimeUnit,
  FileKind,
  SizeUnit,
} from "@/types";

interface ConditionBuilderProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
}

const conditionTypes = [
  { value: "name", label: "Name" },
  { value: "extension", label: "Extension" },
  { value: "fullName", label: "Full Name" },
  { value: "size", label: "Size" },
  { value: "dateCreated", label: "Date Created" },
  { value: "dateModified", label: "Date Modified" },
  { value: "dateAdded", label: "Date Added" },
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

const dateOperators: { value: DateOperator; label: string }[] = [
  { value: { type: "is", date: today }, label: "is" },
  { value: { type: "isBefore", date: today }, label: "is before" },
  { value: { type: "isAfter", date: today }, label: "is after" },
  { value: { type: "between", start: today, end: today }, label: "between" },
  { value: { type: "inTheLast", amount: 1, unit: "days" }, label: "in the last" },
  { value: { type: "notInTheLast", amount: 1, unit: "days" }, label: "not in the last" },
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

export function ConditionBuilder({ group, onChange }: ConditionBuilderProps) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase text-muted-foreground">Match</span>
        <select
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          value={group.matchType}
          onChange={(e) => updateGroup({ matchType: e.target.value as MatchType })}
        >
          <option value="all">All</option>
          <option value="any">Any</option>
          <option value="none">None</option>
        </select>
      </div>

      {group.conditions.map((condition, index) => (
        <div key={index} className="rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
              className="ml-auto text-xs text-destructive"
              onClick={() => removeCondition(index)}
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm"
        type="button"
        onClick={() => addCondition()}
      >
        + Add Condition
      </button>
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
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          placeholder="Value"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
        <label className="flex items-center gap-1 text-xs">
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
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
              className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
              type="number"
              value={operator.min}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: { ...operator, min: Number(e.target.value) },
                })
              }
            />
            <span className="text-xs text-muted-foreground">and</span>
            <input
              className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
            className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            type="number"
            value={condition.value ?? 0}
            onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
          />
        )}
        <select
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
              className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
              className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
              className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
              className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
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

  if (condition.type === "kind") {
    return (
      <>
        <select
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          value={condition.kind}
          onChange={(e) => onChange({ ...condition, kind: e.target.value as FileKind })}
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs">
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
        className="min-w-[260px] rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        placeholder="bash command"
        value={condition.command}
        onChange={(e) => onChange({ ...condition, command: e.target.value })}
      />
    );
  }

  return null;
}
