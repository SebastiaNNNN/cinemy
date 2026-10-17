import type { WatchHistory } from "@/lib/types";
import { getAccessToken } from "@/lib/auth-token";

async function progressError(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string };
  return new Error(data.error || `Watch history request failed (${response.status}).`);
}

export async function loadWatchHistory(): Promise<WatchHistory[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const response = await fetch("/api/progress", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw await progressError(response);
  const history = await response.json() as WatchHistory[];
  if (!Array.isArray(history)) throw new Error("Invalid watch history response.");
  return history;
}

export async function saveWatchProgress(item: WatchHistory, keepalive = false) {
  const token = await getAccessToken();
  if (!token) return null;
  const updated: WatchHistory = { ...item, updated_at: new Date().toISOString() };
  const response = await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(updated),
    keepalive,
  });
  if (!response.ok) throw await progressError(response);
  return updated;
}
