"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";

export function ClientGuard() {
  const { text } = useCatalogLanguage();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const showNotice = useCallback(() => {
    setVisible(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(false), 1800);
  }, []);

  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      showNotice();
    };

    const blockDeveloperShortcuts = (event: KeyboardEvent) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      const modifier = event.ctrlKey || event.metaKey;
      const developerShortcut = key === "f12"
        || (modifier && event.shiftKey && ["i", "j", "c", "k"].includes(key))
        || (modifier && key === "u");

      if (!developerShortcut) return;
      event.preventDefault();
      event.stopPropagation();
      showNotice();
    };

    document.addEventListener("contextmenu", blockContextMenu, { capture: true });
    window.addEventListener("keydown", blockDeveloperShortcuts, { capture: true });
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu, { capture: true });
      window.removeEventListener("keydown", blockDeveloperShortcuts, { capture: true });
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [showNotice]);

  return (
    <div className={`security-notice${visible ? " is-visible" : ""}`} role="status" aria-live="polite">
      <span aria-hidden="true">◈</span>
      <strong>CINEMY PROTECTED</strong>
      <small>{text.protectedAction}</small>
    </div>
  );
}
