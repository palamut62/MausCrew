import { useEffect, useRef, useState } from "react";

import { currentCall } from "./call";

type ModifierEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "code" | "repeat">;

export function isPushToTalkPress(event: ModifierEvent): boolean {
  const modifier =
    event.code === "AltLeft" ||
    event.code === "AltRight" ||
    event.code === "ControlLeft" ||
    event.code === "ControlRight";
  return modifier && event.altKey && event.ctrlKey && !event.repeat;
}

/** The held chord, named the way this OS names it. The binding is the same
 * physical keys everywhere (altKey + ctrlKey), but "Option" is a Mac key cap:
 * printing it on Windows and Linux tells the user to press a key they do not
 * have. */
// Read through globalThis: this module is imported by node-environment unit
// tests where `window` is not declared at all.
export const PUSH_TO_TALK_LABEL =
  globalThis.window?.mauscrew?.platform === "darwin" ? "Control + Option" : "Ctrl + Alt";

/** Hold the push-to-talk chord to replace automatic endpointing with a
 * manually finalized utterance. The ordinary call listener remains the
 * default. */
export function usePushToTalk(targetId: string, enabled: boolean, onError: () => void): boolean {
  const [active, setActive] = useState(false);
  const held = useRef(false);
  const enabledRef = useRef(enabled);
  const onErrorRef = useRef(onError);
  enabledRef.current = enabled;
  onErrorRef.current = onError;

  useEffect(() => {
    if (enabled) return;
    held.current = false;
    setActive(false);
  }, [enabled]);

  useEffect(() => {
    const bridge = window.mauscrew;
    if (!bridge?.speechFinish) return;

    const finish = () => {
      if (!held.current) return;
      held.current = false;
      setActive(false);
      void bridge.speechFinish?.();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        held.current ||
        !enabledRef.current ||
        currentCall() !== targetId ||
        !isPushToTalkPress(event)
      ) {
        return;
      }
      event.preventDefault();
      held.current = true;
      setActive(true);
      void bridge.speechStart().catch(() => {
        held.current = false;
        setActive(false);
        onErrorRef.current();
      });
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!held.current || (event.altKey && event.ctrlKey)) return;
      event.preventDefault();
      finish();
    };
    const onBlur = () => finish();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      held.current = false;
    };
  }, [targetId]);

  return active;
}
