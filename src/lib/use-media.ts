import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `md` breakpoint, in the one place JS has to agree with CSS.
 * Components that only need to hide something use `max-md:hidden`; this is
 * for the cases where mobile needs a *different component* (a bottom sheet
 * instead of a dropdown), which CSS alone cannot express. */
export const MOBILE_QUERY = "(max-width: 767px)";

export function useMediaQuery(query: string): boolean {
  // Both callbacks are memoized on `query`: an unstable subscribe would make
  // useSyncExternalStore tear down and re-add the listener every render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      // resize as well as change: a viewport that is resized without a
      // matchMedia change event (device emulation, some embedded webviews)
      // would otherwise leave components rendering the wrong branch with no
      // way back. Re-reading the snapshot is cheap and React bails out when
      // it is unchanged.
      window.addEventListener("resize", onChange);
      return () => {
        list.removeEventListener("change", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    [query],
  );
  const snapshot = useCallback(
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    [query],
  );
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** True on phone-width viewports. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
