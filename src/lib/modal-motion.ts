"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const EXIT_DURATION_MS = 220;

export function useModalExit(onClose: () => void) {
  const [isClosing, setIsClosing] = useState(false);
  const closeRef = useRef(onClose);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  closeRef.current = onClose;

  const requestClose = useCallback(() => {
    if (timerRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      closeRef.current();
      return;
    }
    setIsClosing(true);
    timerRef.current = setTimeout(() => closeRef.current(), EXIT_DURATION_MS);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [requestClose]);

  return { isClosing, requestClose };
}
