"use client";

import * as React from "react";

/** Keeps lightweight menus and filter popovers consistent without turning them into dialogs. */
export function useDismissablePopover(
  open: boolean,
  onClose: () => void,
  portaledContentRef?: React.RefObject<HTMLElement | null>,
) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function dismissFromOutside(event: PointerEvent) {
      const target = event.target as Node;
      const isInsideTrigger = containerRef.current?.contains(target);
      const isInsidePortaledContent = portaledContentRef?.current?.contains(target);

      if (!isInsideTrigger && !isInsidePortaledContent) onCloseRef.current();
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
  }, [open, portaledContentRef]);

  return containerRef;
}
