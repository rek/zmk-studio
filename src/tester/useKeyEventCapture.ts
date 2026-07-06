import { useEffect, useRef } from "react";

export interface KeyEventHandlers {
  onPress: (code: string, t: number) => void;
  onRelease: (code: string, t: number) => void;
  onForceReleaseAll: () => void;
}

const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
};

// All app modals render as native <dialog> elements (see useModalRef), so key
// events are muted whenever one is open — both to keep the unlock/connect
// dialogs usable and to avoid phantom test hits.
const modalIsOpen = (): boolean => !!document.querySelector("dialog[open]");

// Captures window-level keydown/keyup while `active`, reporting physical
// KeyboardEvent.code values. preventDefault suppresses in-page effects
// (Tab focus-walk, Space scroll, quick-find); the browser still owns
// higher-level shortcuts like Ctrl+W — the Tauri webview captures nearly
// everything. blur/visibility-hidden force-release all held keys because the
// matching keyup may never arrive (e.g. OS shortcuts on Meta combos).
export function useKeyEventCapture(
  active: boolean,
  handlers: KeyEventHandlers
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!active) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || modalIsOpen() || isTextEntryTarget(e.target)) {
        return;
      }
      e.preventDefault();
      handlersRef.current.onPress(e.code, e.timeStamp);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (modalIsOpen() || isTextEntryTarget(e.target)) {
        return;
      }
      e.preventDefault();
      handlersRef.current.onRelease(e.code, e.timeStamp);
    };

    const onBlur = () => {
      handlersRef.current.onForceReleaseAll();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handlersRef.current.onForceReleaseAll();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      handlersRef.current.onForceReleaseAll();
    };
  }, [active]);
}
