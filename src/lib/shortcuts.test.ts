import { describe, expect, test } from "bun:test";

import { formatShortcut, matchesShortcut } from "./shortcuts";

describe("matchesShortcut", () => {
  test("matches ctrl or meta shortcut", () => {
    const event = { key: "n", ctrlKey: true };
    expect(matchesShortcut(event, { key: "n", ctrlOrMeta: true })).toBe(true);
  });

  test("ignores when typing in input", () => {
    const event = {
      key: "s",
      ctrlKey: true,
      target: { tagName: "INPUT" },
    };
    expect(matchesShortcut(event, { key: "s", ctrlOrMeta: true })).toBe(false);
    expect(
      matchesShortcut(event, { key: "s", ctrlOrMeta: true, allowInInput: true }),
    ).toBe(true);
  });

  test("matches delete and backspace aliases", () => {
    const del = { key: "Delete" };
    const backspace = { key: "Backspace" };
    expect(matchesShortcut(del, { key: ["delete", "backspace"] })).toBe(true);
    expect(matchesShortcut(backspace, { key: ["delete", "backspace"] })).toBe(true);
  });
});

describe("formatShortcut", () => {
  test("formats ctrl shortcut for non-mac", () => {
    const label = formatShortcut({ key: "n", ctrl: true });
    expect(label).toBe("Ctrl+N");
  });
});
