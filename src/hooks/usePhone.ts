// src/hooks/usePhone.ts
import { PHONE_QUERY } from "../lib/platform";
import { useMediaQuery } from "./useMediaQuery";

/** Whether the window is a phone: a touch screen under 600 px, where the list is a screen of its own and not a drawer (see platform.ts). */
export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
