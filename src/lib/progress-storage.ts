import type { WatchHistory } from "@/lib/types";

const STORAGE_KEY = "cinemy.watch-history.v1";

function readLocalHistory(): WatchHistory[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as WatchHistory[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(history: WatchHistory[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export async function loadWatchHistory(): Promise<WatchHistory[]> {
  try {
    const response = await fetch("/api/progress", { cache: "no-store" });
    if (!response.ok) throw new Error("Supabase indisponibil");
    const remote = (await response.json()) as WatchHistory[];
    if (!Array.isArray(remote)) throw new Error("Răspuns invalid");
    writeLocalHistory(remote);
    return remote;
  } catch {
    return readLocalHistory().sort((a, b) =>
      String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
    );
  }
}

export async function saveWatchProgress(item: WatchHistory, keepalive = false) {
  const updated: WatchHistory = { ...item, updated_at: new Date().toISOString() };
  const local = readLocalHistory();
  const next = [updated, ...local.filter((entry) => entry.media_id !== item.media_id)];
  writeLocalHistory(next);

  try {
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
      keepalive,
    });
    if (!response.ok) throw new Error("Supabase indisponibil");
  } catch {
    // LocalStorage este sursa de rezervă și conține deja cea mai nouă valoare.
  }

  return updated;
}
