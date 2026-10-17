"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerModal } from "@/components/PlayerModal";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { getAccessToken } from "@/lib/auth-token";
import { isStalePlaybackUpdate } from "@/lib/playback-sync";
import { supabase } from "@/lib/supabase";
import type { Movie, TvSeason } from "@/lib/types";
import { roomPosition, validRoomId, type WatchRoom } from "@/lib/watch-room";

async function roomRequest(url: string, method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>): Promise<WatchRoom> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to join this room.");
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json() as { room?: WatchRoom; error?: string };
  if (!response.ok || !result.room) throw new Error(result.error || "Room unavailable.");
  return result.room;
}

interface RoomView {
  room: WatchRoom;
  playbackStart: number;
}

export function WatchTogetherClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { user, loading: authLoading, configured } = useAuth();
  const userId = user?.id;
  const { language } = useCatalogLanguage();
  const ro = language === "ro-RO";
  const [view, setView] = useState<RoomView | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lastProgressSentRef = useRef(0);
  const currentPositionRef = useRef(0);
  const missedPollsRef = useRef(0);

  const acceptRoom = useCallback((next: WatchRoom) => {
    setView((previous) => {
      if (previous && isStalePlaybackUpdate(next, previous.room)) return previous;
      const playbackStart = !previous || previous.room.playback_revision !== next.playback_revision
        ? roomPosition(next)
        : previous.playbackStart;
      return { room: next, playbackStart };
    });
  }, []);

  useEffect(() => {
    if (authLoading || !userId || !validRoomId(roomId)) return;
    let active = true;
    void roomRequest(`/api/watch-rooms/${roomId}/join`, "POST")
      .then(async (joinedRoom) => {
        if (!active) return;
        acceptRoom(joinedRoom);
        const response = await fetch(`/api/movies?id=${joinedRoom.tmdb_id}&media_type=${joinedRoom.media_type}&language=${encodeURIComponent(language)}`);
        const details = await response.json() as Movie & { error?: string };
        if (!response.ok) throw new Error(details.error || "Title unavailable.");
        if (active) setMovie({ ...details, media_type: joinedRoom.media_type });
      })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [acceptRoom, authLoading, language, roomId, userId]);

  const joined = Boolean(view);
  useEffect(() => {
    if (!userId || !joined || !supabase) return;
    const channel = supabase.channel(`cinemy-watch-room-${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "watch_rooms",
        filter: `id=eq.${roomId}`,
      }, (payload) => acceptRoom(payload.new as WatchRoom))
      .subscribe();
    // Polling recovers from a dropped Realtime connection or a missed event.
    // A single hiccup is normal, so the warning only appears after several
    // failed polls in a row, and any success clears it.
    const refresh = () => {
      void roomRequest(`/api/watch-rooms/${roomId}`, "GET")
        .then((next) => { acceptRoom(next); missedPollsRef.current = 0; setNotice(""); })
        .catch(() => {
          missedPollsRef.current += 1;
          if (missedPollsRef.current >= 3) setNotice(ro ? "Conexiunea cu camera s-a întrerupt. Reîncercăm..." : "Room connection lost. Retrying...");
        });
    };
    const poll = window.setInterval(refresh, 10_000);
    // Returning to the tab resyncs immediately instead of waiting for the poll.
    const resyncWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", resyncWhenVisible);
    window.addEventListener("focus", resyncWhenVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", resyncWhenVisible);
      window.removeEventListener("focus", resyncWhenVisible);
      void supabase?.removeChannel(channel);
    };
  }, [acceptRoom, joined, roomId, ro, userId]);

  const room = view?.room;
  const isHost = Boolean(room && userId === room.host_user_id);

  const updateRoom = useCallback(async (action: "pause" | "play" | "progress" | "episode", positionSeconds: number, next?: { season: number; episode: number }) => {
    if (!isHost || !room) return;
    if (action !== "progress") setBusy(true);
    try {
      const updated = await roomRequest(`/api/watch-rooms/${roomId}`, "PATCH", {
        action,
        positionSeconds: Math.max(0, Math.floor(positionSeconds)),
        ...(next ? { season: next.season, episode: next.episode } : {}),
      });
      acceptRoom(updated);
      setNotice("");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Room update failed.");
    } finally {
      if (action !== "progress") setBusy(false);
    }
  }, [acceptRoom, isHost, room, roomId]);

  const onProgress = useCallback((seconds: number) => {
    currentPositionRef.current = seconds;
    if (!isHost || !room?.is_playing || Date.now() - lastProgressSentRef.current < 7_000) return;
    lastProgressSentRef.current = Date.now();
    void updateRoom("progress", seconds);
  }, [isHost, room?.is_playing, updateRoom]);

  const nextEpisode = (() => {
    if (!isHost || !movie || movie.media_type !== "tv" || !room) return null;
    const seasons = ((movie as Movie & { seasons?: TvSeason[] }).seasons || [])
      .filter((item) => item.season_number > 0 && item.episode_count > 0)
      .sort((a, b) => a.season_number - b.season_number);
    const current = seasons.find((item) => item.season_number === room.season_number);
    if (current && room.episode_number < current.episode_count) return { season: room.season_number, episode: room.episode_number + 1 };
    const following = seasons.find((item) => item.season_number > room.season_number);
    return following ? { season: following.season_number, episode: 1 } : null;
  })();

  const leaveRoom = async () => {
    if (isHost && room?.is_playing) await updateRoom("pause", currentPositionRef.current || roomPosition(room));
    router.push("/");
  };

  if (!validRoomId(roomId)) return <main className="watch-message"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Link invalid" : "Invalid room link"}</h1></main>;
  if (!configured) return <main className="watch-message"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Conturile nu sunt configurate" : "Accounts are not configured"}</h1></main>;
  if (authLoading) return <main className="watch-message"><span className="brand">CINEMY</span><p>{ro ? "Verificăm contul..." : "Checking your account..."}</p></main>;
  if (!user) return (
    <main className="watch-message">
      <Link className="brand" href="/">CINEMY</Link>
      <h1>Watch together</h1>
      <p>{ro ? "Trebuie să intri în cont înainte să te alături camerei." : "Sign in before joining this room."}</p>
      <Link className="button button-primary" href={`/account?next=${encodeURIComponent(`/watch-together/${roomId}`)}`}>{ro ? "Autentifică-te" : "Sign in"}</Link>
    </main>
  );
  if (error) return <main className="watch-message"><Link className="brand" href="/">CINEMY</Link><h1>{ro ? "Camera nu este disponibilă" : "Room unavailable"}</h1><p>{error}</p><Link className="button button-primary" href="/">← Home</Link></main>;
  if (!room || !movie || !view) return <main className="watch-message"><span className="brand">CINEMY</span><p>{ro ? "Intrăm în cameră..." : "Joining room..."}</p></main>;

  return (
    <>
      <PlayerModal
        key={`${room.id}-${room.season_number}-${room.episode_number}`}
        movie={movie}
        language={language}
        resumeAt={view.playbackStart}
        season={room.season_number}
        episode={room.episode_number}
        shareUrl={typeof window === "undefined" ? undefined : window.location.href}
        watchTogether={{
          isHost,
          isPlaying: room.is_playing,
          busy,
          onPause: (seconds) => updateRoom("pause", seconds),
          onPlay: () => updateRoom("play", room.position_seconds),
          onProgress,
        }}
        onNextEpisode={nextEpisode ? () => void updateRoom("episode", 0, nextEpisode) : undefined}
        onClose={() => { void leaveRoom(); }}
        onGoHome={() => { void leaveRoom(); }}
      />
      {notice && <div className="watch-room-notice" role="alert">{notice}</div>}
    </>
  );
}
