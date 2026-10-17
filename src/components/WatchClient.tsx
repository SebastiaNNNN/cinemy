"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlayerModal } from "@/components/PlayerModal";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { useParty } from "@/components/PartyProvider";
import { loadWatchHistory } from "@/lib/progress-storage";
import type { Movie, TvSeason } from "@/lib/types";
import { clearWatchReturn, hasWatchReturn, parseWatchCode, watchHref } from "@/lib/watch-links";
import { resolveWatchPosition } from "@/lib/watch-progress";

export function WatchClient({ code, initialSeason, initialEpisode }: { code: string; initialSeason?: number; initialEpisode?: number }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { language, text } = useCatalogLanguage();
  const { party, updateParty } = useParty();
  const partyRef = useRef(party);
  const lastPartyProgressRef = useRef(0);
  const [partyError, setPartyError] = useState("");
  const [partyRetry, setPartyRetry] = useState(0);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [resumeAt, setResumeAt] = useState(0);
  const [season, setSeason] = useState(initialSeason ?? 1);
  const [episode, setEpisode] = useState(initialEpisode ?? 1);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  const parsed = parseWatchCode(code);

  useEffect(() => { partyRef.current = party; }, [party]);

  useEffect(() => {
    if (authLoading) return;
    if (!parsed) {
      setError(text.invalidWatchLink);
      return;
    }

    const controller = new AbortController();
    setMovie(null);
    setError("");
    Promise.all([
      fetch(`/api/movies?id=${parsed.id}&media_type=${parsed.mediaType}&language=${encodeURIComponent(language)}`, {
        signal: controller.signal,
      }).then(async (response) => {
        const data = (await response.json()) as Movie & { error?: string };
        if (!response.ok) throw new Error(data.error || text.movieUnavailable);
        return { ...data, media_type: parsed.mediaType } as Movie;
      }),
      // Do not silently start at zero when account history cannot be read:
      // a later save would overwrite the user's actual resume point.
      user ? loadWatchHistory() : Promise.resolve([]),
    ])
      .then(([loadedMovie, history]) => {
        if (controller.signal.aborted) return;
        const saved = history.find((item) => item.media_id === `${parsed.mediaType}_${parsed.id}`);
        const position = resolveWatchPosition(parsed.mediaType, saved, initialSeason, initialEpisode);
        setSeason(position.season);
        setEpisode(position.episode);
        setResumeAt(position.resumeAt);
        setMovie(loadedMovie);
        if (position.redirectToSavedEpisode) {
          router.replace(watchHref(loadedMovie, position.season, position.episode), { scroll: false });
        }
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });

    return () => controller.abort();
  }, [authLoading, code, initialEpisode, initialSeason, language, loadAttempt, parsed?.id, parsed?.mediaType, router, text.invalidWatchLink, text.movieUnavailable, user?.id]);

  useEffect(() => {
    if (!movie || !party || party.ended_at) return;
    const mediaType = movie.media_type || "movie";
    if (party.media_type === mediaType && party.tmdb_id === movie.id
      && (mediaType !== "tv" || (party.season_number === season && party.episode_number === episode))) return;
    let active = true;
    void updateParty({ action: "select", mediaType, tmdbId: movie.id, season, episode, positionSeconds: resumeAt })
      .then(() => { if (active) setPartyError(""); })
      .catch((reason: Error) => { if (active) setPartyError(reason.message); });
    return () => { active = false; };
  }, [episode, movie, party, partyRetry, resumeAt, season, updateParty]);

  const nextEpisode = (() => {
    if (!movie || movie.media_type !== "tv") return null;
    const seasons = ((movie as Movie & { seasons?: TvSeason[] }).seasons || [])
      .filter((item) => item.season_number > 0 && item.episode_count > 0)
      .sort((a, b) => a.season_number - b.season_number);
    const currentSeason = seasons.find((item) => item.season_number === season);
    if (currentSeason && episode < currentSeason.episode_count) return { season, episode: episode + 1 };
    const followingSeason = seasons.find((item) => item.season_number > season);
    return followingSeason ? { season: followingSeason.season_number, episode: 1 } : null;
  })();

  const playNextEpisode = () => {
    if (!movie || !nextEpisode) return;
    setResumeAt(0);
    setSeason(nextEpisode.season);
    setEpisode(nextEpisode.episode);
    router.replace(watchHref(movie, nextEpisode.season, nextEpisode.episode), { scroll: false });
  };

  const closePlayer = () => {
    const watchPath = window.location.pathname;
    const canReturn = hasWatchReturn(watchPath);
    clearWatchReturn();
    if (canReturn) router.back();
    else router.push("/");
  };

  const goHome = () => {
    clearWatchReturn();
    router.push("/");
  };

  if (error) {
    return (
      <main className="watch-message">
        <Link className="brand" href="/">CINEMY</Link>
        <h1>{parsed ? (language === "ro-RO" ? "Nu am putut deschide titlul" : "Could not open this title") : text.invalidWatchLink}</h1>
        <p>{error}</p>
        {parsed && <button className="button button-primary" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{language === "ro-RO" ? "Reîncearcă" : "Retry"}</button>}
        <Link className="button button-primary" href="/">← {text.backHome}</Link>
      </main>
    );
  }

  if (!movie) {
    return <main className="watch-message"><span className="brand">CINEMY</span><p>{text.loadingMovie}</p></main>;
  }

  const partyReady = !party || party.ended_at || (party.media_type === (movie.media_type || "movie")
    && party.tmdb_id === movie.id && ((movie.media_type || "movie") !== "tv"
      || (party.season_number === season && party.episode_number === episode)));
  if (!partyReady) return <main className="watch-message">
    <span className="brand">CINEMY</span>
    <h1>{language === "ro-RO" ? "Pregătim party-ul" : "Preparing the party"}</h1>
    {partyError ? <><p role="alert">{partyError}</p><button className="button button-primary" type="button" onClick={() => { setPartyError(""); setPartyRetry((value) => value + 1); }}>{language === "ro-RO" ? "Reîncearcă" : "Retry"}</button></>
      : <p>{language === "ro-RO" ? "Trimitem filmul către invitați..." : "Sharing this title with your guests..."}</p>}
  </main>;

  return (
    <>
    <PlayerModal
      key={`${movie.id}-${season}-${episode}`}
      movie={movie}
      language={language}
      resumeAt={resumeAt}
      season={season}
      episode={episode}
      partyMode={party && !party.ended_at ? "host" : undefined}
      watchTogether={party && !party.ended_at ? {
        isHost: true,
        isPlaying: party.is_playing,
        busy: false,
        onPause: (seconds) => { void updateParty({ action: "pause", positionSeconds: seconds }).catch((reason: Error) => setPartyError(reason.message)); },
        onPlay: () => { void updateParty({ action: "play", positionSeconds: partyRef.current?.position_seconds ?? 0 }).catch((reason: Error) => setPartyError(reason.message)); },
        onProgress: (seconds) => {
          if (Date.now() - lastPartyProgressRef.current < 7000 || !partyRef.current?.is_playing) return;
          lastPartyProgressRef.current = Date.now();
          void updateParty({ action: "progress", positionSeconds: seconds }).catch(() => {});
        },
      } : undefined}
      onCinematicModeChange={party && !party.ended_at ? (cinematic, seconds) => {
        void updateParty({ action: cinematic ? "pause" : "play", positionSeconds: seconds })
          .catch((reason: Error) => setPartyError(reason.message));
      } : undefined}
      onNextEpisode={nextEpisode ? playNextEpisode : undefined}
      onClose={closePlayer}
      onGoHome={goHome}
    />
    {partyError && <div className="watch-room-notice" role="alert">{partyError}</div>}
    </>
  );
}
