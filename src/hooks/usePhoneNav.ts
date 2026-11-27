// src/hooks/usePhoneNav.ts
import { useCallback, useEffect, useState } from "react";
import { navView } from "../lib/phoneNav";
import { COMPACT_QUERY } from "../lib/platform";
import { readPref, writePref } from "../lib/prefs";
import { isTextField } from "../lib/textMenu";
import { useBack } from "./useBack";
import { useEscape } from "./useEscape";
import { useMediaQuery } from "./useMediaQuery";
import { usePhone } from "./usePhone";

const SIDEBAR_HIDDEN_KEY = "graphene.sidebarHidden";

/**
 * The sidebar at the size of the window: a panel in a wide one, a drawer in a small one, and on a phone the list screen with every
 * other part of the app a screen above it (see `navView`). The app starts on the list of a phone. Back goes from a screen to the list,
 * and from the list out of the app (App). `selectedId` and `mode` are what a note or view being picked closes the drawer by.
 */
export function usePhoneNav(selectedId: string | null, mode: string) {
  const compact = useMediaQuery(COMPACT_QUERY);
  const phone = usePhone();
  const [wideHidden, setWideHidden] = useState(
    () => readPref(SIDEBAR_HIDDEN_KEY) === "1",
  );
  const [listShowing, setListShowing] = useState(phone);
  const view = navView({ compact, phone, listShowing, wideHidden });

  // The open drawer covers the note, so it closes when a note or view is picked, on Escape (unless a field is being typed in) and on
  // a click outside it (the scrim)
  const closeFloating = useCallback(() => setListShowing(false), []);
  const showList = useCallback(() => {
    // The screen being left keeps no focus: its field would hold the keyboard up (and the bottom bar down) under the list
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    setListShowing(true);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: picking another note or view is the trigger
  useEffect(() => {
    // Not on a phone: there the list stays up until a screen is asked for (it comes back by Back too, with nothing picked)
    if (compact && !phone) setListShowing(false);
  }, [compact, selectedId, mode]);
  useEscape(closeFloating, {
    active: view.floating && !phone,
    when: () => !isTextField(document.activeElement),
  });
  // Back from a screen shows the list; on the list it is not registered, so Back leaves the app
  useBack(showList, view.onScreen);

  const toggleSidebar = () => {
    if (compact) {
      setListShowing((open) => !open);
      return;
    }
    setWideHidden(!wideHidden);
    writePref(SIDEBAR_HIDDEN_KEY, wideHidden ? "0" : "1");
  };

  return {
    compact,
    phone,
    ...view,
    closeFloating,
    showList,
    toggleSidebar,
  };
}
