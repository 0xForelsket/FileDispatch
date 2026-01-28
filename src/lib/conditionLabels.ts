import type { Condition } from "@/types";

export function describeCondition(condition: Condition): string {
  switch (condition.type) {
    case "name":
      return `Name ${formatStringOperator(condition.operator)} ${formatValue(condition.value)}`;
    case "extension":
      return `Extension ${formatStringOperator(condition.operator)} ${formatValue(condition.value)}`;
    case "fullName":
      return `Full name ${formatStringOperator(condition.operator)} ${formatValue(condition.value)}`;
    case "contents":
      return `Contents ${formatStringOperator(condition.operator)} ${formatValue(condition.value)}`;
    case "size":
      return `Size ${formatComparisonOperator(condition.operator)} ${condition.value ?? "…" } ${condition.unit}`;
    case "dateCreated":
      return `Date created ${formatDateOperator(condition.operator)}`;
    case "dateModified":
      return `Date modified ${formatDateOperator(condition.operator)}`;
    case "dateAdded":
      return `Date added ${formatDateOperator(condition.operator)}`;
    case "dateLastMatched":
      return `Date last matched ${formatDateOperator(condition.operator)}`;
    case "currentTime":
      return `Current time ${formatTimeOperator(condition.operator)}`;
    case "kind":
      return `${condition.negate ? "Not " : ""}${condition.kind}`;
    case "shellScript":
      return "Shell script";
    case "nested":
      return condition.label?.trim()
        ? `Group "${condition.label.trim()}" (${condition.matchType.toUpperCase()}, ${condition.conditions.length})`
        : `Nested ${condition.matchType.toUpperCase()} (${condition.conditions.length})`;
    default:
      return "Condition";
  }
}

function formatStringOperator(operator: string) {
  switch (operator) {
    case "is":
      return "is";
    case "isNot":
      return "is not";
    case "contains":
      return "contains";
    case "doesNotContain":
      return "does not contain";
    case "startsWith":
      return "starts with";
    case "endsWith":
      return "ends with";
    case "matches":
      return "matches";
    case "doesNotMatch":
      return "does not match";
    default:
      return operator;
  }
}

function formatComparisonOperator(operator: { type: string; min?: number; max?: number }) {
  switch (operator.type) {
    case "equals":
      return "equals";
    case "notEquals":
      return "not equals";
    case "greaterThan":
      return "greater than";
    case "lessThan":
      return "less than";
    case "greaterOrEqual":
      return "at least";
    case "lessOrEqual":
      return "at most";
    case "between":
      return `between ${operator.min ?? "…"} and ${operator.max ?? "…"}`
    default:
      return operator.type;
  }
}

function formatDateOperator(operator: { type: string; date?: string; start?: string; end?: string; amount?: number; unit?: string }) {
  switch (operator.type) {
    case "is":
      return `is ${operator.date ?? "…"}`;
    case "isBefore":
      return `before ${operator.date ?? "…"}`;
    case "isAfter":
      return `after ${operator.date ?? "…"}`;
    case "inTheLast":
      return `in the last ${operator.amount ?? "…"} ${operator.unit ?? ""}`;
    case "notInTheLast":
      return `not in the last ${operator.amount ?? "…"} ${operator.unit ?? ""}`;
    case "between":
      return `between ${operator.start ?? "…"} and ${operator.end ?? "…"}`;
    default:
      return operator.type;
  }
}

function formatTimeOperator(operator: { type: string; time?: string; start?: string; end?: string }) {
  switch (operator.type) {
    case "is":
      return `is ${operator.time ?? "…"}`;
    case "isBefore":
      return `before ${operator.time ?? "…"}`;
    case "isAfter":
      return `after ${operator.time ?? "…"}`;
    case "between":
      return `between ${operator.start ?? "…"} and ${operator.end ?? "…"}`;
    default:
      return operator.type;
  }
}

function formatValue(value: string) {
  return value ? `"${value}"` : "…";
}
