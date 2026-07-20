"use client";

import * as React from "react";

let activeOverlayCount = 0;
let previousBodyOverflow = "";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useOverlayA11y({
  open,
  containerRef,
  onClose,
}: {
  open: boolean;
  containerRef: React.RefObject<HTMLElement>;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (activeOverlayCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    activeOverlayCount += 1;

    const focusInitialElement = () => {
      const container = containerRef.current;
      if (!container) return;
      const focusable = container.querySelector<HTMLElement>(focusableSelector);
      (focusable ?? container).focus();
    };
    const frame = window.requestAnimationFrame(focusInitialElement);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      activeOverlayCount = Math.max(0, activeOverlayCount - 1);
      if (activeOverlayCount === 0) document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [containerRef, onClose, open]);
}
