// src/lib/phoneNav.test.ts
import { describe, expect, test } from "vitest";
import { navView } from "./phoneNav";

const view = (
  size: "phone" | "small" | "wide",
  listShowing: boolean,
  wideHidden = false,
) =>
  navView({
    compact: size !== "wide",
    phone: size === "phone",
    listShowing,
    wideHidden,
  });

describe("navView", () => {
  test("a phone on its list: the list is up and covers the screens, and Back leaves the app", () => {
    expect(view("phone", true)).toEqual({
      floating: true,
      sidebarHidden: false,
      onScreen: false,
      onList: true,
    });
  });

  test("a phone on a screen: Back goes to the list", () => {
    expect(view("phone", false)).toEqual({
      floating: false,
      sidebarHidden: true,
      onScreen: true,
      onList: false,
    });
  });

  test("a small window has a drawer, which is not a screen: Back has no step of its own there", () => {
    expect(view("small", true)).toMatchObject({
      floating: true,
      sidebarHidden: false,
      onScreen: false,
      onList: false,
    });
    expect(view("small", false)).toMatchObject({
      floating: false,
      sidebarHidden: true,
      onScreen: false,
      onList: false,
    });
  });

  test("a wide window follows the user's choice and never floats", () => {
    expect(view("wide", true, true)).toEqual({
      floating: false,
      sidebarHidden: true,
      onScreen: false,
      onList: false,
    });
    expect(view("wide", false, false).sidebarHidden).toBe(false);
  });
});
