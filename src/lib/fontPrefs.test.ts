// src/lib/fontPrefs.test.ts
import { expect, test } from "vitest";
import {
  cleanFontName,
  fontCss,
  parseFontPref,
  serializeFontPref,
  textScale,
} from "./fontPrefs";

test("a saved choice reads back, and anything unknown is the default", () => {
  expect(parseFontPref("serif", "note")).toEqual({
    choice: "serif",
    custom: "",
  });
  expect(parseFontPref("consolas", "code")).toEqual({
    choice: "consolas",
    custom: "",
  });
  expect(parseFontPref("consolas", "note")).toEqual({
    choice: "default",
    custom: "",
  }); // a code choice is not a note choice
  expect(parseFontPref(null, "note").choice).toBe("default");
  expect(parseFontPref("custom", "note").choice).toBe("default"); // no name after it
});

test("a typed name survives the round trip, colons and all", () => {
  const pref = { choice: "custom", custom: "Fira Sans: Book" };
  expect(parseFontPref(serializeFontPref(pref), "note")).toEqual(pref);
  expect(serializeFontPref({ choice: "serif", custom: "ignored" })).toBe(
    "serif",
  );
});

test("the default leaves the app's own font alone", () => {
  expect(fontCss("note", { choice: "default", custom: "" })).toBeNull();
  expect(fontCss("code", { choice: "custom", custom: "   " })).toBeNull();
});

test("a choice gives its font list", () => {
  expect(fontCss("note", { choice: "serif", custom: "" })).toContain("Georgia");
  expect(fontCss("code", { choice: "courier", custom: "" })).toContain(
    '"Courier New"',
  );
});

test("a typed name is quoted and falls back to the app's own font", () => {
  expect(fontCss("note", { choice: "custom", custom: "Fira Sans" })).toBe(
    '"Fira Sans", var(--font-sans)',
  );
  expect(fontCss("code", { choice: "custom", custom: "JetBrains Mono" })).toBe(
    '"JetBrains Mono", var(--font-mono)',
  );
});

test("quotes, backslashes and line breaks cannot end the quoted name early", () => {
  expect(cleanFontName('A"; color: red; "B')).toBe("A; color: red; B");
  expect(cleanFontName("a\\b\nc")).toBe("abc");
  expect(fontCss("note", { choice: "custom", custom: 'x"y' })).toBe(
    '"xy", var(--font-sans)',
  );
});

test("text size is a multiplier, 1 when unknown", () => {
  expect(textScale("small")).toBe(0.9);
  expect(textScale("xlarge")).toBe(1.3);
  expect(textScale("default")).toBe(1);
  expect(textScale("huge")).toBe(1);
  expect(textScale(null)).toBe(1);
});
