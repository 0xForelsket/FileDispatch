export type MatchType = "all" | "any" | "none";

export type StringOperator =
  | "is"
  | "isNot"
  | "contains"
  | "doesNotContain"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "doesNotMatch";

export interface StringCondition {
  operator: StringOperator;
  value: string;
  caseSensitive: boolean;
}

export type ComparisonOperator =
  | { type: "equals" }
  | { type: "notEquals" }
  | { type: "greaterThan" }
  | { type: "lessThan" }
  | { type: "greaterOrEqual" }
  | { type: "lessOrEqual" }
  | { type: "between"; min: number; max: number };

export type SizeUnit = "bytes" | "kilobytes" | "megabytes" | "gigabytes";

export interface SizeCondition {
  operator: ComparisonOperator;
  value?: number;
  unit: SizeUnit;
}

export type TimeUnit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";

export type DateOperator =
  | { type: "is"; date: string }
  | { type: "isBefore"; date: string }
  | { type: "isAfter"; date: string }
  | { type: "inTheLast"; amount: number; unit: TimeUnit }
  | { type: "notInTheLast"; amount: number; unit: TimeUnit }
  | { type: "between"; start: string; end: string };

export interface DateCondition {
  operator: DateOperator;
}

export type TimeOperator =
  | { type: "is"; time: string }
  | { type: "isBefore"; time: string }
  | { type: "isAfter"; time: string }
  | { type: "between"; start: string; end: string };

export interface TimeCondition {
  operator: TimeOperator;
}

export type FileKind =
  | "file"
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "other";

export interface KindCondition {
  kind: FileKind;
  negate: boolean;
}

export interface ShellCondition {
  command: string;
}

export type Condition =
  | { type: "name"; operator: StringOperator; value: string; caseSensitive: boolean }
  | { type: "extension"; operator: StringOperator; value: string; caseSensitive: boolean }
  | { type: "fullName"; operator: StringOperator; value: string; caseSensitive: boolean }
  | { type: "size"; operator: ComparisonOperator; value?: number; unit: SizeUnit }
  | { type: "dateCreated"; operator: DateOperator }
  | { type: "dateModified"; operator: DateOperator }
  | { type: "dateAdded"; operator: DateOperator }
  | { type: "currentTime"; operator: TimeOperator }
  | { type: "kind"; kind: FileKind; negate: boolean }
  | { type: "shellScript"; command: string }
  | { type: "nested"; matchType: MatchType; conditions: Condition[] };

export interface ConditionGroup {
  matchType: MatchType;
  conditions: Condition[];
}
