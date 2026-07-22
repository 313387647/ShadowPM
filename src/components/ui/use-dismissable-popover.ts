"use client";

import * as React from "react";

/** Keeps lightweight menus and filter popovers consistent without turning them into dialogs. */
export function useDismissablePopover(open: boolean, onClose: () => void) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function dismissFromOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) onCloseRef.current();
    }
    function dismissFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current();
    }

    document.addEventListener("pointerdown", dismissFromOutside);
    document.addEventListener("keydown", dismissFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", dismissFromOutside);
      document.removeEventListener("keydown", dismissFromKeyboard);
      previouslyFocused?.focus();
    };
  }, [open]);

  return containerRef;
}
