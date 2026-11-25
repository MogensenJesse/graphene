// src/lib/optionFilter.test.ts
import { describe, expect, it } from "vitest";
import { filterOptions } from "./optionFilter";

const fonts = [
  "Arial",
  "Cascadia Code",
  "Fira Code",
  "Segoe UI",
  "Source Code Pro",
].map((label) => ({ label }));
const labels = (list: { label: string }[]) => list.map((o) => o.label);

describe("filterOptions", () => {
  it("keeps everything for an empty or blank query", () => {
    expect(filterOptions(fonts, "")).toBe(fonts);
    expect(filterOptions(fonts, "   ")).toBe(fonts);
  });

  it("ignores case", () => {
    expect(labels(filterOptions(fonts, "ARIAL"))).toEqual(["Arial"]);
    expect(labels(filterOptions(fonts, "segoe"))).toEqual(["Segoe UI"]);
  });

  it("puts the labels that start with the query before the ones that only contain it", () => {
    // "Cascadia Code" has an s inside it; "Segoe UI" and "Source Code Pro" start with one
    expect(labels(filterOptions(fonts, "s"))).toEqual([
      "Segoe UI",
      "Source Code Pro",
      "Cascadia Code",
    ]);
  });

  it("keeps the order of the list inside each group", () => {
    // None of the three starts with "code", so they all stay in the order they were given
    expect(labels(filterOptions(fonts, "code"))).toEqual([
      "Cascadia Code",
      "Fira Code",
      "Source Code Pro",
    ]);
  });

  it("lists the starts first even when they come later in the list", () => {
    const list = [{ label: "Mono Code" }, { label: "Code Mono" }];
    expect(labels(filterOptions(list, "code"))).toEqual([
      "Code Mono",
      "Mono Code",
    ]);
  });

  it("finds nothing for a query no label has", () => {
    expect(filterOptions(fonts, "wingdings")).toEqual([]);
  });

  it("trims the query", () => {
    expect(labels(filterOptions(fonts, "  fira "))).toEqual(["Fira Code"]);
  });
});
