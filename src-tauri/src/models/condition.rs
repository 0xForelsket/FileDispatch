use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionGroup {
    pub match_type: MatchType,
    pub conditions: Vec<Condition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MatchType {
    All,
    Any,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Condition {
    Name(StringCondition),
    Extension(StringCondition),
    FullName(StringCondition),
    Size(SizeCondition),
    DateCreated(DateCondition),
    DateModified(DateCondition),
    DateAdded(DateCondition),
    DateLastMatched(DateCondition),
    CurrentTime(TimeCondition),
    Kind(KindCondition),
    ShellScript(ShellCondition),
    Nested(ConditionGroup),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StringCondition {
    pub operator: StringOperator,
    pub value: String,
    pub case_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StringOperator {
    Is,
    IsNot,
    Contains,
    DoesNotContain,
    StartsWith,
    EndsWith,
    Matches,
    DoesNotMatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeCondition {
    pub operator: ComparisonOperator,
    pub value: Option<u64>,
    pub unit: SizeUnit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ComparisonOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterOrEqual,
    LessOrEqual,
    Between { min: u64, max: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SizeUnit {
    Bytes,
    Kilobytes,
    Megabytes,
    Gigabytes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DateCondition {
    pub operator: DateOperator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeCondition {
    pub operator: TimeOperator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TimeOperator {
    Is { time: NaiveTime },
    IsBefore { time: NaiveTime },
    IsAfter { time: NaiveTime },
    Between { start: NaiveTime, end: NaiveTime },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DateOperator {
    Is { date: NaiveDate },
    IsBefore { date: NaiveDate },
    IsAfter { date: NaiveDate },
    InTheLast { amount: u32, unit: TimeUnit },
    NotInTheLast { amount: u32, unit: TimeUnit },
    Between { start: NaiveDate, end: NaiveDate },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TimeUnit {
    Minutes,
    Hours,
    Days,
    Weeks,
    Months,
    Years,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KindCondition {
    pub kind: FileKind,
    pub negate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    File,
    Folder,
    Image,
    Video,
    Audio,
    Document,
    Archive,
    Code,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellCondition {
    pub command: String,
}
