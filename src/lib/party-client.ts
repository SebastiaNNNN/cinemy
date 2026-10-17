import { getAccessToken } from "@/lib/auth-token";
import type { WatchParty } from "@/lib/watch-party";

export async function partyFetch<T>(url: string, method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to use parties.");
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Party request failed.");
  return data;
}

export async function loadParty(id: string) {
  const result = await partyFetch<{ party: WatchParty }>(`/api/parties/${id}`, "GET");
  return result.party;
}
