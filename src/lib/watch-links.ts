import type { MediaType, Movie } from "@/lib/types";

const RETURN_KEY = "cinemy.watch-return.v1";

export function watchHref(movie: Pick<Movie, "id" | "media_type">, season = 1, episode = 1) {
  const prefix = movie.media_type === "tv" ? "t" : "m";
  const path = `/w/${prefix}${movie.id.toString(36)}`;
  const params = new URLSearchParams();
  if (movie.media_type === "tv") { params.set("s", String(season)); params.set("e", String(episode)); }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export function parseWatchCode(code: string): { id: number; mediaType: MediaType } | null {
  const match = /^([mt])([0-9a-z]+)$/i.exec(code);
  if (!match) return null;
  const id = Number.parseInt(match[2], 36);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { id, mediaType: match[1].toLowerCase() === "t" ? "tv" : "movie" };
}

export function rememberWatchReturn(watchPath: string) {
  try {
    window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({
      watchPath: watchPath.split("?")[0],
      returnTo: `${window.location.pathname}${window.location.search}`,
    }));
  } catch {
    // Direct fallback navigation still works when sessionStorage is unavailable.
  }
}

export function hasWatchReturn(watchPath: string) {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(RETURN_KEY) || "null") as {
      watchPath?: string;
      returnTo?: string;
    } | null;
    return stored?.watchPath === watchPath.split("?")[0] && Boolean(stored.returnTo?.startsWith("/") && !stored.returnTo.startsWith("//"));
  } catch {
    return false;
  }
}

export function clearWatchReturn() {
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to clear when sessionStorage is unavailable.
  }
}
