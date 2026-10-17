"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loadParty, partyFetch } from "@/lib/party-client";
import { supabase } from "@/lib/supabase";
import { validPartyId, type WatchParty } from "@/lib/watch-party";

const STORAGE_KEY = "cinemy.host-party.v1";

interface PartyContextValue {
  party: WatchParty | null;
  busy: boolean;
  error: string;
  clearError: () => void;
  createParty: () => Promise<WatchParty>;
  createInvite: () => Promise<{ token: string; expires_at: string }>;
  updateParty: (body: Record<string, unknown>) => Promise<WatchParty>;
  endParty: () => Promise<void>;
}

const PartyContext = createContext<PartyContextValue | null>(null);

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [party, setParty] = useState<WatchParty | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const partyRef = useRef<WatchParty | null>(null);
  const lastLobbyRequestRef = useRef("");

  const acceptParty = useCallback((next: WatchParty) => {
    const previous = partyRef.current;
    if (previous?.id === next.id && (next.playback_revision < previous.playback_revision
      || (next.playback_revision === previous.playback_revision && next.updated_at < previous.updated_at))) return;
    partyRef.current = next;
    setParty(next);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      partyRef.current = null;
      setParty(null);
      return;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored || !validPartyId(stored)) return;
    let active = true;
    void loadParty(stored).then((found) => {
      if (!active) return;
      if (found.host_user_id === userId && !found.ended_at) acceptParty(found);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    }).catch(() => { if (active) window.sessionStorage.removeItem(STORAGE_KEY); });
    return () => { active = false; };
  }, [acceptParty, authLoading, userId]);

  useEffect(() => {
    if (!party?.id || !userId || party.host_user_id !== userId || !supabase) return;
    const id = party.id;
    const channel = supabase.channel(`cinemy-party-host-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "watch_parties", filter: `id=eq.${id}` },
        (payload) => acceptParty(payload.new as WatchParty))
      .subscribe();
    const poll = window.setInterval(() => {
      void loadParty(id).then(acceptParty).catch(() => {});
    }, 5000);
    return () => { window.clearInterval(poll); void supabase?.removeChannel(channel); };
  }, [acceptParty, party?.id, party?.host_user_id, userId]);

  const updateParty = useCallback(async (body: Record<string, unknown>) => {
    const current = partyRef.current;
    if (!current || current.host_user_id !== userId) throw new Error("Only the host can control this party.");
    const result = await partyFetch<{ party: WatchParty }>(`/api/parties/${current.id}`, "PATCH", body);
    acceptParty(result.party);
    return result.party;
  }, [acceptParty, userId]);

  useEffect(() => {
    const current = partyRef.current;
    if (!current?.media_type || pathname.startsWith("/w/") || pathname.startsWith("/party/")) return;
    const marker = `${current.id}:${current.playback_revision}`;
    if (lastLobbyRequestRef.current === marker) return;
    lastLobbyRequestRef.current = marker;
    void updateParty({ action: "lobby" }).catch((reason: Error) => {
      lastLobbyRequestRef.current = "";
      setError(reason.message);
    });
  }, [pathname, party?.id, party?.media_type, party?.playback_revision, updateParty]);

  const createParty = useCallback(async () => {
    if (!userId) throw new Error("Sign in to create a party.");
    if (partyRef.current && !partyRef.current.ended_at) return partyRef.current;
    setBusy(true);
    setError("");
    try {
      const result = await partyFetch<{ party: WatchParty }>("/api/parties", "POST");
      window.sessionStorage.setItem(STORAGE_KEY, result.party.id);
      acceptParty(result.party);
      return result.party;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create party.");
      throw reason;
    } finally { setBusy(false); }
  }, [acceptParty, userId]);

  const createInvite = useCallback(async () => {
    const current = partyRef.current || await createParty();
    setBusy(true);
    setError("");
    try {
      const result = await partyFetch<{ invite: { token: string; expires_at: string } }>(`/api/parties/${current.id}/invite`, "POST");
      return result.invite;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create invite.");
      throw reason;
    } finally { setBusy(false); }
  }, [createParty]);

  const endParty = useCallback(async () => {
    if (!partyRef.current) return;
    setBusy(true);
    try {
      await updateParty({ action: "end" });
      window.sessionStorage.removeItem(STORAGE_KEY);
      partyRef.current = null;
      setParty(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not end party.");
      throw reason;
    } finally { setBusy(false); }
  }, [updateParty]);

  return <PartyContext.Provider value={{ party, busy, error, clearError: () => setError(""), createParty, createInvite, updateParty, endParty }}>
    {children}
  </PartyContext.Provider>;
}

export function useParty() {
  const context = useContext(PartyContext);
  if (!context) throw new Error("PartyProvider is missing.");
  return context;
}
