"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { PlayerModal } from "@/components/PlayerModal";
import { loadParty, partyFetch } from "@/lib/party-client";
import { supabase } from "@/lib/supabase";
import type { Movie } from "@/lib/types";
import { partyPosition, validPartyId, type WatchParty } from "@/lib/watch-party";

interface View { party: WatchParty; playbackStart: number }

export function PartyGuestClient({ partyId }: { partyId: string }) {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const userId = user?.id;
  const { language } = useCatalogLanguage();
  const ro = language === "ro-RO";
  const [view, setView] = useState<View | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentRef = useRef<View | null>(null);
  const joined = Boolean(view);

  useEffect(() => {
    if (!loading && configured && !userId && validPartyId(partyId)) {
      router.replace(`/account?next=${encodeURIComponent(`/party/${partyId}`)}`);
    }
  }, [configured, loading, partyId, router, userId]);

  const acceptParty = useCallback((next: WatchParty) => {
    const previous = currentRef.current;
    if (previous && (next.playback_revision < previous.party.playback_revision
      || (next.playback_revision === previous.party.playback_revision && next.updated_at < previous.party.updated_at))) return;
    const playbackStart = !previous || previous.party.playback_revision !== next.playback_revision
      ? partyPosition(next) : previous.playbackStart;
    const updated = { party: next, playbackStart };
    currentRef.current = updated;
    setView(updated);
  }, []);

  useEffect(() => {
    if (loading || !userId || !validPartyId(partyId)) return;
    let active = true;
    void loadParty(partyId).then((found) => { if (active) acceptParty(found); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [acceptParty, loading, partyId, userId]);

  useEffect(() => {
    if (!joined || !userId || !supabase) return;
    const channel = supabase.channel(`cinemy-party-guest-${partyId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "watch_parties", filter: `id=eq.${partyId}` },
        (payload) => acceptParty(payload.new as WatchParty))
      .subscribe();
    const poll = window.setInterval(() => {
      void loadParty(partyId).then((next) => { acceptParty(next); setNotice(""); })
        .catch(() => setNotice(ro ? "Conexiunea s-a întrerupt. Reîncercăm..." : "Connection lost. Retrying..."));
    }, 5000);
    return () => { window.clearInterval(poll); void supabase?.removeChannel(channel); };
  }, [acceptParty, joined, partyId, ro, userId]);

  const party = view?.party;
  useEffect(() => {
    if (!party?.tmdb_id || !party.media_type) { setMovie(null); return; }
    const controller = new AbortController();
    setMovie(null);
    setError("");
    void fetch(`/api/movies?id=${party.tmdb_id}&media_type=${party.media_type}&language=${encodeURIComponent(language)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as Movie & { error?: string };
        if (!response.ok) throw new Error(data.error || "Title unavailable.");
        if (!controller.signal.aborted) setMovie({ ...data, media_type: party.media_type! });
      })
      .catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [party?.media_type, party?.tmdb_id, language]);

  const leave = async () => {
    try { await partyFetch(`/api/parties/${partyId}/leave`, "POST"); }
    catch { /* Navigation remains possible after a network failure. */ }
    router.push("/");
  };

  if (!validPartyId(partyId)) return <main className="party-waiting-screen"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Link invalid" : "Invalid party link"}</h1></main>;
  if (!configured) return <main className="party-waiting-screen"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Conturile nu sunt configurate" : "Accounts are not configured"}</h1></main>;
  if (loading) return <main className="party-waiting-screen"><span className="brand">CINEMY</span><h1>{ro ? "Verificăm contul..." : "Checking your account..."}</h1></main>;
  if (!user) return <main className="party-waiting-screen"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Intră în cont" : "Sign in"}</h1><Link className="button button-primary" href={`/account?next=${encodeURIComponent(`/party/${partyId}`)}`}>{ro ? "Autentifică-te" : "Sign in"}</Link></main>;
  if (error) return <main className="party-waiting-screen"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Party indisponibil" : "Party unavailable"}</h1><p role="alert">{error}</p><Link className="button button-primary" href="/">← Home</Link></main>;
  if (!party || !view) return <main className="party-waiting-screen"><span className="brand">CINEMY</span><h1>{ro ? "Intrăm în party..." : "Opening party..."}</h1></main>;
  if (party.host_user_id === user.id) return <main className="party-waiting-screen"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Tu ești gazda" : "You are the host"}</h1><p>{ro ? "Alege un film din catalog; invitații îl vor vedea automat." : "Choose a title from the catalog; guests will see it automatically."}</p><Link className="button button-primary" href="/">{ro ? "Alege un film" : "Choose a title"}</Link></main>;
  if (party.ended_at) return <main className="party-waiting-screen"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Party-ul s-a încheiat" : "Party ended"}</h1><Link className="button button-primary" href="/">← Home</Link></main>;
  if (!party.media_type || !party.tmdb_id) return <main className="party-waiting-screen"><span className="brand">CINEMY</span><span className="party-waiting-kicker">WATCH PARTY</span><h1>{ro ? "Așteaptă, host-ul selectează filmul surpriză" : "Wait, the host is choosing the surprise movie"}</h1><span className="party-loading-dots" aria-label={ro ? "Se încarcă" : "Loading"}><i /><i /><i /></span><button className="party-leave-button" type="button" onClick={() => void leave()}>{ro ? "Ieși din party" : "Leave party"}</button></main>;
  if (!movie || movie.id !== party.tmdb_id || movie.media_type !== party.media_type) return <main className="party-waiting-screen"><span className="brand">CINEMY</span><h1>{ro ? "Pregătim filmul..." : "Preparing the title..."}</h1><span className="party-loading-dots" aria-hidden="true"><i /><i /><i /></span></main>;

  return <>
    <PlayerModal
      key={`${party.id}-${party.tmdb_id}-${party.season_number}-${party.episode_number}-${party.playback_revision}`}
      movie={movie}
      language={language}
      resumeAt={view.playbackStart}
      season={party.season_number}
      episode={party.episode_number}
      partyMode="guest"
      watchTogether={{ isHost: false, isPlaying: party.is_playing, busy: false, onPause: () => {}, onPlay: () => {}, onProgress: () => {} }}
      onClose={() => { void leave(); }}
      onGoHome={() => { void leave(); }}
    />
    {notice && <div className="watch-room-notice" role="alert">{notice}</div>}
  </>;
}
