// src/hooks/useCodeWrap.ts
import { useSyncExternalStore } from "react";
import { type CodeWrap, getCodeWrap, subscribeCodeWrap } from "../lib/codeWrap";

/** Whether code wraps (see lib/codeWrap), and a render when that changes. */
export const useCodeWrap = (): CodeWrap =>
  useSyncExternalStore(subscribeCodeWrap, getCodeWrap);
