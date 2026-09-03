"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Movie, WatchHistory } from "@/lib/types";
import { movieTitle } from "@/lib/types";
import { saveWatchProgress } from "@/lib/progress-storage";

interface PlayerModalProps {
  movie: Movie;
  resumeAt?: number;
  season?: number;
  episode?: number;
  onClose: () => void;
  onProgressSaved?: () => void;
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

export function PlayerModal({ movie, resumeAt = 0, season = 1, episode = 1, onClose, onProgressSaved }: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentRef = useRef(resumeAt);
  const durationRef = useRef(0);
  const playingRef = useRef(false);
  const receivedPlayerTimeRef = useRef(false);
  const [error, setError] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const configuredBaseUrl = process.env.NEXT_PUBLIC_STREAM_BASE_URL?.replace(/\/$/, "") || "";
  const configuredMode = process.env.NEXT_PUBLIC_STREAM_MODE === "hls" ? "hls" : "iframe";
  const mediaType = movie.media_type || "movie";

  const providerUrl = useMemo(() => {
    if (!configuredBaseUrl) return "";
    const path = mediaType === "tv" ? `/tv/${movie.id}/${season}/${episode}` : `/movie/${movie.id}`;
    return `${configuredBaseUrl}${path}?autoplay=true&start=${Math.floor(resumeAt)}`;
  }, [configuredBaseUrl, mediaType, movie.id, season, episode, resumeAt]);

  useEffect(() => {
    if (providerUrl || mediaType !== "movie") return;
    const controller = new AbortController();
    setLoadingTrailer(true);
    fetch(`/api/movies?id=${movie.id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Trailer indisponibil");
        return response.json() as Promise<{ videos?: { results?: TmdbVideo[] } }>;
      })
      .then((details) => {
        const videos = details.videos?.results || [];
        const trailer = videos.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official)
          || videos.find((video) => video.site === "YouTube" && video.type === "Trailer")
          || videos.find((video) => video.site === "YouTube");
        if (!trailer) throw new Error("Nu există trailer pentru acest titlu.");
        setTrailerUrl(`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&start=${Math.floor(resumeAt)}`);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => setLoadingTrailer(false));
    return () => controller.abort();
  }, [providerUrl, mediaType, movie.id, resumeAt]);

  const sourceUrl = providerUrl || trailerUrl;
  const mode = providerUrl ? configuredMode : "iframe";

  const saveProgress = useCallback(async (keepalive = false) => {
    if (currentRef.current <= 0) return;
    const item: WatchHistory = {
      media_id: `${mediaType}_${movie.id}`,
      title: movieTitle(movie),
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      progress_seconds: Math.floor(currentRef.current),
      duration_seconds: Math.max(Math.floor(durationRef.current), Math.floor(currentRef.current)),
    };
    await saveWatchProgress(item, keepalive);
    onProgressSaved?.();
  }, [mediaType, movie, onProgressSaved]);

  useEffect(() => {
    if (mode !== "hls" || !sourceUrl || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = sourceUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 40, backBufferLength: 30 });
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_, data) => data.fatal && setError("Fluxul HLS nu a putut fi redat."));
    } else {
      setError("Browserul nu suportă redarea HLS.");
    }

    const loaded = () => {
      durationRef.current = Number.isFinite(video.duration) ? video.duration : 0;
      if (resumeAt > 0 && resumeAt < video.duration) video.currentTime = resumeAt;
    };
    const time = () => {
      currentRef.current = video.currentTime;
      durationRef.current = Number.isFinite(video.duration) ? video.duration : durationRef.current;
    };
    const play = () => { playingRef.current = true; };
    const pause = () => { playingRef.current = false; void saveProgress(); };
    video.addEventListener("loadedmetadata", loaded);
    video.addEventListener("timeupdate", time);
    video.addEventListener("play", play);
    video.addEventListener("pause", pause);
    return () => {
      video.removeEventListener("loadedmetadata", loaded);
      video.removeEventListener("timeupdate", time);
      video.removeEventListener("play", play);
      video.removeEventListener("pause", pause);
      hls?.destroy();
    };
  }, [mode, sourceUrl, resumeAt, saveProgress]);

  useEffect(() => {
    if (mode !== "iframe") return;
    const allowedOrigin = providerUrl ? new URL(providerUrl).origin : "https://www.youtube-nocookie.com";
    const receive = (event: MessageEvent) => {
      if (event.origin !== allowedOrigin || typeof event.data !== "object") return;
      const data = event.data as { type?: string; currentTime?: number; duration?: number; paused?: boolean };
      if (data.type === "timeupdate") {
        receivedPlayerTimeRef.current = true;
        if (typeof data.currentTime === "number") currentRef.current = data.currentTime;
        if (typeof data.duration === "number") durationRef.current = data.duration;
        playingRef.current = !data.paused;
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [mode, providerUrl]);

  useEffect(() => {
    if (mode !== "iframe" || !sourceUrl) return;
    const clock = window.setInterval(() => {
      if (playingRef.current && !receivedPlayerTimeRef.current) {
        currentRef.current += 1;
        if (!durationRef.current) durationRef.current = 7200;
      }
    }, 1000);
    return () => window.clearInterval(clock);
  }, [mode, sourceUrl]);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      if (playingRef.current) void saveProgress();
    }, 10_000);
    return () => window.clearInterval(heartbeat);
  }, [saveProgress]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);

  const close = () => {
    void saveProgress(true);
    onClose();
  };

  return (
    <div className="player-modal" role="dialog" aria-modal="true" aria-label={`Player ${movieTitle(movie)}`}>
      <div className="player-header">
        <div><span className="live-dot" /> ACUM REDAI <strong>{movieTitle(movie)}</strong></div>
        <button onClick={close} aria-label="Închide playerul">×</button>
      </div>
      <div className="player-stage">
        {loadingTrailer && <div className="player-message"><span>▶</span><h2>Se încarcă trailerul…</h2></div>}
        {!loadingTrailer && sourceUrl && mode === "hls" && (
          <video ref={videoRef} controls autoPlay playsInline aria-label={movieTitle(movie)} />
        )}
        {!loadingTrailer && sourceUrl && mode === "iframe" && (
          <iframe
            src={sourceUrl}
            title={movieTitle(movie)}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => { playingRef.current = true; }}
          />
        )}
        {!loadingTrailer && !sourceUrl && error && <div className="player-message"><h2>{error}</h2></div>}
      </div>
      <div className="player-footer"><span>HD</span><span>Trailer / sursă autorizată</span><span>ESC pentru închidere</span></div>
    </div>
  );
}
