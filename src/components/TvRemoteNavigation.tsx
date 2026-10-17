"use client";

import { useEffect } from "react";

const SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function TvRemoteNavigation() {
  useEffect(() => {
    const tvViewport = window.matchMedia("(min-width: 1600px)");

    const onKeyDown = (event: KeyboardEvent) => {
      if (!tvViewport.matches || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;

      const active = document.activeElement as HTMLElement | null;
      if (active?.matches("input, textarea, select, [contenteditable='true']")) return;

      const candidates = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
      if (!candidates.length) return;

      if (!active || active === document.body || !candidates.includes(active)) {
        const preferred = candidates.find((element) => element.matches(".hero-actions button, .movie-card, .explore-card")) || candidates[0];
        preferred.focus({ preventScroll: true });
        preferred.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        event.preventDefault();
        return;
      }

      const source = active.getBoundingClientRect();
      const sourceX = source.left + source.width / 2;
      const sourceY = source.top + source.height / 2;
      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
      const positive = event.key === "ArrowRight" || event.key === "ArrowDown";

      const ranked = candidates
        .filter((element) => element !== active)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - sourceX;
          const dy = rect.top + rect.height / 2 - sourceY;
          const primary = horizontal ? dx : dy;
          const secondary = horizontal ? dy : dx;
          return { element, primary, score: Math.abs(primary) + Math.abs(secondary) * 2.25 };
        })
        .filter(({ primary }) => positive ? primary > 8 : primary < -8)
        .sort((a, b) => a.score - b.score);

      const target = ranked[0]?.element;
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
