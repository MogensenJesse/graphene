// src/lib/columnWidth.test.ts
import { afterEach, expect, test, vi } from "vitest";
import {
  clampWidth,
  DEFAULT_WIDTH,
  MAX_WIDTH,
  MIN_WIDTH,
  parseWidth,
  widthAfterDrag,
} from "./columnWidth";

test("a width is kept in steps of 8 between the least and the most", () => {
  expect(clampWidth(100)).toBe(MIN_WIDTH);
  expect(clampWidth(5000)).toBe(MAX_WIDTH);
  expect(clampWidth(803)).toBe(800);
  expect(clampWidth(805)).toBe(808);
  expect(clampWidth(MIN_WIDTH)).toBe(MIN_WIDTH);
  expect(clampWidth(MAX_WIDTH)).toBe(MAX_WIDTH);
});

test("a width close to the default is the default", () => {
  expect(clampWidth(DEFAULT_WIDTH)).toBe(DEFAULT_WIDTH);
  expect(clampWidth(728)).toBe(DEFAULT_WIDTH);
  expect(clampWidth(712)).toBe(DEFAULT_WIDTH);
  expect(clampWidth(736)).toBe(736); // out of reach of the snap
  expect(clampWidth(704)).toBe(704);
});

test("what was saved is read back, and anything else is the default", () => {
  expect(parseWidth("896")).toBe(896);
  expect(parseWidth("901")).toBe(904);
  expect(parseWidth("90000")).toBe(MAX_WIDTH);
  expect(parseWidth("3")).toBe(MIN_WIDTH);
  expect(parseWidth(null)).toBe(DEFAULT_WIDTH);
  expect(parseWidth("")).toBe(DEFAULT_WIDTH);
  expect(parseWidth("wide")).toBe(DEFAULT_WIDTH);
  expect(parseWidth("Infinity")).toBe(DEFAULT_WIDTH);
});

test("dragging an edge changes the width by twice the drag, as the column stays centred", () => {
  expect(widthAfterDrag(720, 40, "right")).toBe(800);
  expect(widthAfterDrag(720, -40, "right")).toBe(640);
  expect(widthAfterDrag(720, -40, "left")).toBe(800); // the left edge moves out to the left
  expect(widthAfterDrag(720, 40, "left")).toBe(640);
  expect(widthAfterDrag(720, 1000, "right")).toBe(MAX_WIDTH);
  expect(widthAfterDrag(720, -1000, "right")).toBe(MIN_WIDTH);
  expect(widthAfterDrag(800, -40, "right")).toBe(DEFAULT_WIDTH); // back to the default snaps
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the width is put on <html>, and kept for the next start", async () => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  const props = new Map<string, string>();
  const dataset: Record<string, string> = {};
  vi.stubGlobal("document", {
    documentElement: {
      style: { setProperty: (k: string, v: string) => props.set(k, v) },
      dataset,
    },
  });
  vi.resetModules();
  const width = await import("./columnWidth");

  expect(width.getNoteWidth()).toBe(DEFAULT_WIDTH);
  width.applyNoteWidth();
  expect(props.get("--note-column")).toBe("720px");
  expect(dataset.noteWide).toBe("false");
  expect(data.size).toBe(0); // applying alone saves nothing (a drag in progress)

  width.saveNoteWidth(896);
  expect(props.get("--note-column")).toBe("896px");
  expect(dataset.noteWide).toBe("true");
  expect(data.get("graphene.noteWidth")).toBe("896");

  vi.resetModules(); // a restart
  const again = await import("./columnWidth");
  expect(again.getNoteWidth()).toBe(896);
});
