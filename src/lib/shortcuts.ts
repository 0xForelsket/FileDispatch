export interface ShortcutSpec {
  key: string | string[];
  ctrlOrMeta?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  allowInInput?: boolean;
}

export interface ShortcutEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: {
    tagName?: string;
    isContentEditable?: boolean;
  } | null;
}

export function matchesShortcut(event: ShortcutEventLike, shortcut: ShortcutSpec) {
  if (!shortcut.allowInInput && isEditableTarget(event.target)) {
    return false;
  }

  const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
  const eventKey = event.key.toLowerCase();
  const matchesKey = keys.some((key) => key.toLowerCase() === eventKey);
  if (!matchesKey) return false;

  if (shortcut.ctrlOrMeta && !(event.ctrlKey || event.metaKey)) return false;
  if (shortcut.ctrl && !event.ctrlKey) return false;
  if (shortcut.meta && !event.metaKey) return false;
  if (shortcut.alt && !event.altKey) return false;
  if (shortcut.shift && !event.shiftKey) return false;

  return true;
}

export function formatShortcut(shortcut: ShortcutSpec) {
  const key = Array.isArray(shortcut.key) ? shortcut.key[0] : shortcut.key;
  const isMac = isMacPlatform();
  const parts: string[] = [];

  if (shortcut.ctrlOrMeta) {
    parts.push(isMac ? "Cmd" : "Ctrl");
  } else {
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.meta) parts.push(isMac ? "Cmd" : "Meta");
  }

  if (shortcut.alt) parts.push(isMac ? "Opt" : "Alt");
  if (shortcut.shift) parts.push("Shift");

  parts.push(key.toUpperCase());
  return parts.join("+");
}

function isEditableTarget(target?: ShortcutEventLike["target"]) {
  if (!target) return false;
  const tagName = target.tagName?.toUpperCase();
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  return Boolean(target.isContentEditable);
}

function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform ?? "");
}
