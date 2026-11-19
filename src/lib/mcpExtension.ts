// src/lib/mcpExtension.ts
// The Claude app keeps its own copy of graphene.mcpb and never updates it, so Graphene remembers which of its versions
// the extension was last handed over at and tells the person when an update has made the Claude app's copy old.
import { readPref, writePref } from "./prefs";
import { compareVersions } from "./version";

const ADDED_KEY = "graphene.claudeExtensionVersion";

/** The Graphene version the extension was last added to the Claude app at, or null when it never was from here. */
export const extensionAddedAt = () => readPref(ADDED_KEY);

// ponytail: noted when the file is opened or revealed; Claude does not say whether the install was finished or cancelled.
export const rememberExtensionAdded = (version: string) =>
  writePref(ADDED_KEY, version);

/** True when Graphene has been updated since the extension was last added. */
export const extensionIsOld = (addedAt: string | null, current: string) =>
  addedAt !== null && current !== "" && compareVersions(current, addedAt) > 0;
