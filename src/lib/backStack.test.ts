// src/lib/backStack.test.ts
import { describe, expect, it, vi } from "vitest";
import { pushBack, runBack } from "./backStack";

describe("backStack", () => {
  it("is false when nothing is open", () => {
    expect(runBack()).toBe(false);
  });

  it("runs only the newest step", () => {
    const menu = vi.fn();
    const dialog = vi.fn();
    const dropMenu = pushBack(menu);
    const dropDialog = pushBack(dialog);

    expect(runBack()).toBe(true);
    expect(dialog).toHaveBeenCalledTimes(1);
    expect(menu).not.toHaveBeenCalled();

    // The dialog closes: the next Back reaches the one under it
    dropDialog();
    expect(runBack()).toBe(true);
    expect(menu).toHaveBeenCalledTimes(1);

    dropMenu();
    expect(runBack()).toBe(false);
  });

  it("takes a step off from the middle without touching the others", () => {
    const first = vi.fn();
    const second = vi.fn();
    const third = vi.fn();
    const dropFirst = pushBack(first);
    const dropSecond = pushBack(second);
    const dropThird = pushBack(third);

    dropSecond();
    dropSecond(); // taking it off twice does nothing
    runBack();
    expect(third).toHaveBeenCalledTimes(1);
    dropThird();
    runBack();
    expect(first).toHaveBeenCalledTimes(1);
    dropFirst();
    expect(second).not.toHaveBeenCalled();
  });
});
