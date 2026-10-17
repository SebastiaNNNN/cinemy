"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie, WatchHistory } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";
import { saveWatchProgress } from "@/lib/progress-storage";
import { streamEmbedUrl } from "@/lib/stream-provider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import { useParty } from "@/components/PartyProvider";
import { getAccessToken } from "@/lib/auth-token";
import type { CatalogLanguage } from "@/components/CatalogLanguageProvider";

interface PlayerModalProps {
  movie: Movie;
  resumeAt?: number;
  season?: number;
  episode?: number;
  language?: CatalogLanguage;
  shareUrl?: string;
  watchTogether?: {
    isHost: boolean;
    isPlaying: boolean;
    busy: boolean;
    onPause: (seconds: number) => void | Promise<void>;
    onPlay: () => void | Promise<void>;
    onProgress: (seconds: number, duration: number) => void;
  };
  partyMode?: "host" | "guest";
  onCinematicModeChange?: (cinematic: boolean, positionSeconds: number) => void;
  onClose: () => void;
  onGoHome?: () => void;
  onProgressSaved?: () => void;
  onNextEpisode?: () => void;
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

interface CinematicDetails extends Movie {
  tagline?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: Array<{ id: number; name: string }>;
  status?: string;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  videos?: { results?: TmdbVideo[] };
}

export function PlayerModal({ movie, resumeAt = 0, season = 1, episode = 1, language = "en-US", shareUrl, watchTogether, partyMode, onCinematicModeChange, onClose, onGoHome, onProgressSaved, onNextEpisode }: PlayerModalProps) {
  const router = useRouter();
  const { text } = useCatalogLanguage();
  const { user } = useAuth();
  const { createInvite: createPartyInvite } = useParty();
  const streamRef = useRef<HTMLIFrameElement>(null);
  const ambientTrailerRef = useRef<HTMLIFrameElement>(null);
  const currentRef = useRef(resumeAt);
  const durationRef = useRef(0);
  const seasonRef = useRef(season);
  const episodeRef = useRef(episode);
  const nextTriggeredRef = useRef(false);
  const lastSavedAtRef = useRef(0);
  const playbackObservedRef = useRef(false);
  const lastPositionRef = useRef(resumeAt);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [streamNeedsAttention, setStreamNeedsAttention] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareError, setShareError] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [partyInviteUrl, setPartyInviteUrl] = useState("");
  const [localStartAt, setLocalStartAt] = useState(resumeAt);
  const [progressSaveError, setProgressSaveError] = useState(false);
  const [cinematicMode, setCinematicMode] = useState(false);
  const [cinematicDetails, setCinematicDetails] = useState<CinematicDetails | null>(null);
  const [ambientTrailerKey, setAmbientTrailerKey] = useState("");
  const [ambientTrailerPlaying, setAmbientTrailerPlaying] = useState(false);
  const mediaType = movie.media_type || "movie";
  const roomPlaying = watchTogether?.isPlaying;
  const sourceUrl = streamEmbedUrl(mediaType, movie.id, season, episode, localStartAt, language);

  useEffect(() => { setLocalStartAt(resumeAt); }, [episode, resumeAt, season]);

  useEffect(() => {
    if (!cinematicMode || cinematicDetails?.id === movie.id) return;
    const controller = new AbortController();
    fetch(`/api/movies?id=${movie.id}&media_type=${mediaType}&language=${encodeURIComponent(language)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Details unavailable");
        return response.json() as Promise<CinematicDetails>;
      })
      .then((details) => {
        setCinematicDetails({ ...details, media_type: mediaType });
        const videos = details.videos?.results || [];
        const trailer = videos.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official)
          || videos.find((video) => video.site === "YouTube" && video.type === "Trailer")
          || videos.find((video) => video.site === "YouTube");
        setAmbientTrailerKey(trailer?.key || "");
        setAmbientTrailerPlaying(false);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setCinematicDetails({ ...movie, media_type: mediaType });
      });
    return () => controller.abort();
  }, [cinematicDetails?.id, cinematicMode, language, mediaType, movie]);

  useEffect(() => {
    if (!cinematicMode || !ambientTrailerKey) return;
    const receiveTrailerState = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com" && event.origin !== "https://www.youtube.com") return;
      try {
        const payload = typeof event.data === "string" ? JSON.parse(event.data) as { info?: { playerState?: number } } : event.data as { info?: { playerState?: number } };
        if (payload?.info?.playerState === 1) setAmbientTrailerPlaying(true);
      } catch {
        // Ignore unrelated YouTube messages.
      }
    };
    window.addEventListener("message", receiveTrailerState);
    return () => window.removeEventListener("message", receiveTrailerState);
  }, [ambientTrailerKey, cinematicMode]);

  const updatePlaybackPosition = useCallback((nextTime: number, nextDuration?: number) => {
    if (!Number.isFinite(nextTime) || nextTime < 0) return;
    currentRef.current = nextTime;
    if (typeof nextDuration === "number" && Number.isFinite(nextDuration) && nextDuration > 0) {
      durationRef.current = nextDuration;
    }

    const duration = durationRef.current;
    const remaining = duration - nextTime;
    if (mediaType === "tv" && onNextEpisode && duration > 0 && remaining <= 20) {
      setNextCountdown(Math.max(0, Math.min(20, Math.ceil(remaining))));
    } else if (remaining > 20) {
      setNextCountdown(null);
    }
  }, [mediaType, onNextEpisode]);

  const saveProgress = useCallback(async (keepalive = false): Promise<boolean> => {
    // Merely opening a title must not create a zero-second Continue Watching entry.
    if (currentRef.current <= 0) return true;
    const item: WatchHistory = {
      media_id: `${mediaType}_${movie.id}`,
      title: movieTitle(movie),
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      progress_seconds: Math.floor(currentRef.current),
      duration_seconds: Math.max(Math.floor(durationRef.current), Math.floor(currentRef.current)),
      season_number: mediaType === "tv" ? seasonRef.current : undefined,
      episode_number: mediaType === "tv" ? episodeRef.current : undefined,
    };
    try {
      const saved = await saveWatchProgress(item, keepalive);
      if (saved) {
        setProgressSaveError(false);
        onProgressSaved?.();
      }
      return true;
    } catch {
      setProgressSaveError(true);
      return false;
    }
  }, [episode, mediaType, movie, onProgressSaved, season]);

  useEffect(() => {
    currentRef.current = resumeAt;
    durationRef.current = ((mediaType === "tv" ? movie.episode_run_time?.[0] : movie.runtime) || 0) * 60;
    seasonRef.current = season;
    episodeRef.current = episode;
    nextTriggeredRef.current = false;
    lastPositionRef.current = resumeAt;
    playbackObservedRef.current = false;
    setStreamNeedsAttention(false);
    setNextCountdown(null);
  }, [episode, mediaType, movie.episode_run_time, movie.runtime, resumeAt, season]);

  useEffect(() => {
    if (shareMenuOpen || roomPlaying === false) return;
    playbackObservedRef.current = false;
    lastPositionRef.current = resumeAt;
    setStreamNeedsAttention(false);
    // iframe onLoad only means the embedded document loaded, not that video started.
    const timer = window.setTimeout(() => {
      if (!playbackObservedRef.current) setStreamNeedsAttention(true);
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [episode, movie.id, resumeAt, retryCount, roomPlaying, season, shareMenuOpen, sourceUrl]);

  useEffect(() => {
    // Vidstuck sends JSON-string progress messages from the embedded frame.
    const receiveProgress = (event: MessageEvent) => {
      if (event.source !== streamRef.current?.contentWindow || event.origin !== new URL(sourceUrl).origin) return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== "object") return;
      const payload = data as {
        id?: unknown;
        type?: unknown;
        timestamp?: unknown;
        duration?: unknown;
        season?: unknown;
        episode?: unknown;
      };
      if (payload.id !== undefined && Number(payload.id) !== movie.id) return;
      if (payload.type !== undefined && payload.type !== mediaType) return;
      if (mediaType === "tv" && (
        (payload.season !== undefined && Number(payload.season) !== season)
        || (payload.episode !== undefined && Number(payload.episode) !== episode)
      )) return;
      const timestamp = Number(payload.timestamp);
      const duration = Number(payload.duration);
      if (!Number.isFinite(timestamp) || timestamp < 0) return;
      if (timestamp > lastPositionRef.current + 0.5) {
        playbackObservedRef.current = true;
        setStreamNeedsAttention(false);
      }
      lastPositionRef.current = timestamp;
      updatePlaybackPosition(timestamp, Number.isFinite(duration) && duration > 0 ? duration : undefined);
      watchTogether?.onProgress(timestamp, Number.isFinite(duration) && duration > 0 ? duration : durationRef.current);
      if (Date.now() - lastSavedAtRef.current >= 10_000) {
        lastSavedAtRef.current = Date.now();
        void saveProgress();
      }
    };
    window.addEventListener("message", receiveProgress);
    return () => window.removeEventListener("message", receiveProgress);
  }, [episode, mediaType, movie.id, saveProgress, season, sourceUrl, updatePlaybackPosition, watchTogether]);

  useEffect(() => {
    if (nextCountdown === null || nextCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setNextCountdown((value) => value === null ? null : Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [nextCountdown]);

  const playNextEpisode = useCallback(async () => {
    if (!onNextEpisode || nextTriggeredRef.current) return;
    nextTriggeredRef.current = true;
    await saveProgress(true);
    onNextEpisode();
  }, [onNextEpisode, saveProgress]);

  useEffect(() => {
    if (nextCountdown === 0) void playNextEpisode();
  }, [nextCountdown, playNextEpisode]);

  const close = useCallback(async () => {
    if (await saveProgress(true)) onClose();
    else setPendingClose(true);
  }, [onClose, saveProgress]);

  const goHome = useCallback(async () => {
    if (!cinematicMode) {
      void saveProgress(true);
      if (watchTogether?.isHost) setLocalStartAt(Math.max(0, Math.floor(currentRef.current)));
      setCinematicMode(true);
      onCinematicModeChange?.(true, currentRef.current);
      return;
    }
    if (await saveProgress(true)) {
      if (onGoHome) onGoHome();
      else {
        onClose();
        router.push("/");
      }
    } else setPendingClose(true);
  }, [cinematicMode, onCinematicModeChange, onClose, onGoHome, router, saveProgress, watchTogether?.isHost]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (shareMenuOpen) { setShareMenuOpen(false); return; }
      if (cinematicMode) { setCinematicMode(false); onCinematicModeChange?.(false, currentRef.current); }
      else void close();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [cinematicMode, close, onCinematicModeChange, shareMenuOpen]);

  useEffect(() => {
    const saveBeforeLeaving = () => { void saveProgress(true); };
    const saveWhenHidden = () => { if (document.visibilityState === "hidden") saveBeforeLeaving(); };
    window.addEventListener("pagehide", saveBeforeLeaving);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [saveProgress]);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl || window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

  const openShareMenu = () => {
    const seconds = Math.max(0, Math.floor(currentRef.current));
    setLocalStartAt(seconds);
    setShareError("");
    setShareMenuOpen(true);
    void saveProgress(true);
    if (watchTogether?.isHost && watchTogether.isPlaying) void watchTogether.onPause(seconds);
  };

  const createWatchRoom = async () => {
    if (!user) {
      setShareError(language === "ro-RO" ? "Intră în cont pentru a crea o cameră." : "Sign in to create a room.");
      return;
    }
    setCreatingRoom(true);
    setShareError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(language === "ro-RO" ? "Sesiunea a expirat. Autentifică-te din nou." : "Your session expired. Sign in again.");
      const response = await fetch("/api/watch-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mediaType,
          tmdbId: movie.id,
          season,
          episode,
          positionSeconds: Math.max(0, Math.floor(currentRef.current)),
        }),
      });
      const result = await response.json() as { room?: { id: string }; error?: string };
      if (!response.ok || !result.room?.id) throw new Error(result.error || "Could not create room.");
      router.push(`/watch-together/${result.room.id}`);
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : "Could not create room.");
    } finally {
      setCreatingRoom(false);
    }
  };

  const inviteToParty = async () => {
    setCreatingRoom(true);
    setShareError("");
    try {
      const invite = await createPartyInvite();
      const url = `${window.location.origin}/party/invite/${invite.token}`;
      setPartyInviteUrl(url);
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : "Could not create party invite.");
    } finally { setCreatingRoom(false); }
  };

  // Turn the phone sideways for playback and release the lock when the player closes.
  useEffect(() => {
    const orientation = window.screen?.orientation as (ScreenOrientation & {
      lock?: (value: string) => Promise<void>;
    }) | undefined;
    if (!orientation?.lock) return;
    orientation.lock("landscape").catch(() => {
      // Desktop browsers and unfullscreened tabs reject the lock; native handles those cases.
    });
    return () => orientation.unlock?.();
  }, []);

  const displayedMovie = cinematicDetails || movie;
  const backdrop = displayedMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${displayedMovie.backdrop_path}`
    : undefined;
  const runtime = cinematicDetails?.runtime || cinematicDetails?.episode_run_time?.[0];
  const runtimeLabel = runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : "";
  const ambientTrailerUrl = ambientTrailerKey
    ? `https://www.youtube-nocookie.com/embed/${ambientTrailerKey}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&loop=1&playlist=${ambientTrailerKey}&rel=0&playsinline=1&enablejsapi=1`
    : "";

  const playAmbientTrailer = () => {
    const target = ambientTrailerRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "https://www.youtube-nocookie.com");
    target.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "https://www.youtube-nocookie.com");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`player-experience${cinematicMode ? " is-cinematic" : ""}`}
    >
      <div className="player-floating-header">
        <button
          className="brand player-brand"
          type="button"
          aria-label={cinematicMode ? text.saveAndGoHome : text.cinematicView}
          onClick={goHome}
        >
          CINEMY
        </button>

        <div className={`player-header-actions${watchTogether ? " has-room" : ""}`}>
          {watchTogether && (
            <button className="player-header-button room-control-button" type="button" disabled={watchTogether.busy || !watchTogether.isHost} onClick={() => {
              if (watchTogether.isPlaying) {
                setLocalStartAt(Math.max(0, Math.floor(currentRef.current)));
                void watchTogether.onPause(currentRef.current);
              }
              else void watchTogether.onPlay();
            }}>
              {watchTogether.isHost
                ? watchTogether.isPlaying ? (language === "ro-RO" ? "⏸ Pauză pentru toți" : "⏸ Pause everyone") : (language === "ro-RO" ? "▶ Redă pentru toți" : "▶ Play for everyone")
                : (language === "ro-RO" ? "● Urmărești cu gazda" : "● Watching with host")}
            </button>
          )}
          {partyMode !== "guest" && <button className="player-header-button" type="button" aria-expanded={shareMenuOpen} onClick={openShareMenu}>
            ↗ {text.copyLink}
          </button>}
          <button className="player-header-button" type="button" onClick={close}>
            ✕ {text.close}
          </button>
        </div>
      </div>

      {cinematicMode && (
        <section className="cinematic-page" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
          {ambientTrailerUrl && (
            <iframe
              ref={ambientTrailerRef}
              className={`cinematic-trailer${ambientTrailerPlaying ? " is-playing" : ""}`}
              src={ambientTrailerUrl}
              title={`${movieTitle(displayedMovie)} trailer`}
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              onLoad={() => {
                playAmbientTrailer();
                window.setTimeout(playAmbientTrailer, 500);
              }}
            />
          )}
          <div className="cinematic-shade" />
          <div className="cinematic-content">
            <p className="cinematic-kicker">
              {mediaType === "tv" ? text.tvSeries : text.movies}
              {movieYear(displayedMovie) && <span> · {movieYear(displayedMovie)}</span>}
              {mediaType === "tv" && <span> · S{season}:E{episode}</span>}
            </p>
            <h1>{movieTitle(displayedMovie)}</h1>
            {cinematicDetails?.tagline && <p className="cinematic-tagline">“{cinematicDetails.tagline}”</p>}
            <div className="cinematic-pills">
              <span>★ {displayedMovie.vote_average?.toFixed(1)}</span>
              {cinematicDetails?.genres?.slice(0, 3).map((genre) => <span key={genre.id}>{genre.name}</span>)}
              {runtimeLabel && <span>{runtimeLabel}</span>}
            </div>
            <p className="cinematic-overview">{displayedMovie.overview || text.heroDescription}</p>
            <button className="cinematic-resume" type="button" onClick={() => { setCinematicMode(false); onCinematicModeChange?.(false, currentRef.current); }}>▶ {text.resumePlayback}</button>
          </div>
          <dl className="cinematic-facts">
            <div><dt>{text.nowPlaying}</dt><dd>{mediaType === "tv" ? `S${season}:E${episode}` : movieYear(displayedMovie)}</dd></div>
            {runtimeLabel && <div><dt>Runtime</dt><dd>{runtimeLabel}</dd></div>}
            {cinematicDetails?.production_countries?.[0] && <div><dt>Country</dt><dd>{cinematicDetails.production_countries[0].name}</dd></div>}
            {cinematicDetails?.status && <div><dt>Status</dt><dd>{cinematicDetails.status}</dd></div>}
          </dl>
        </section>
      )}

      <div className="player-video-shell">
        {sourceUrl && !shareMenuOpen && (!watchTogether || watchTogether.isPlaying) && (
          <iframe
            key={`${sourceUrl}-${retryCount}`}
            ref={streamRef}
            src={sourceUrl}
            title={`${movieTitle(movie)}${mediaType === "tv" ? ` S${season}:E${episode}` : ""}`}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setStreamNeedsAttention(true)}
          />
        )}
        {streamNeedsAttention && !cinematicMode && !shareMenuOpen && (!watchTogether || watchTogether.isPlaying) && (
          <div className="stream-recovery" role="status">
            <strong>{language === "ro-RO" ? "Nu a pornit filmul?" : "Still not playing?"}</strong>
            <p>{language === "ro-RO" ? "Poți reîncărca playerul. Uneori sursa externă are nevoie de încă o încercare." : "Reload the player if the external source is stuck."}</p>
            <div>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>{language === "ro-RO" ? "Reîncarcă playerul" : "Reload player"}</button>
              <button type="button" onClick={() => setStreamNeedsAttention(false)}>{language === "ro-RO" ? "Ascunde" : "Dismiss"}</button>
            </div>
          </div>
        )}
        {watchTogether && !watchTogether.isPlaying && !shareMenuOpen && (
          <div className="watch-room-pause" role="status">
            <strong>⏸ {language === "ro-RO" ? "Pauză în cameră" : "Room paused"}</strong>
            <p>{watchTogether.isHost
              ? language === "ro-RO" ? "Doar tu poți relua filmul pentru toți." : "Only you can resume for everyone."
              : language === "ro-RO" ? "Gazda va relua filmul pentru toți." : "The host will resume for everyone."}</p>
            {watchTogether.isHost && <button type="button" disabled={watchTogether.busy} onClick={() => void watchTogether.onPlay()}>
              ▶ {language === "ro-RO" ? "Redă pentru toți" : "Play for everyone"}
            </button>}
          </div>
        )}
        {cinematicMode && (
          <div className="mini-player-label">
            <span><small>{text.nowPlaying}</small>{movieTitle(movie)}{mediaType === "tv" ? ` · S${season}:E${episode}` : ""}</span>
            <button type="button" onClick={() => { setCinematicMode(false); onCinematicModeChange?.(false, currentRef.current); }} aria-label={text.expandPlayer}>⛶</button>
          </div>
        )}
        {nextCountdown !== null && onNextEpisode && (
          <button className="next-episode-overlay" type="button" onClick={() => void playNextEpisode()}>
            <span>{text.nextEpisodeIn(nextCountdown)}</span>
            <strong>{text.playNext} →</strong>
          </button>
        )}
      </div>
      {shareMenuOpen && (
        <div className="player-share-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareMenuOpen(false); }}>
          <section className="player-share-menu" role="dialog" aria-modal="true" aria-label={language === "ro-RO" ? "Distribuie filmul" : "Share this title"}>
            <button className="player-share-close" type="button" aria-label={text.close} onClick={() => setShareMenuOpen(false)}>✕</button>
            <span className="player-share-kicker">CINEMY</span>
            <h2>{language === "ro-RO" ? "Distribuie și vizionați împreună" : "Share & watch together"}</h2>
            <p>{language === "ro-RO" ? "Filmul este pus pe pauză cât timp acest meniu este deschis." : "Playback is paused while this menu is open."}</p>
            <button className="player-share-option" type="button" onClick={() => void copyShareLink()}>
              <span>↗</span><strong>{copyStatus === "copied" ? `✓ ${text.copied}` : copyStatus === "failed" ? text.copyFailed : text.copyLink}</strong>
              <small>{watchTogether && !partyMode
                ? language === "ro-RO" ? "Link de invitație în această cameră" : "Invite link to this room"
                : language === "ro-RO" ? "Link simplu către film" : "A regular link to this title"}</small>
            </button>
            {!watchTogether && <button className="player-share-option" type="button" disabled={creatingRoom} onClick={() => void createWatchRoom()}>
              <span>◉</span><strong>{creatingRoom ? (language === "ro-RO" ? "Creăm camera..." : "Creating room...") : "Watch together"}</strong>
              <small>{language === "ro-RO" ? "Cameră privată · cont necesar · gazda controlează pauza" : "Private room · sign-in required · host controls pause"}</small>
            </button>}
            {partyMode === "host" && <button className="player-share-option" type="button" disabled={creatingRoom} onClick={() => void inviteToParty()}>
              <span>＋</span><strong>{creatingRoom ? "..." : language === "ro-RO" ? "Invită în party" : "Invite to party"}</strong>
              <small>{language === "ro-RO" ? "Creează și copiază un link valabil 2 minute" : "Create and copy a link valid for 2 minutes"}</small>
            </button>}
            {partyInviteUrl && partyMode === "host" && <p className="player-share-hint">{language === "ro-RO" ? "Linkul party-ului a fost copiat:" : "Party invite copied:"} {partyInviteUrl}</p>}
            {watchTogether && <p className="player-share-hint">{language === "ro-RO" ? "Acest link este invitația în camera de vizionare." : "This link invites others into the watch room."}</p>}
            {shareError && <p className="player-share-error" role="alert">{shareError}</p>}
            {!user && !watchTogether && <button className="player-share-signin" type="button" onClick={() => router.push(`/account?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>{language === "ro-RO" ? "Intră în cont" : "Sign in"} →</button>}
          </section>
        </div>
      )}
      {progressSaveError && <div className="progress-save-warning" role="alert">
        <span>{language === "ro-RO" ? "Progresul nu a putut fi salvat." : "Your progress could not be saved."}</span>
        {pendingClose && <>
          <button type="button" onClick={() => void close()}>{language === "ro-RO" ? "Reîncearcă" : "Retry"}</button>
          <button type="button" onClick={onClose}>{language === "ro-RO" ? "Ieși oricum" : "Close anyway"}</button>
        </>}
      </div>}
    </div>
  );
}
