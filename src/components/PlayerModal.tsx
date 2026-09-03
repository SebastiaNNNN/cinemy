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
  
  // Setat direct pe providerul 4K fără verificări
  const configuredBaseUrl = "https://vidlink.pro";
  const configuredMode = process.env.NEXT_PUBLIC_STREAM_MODE === "hls" ? "hls" : "iframe";
  const mediaType = movie.media_type || "movie";

  const providerUrl = useMemo(() => {
    if (!configuredBaseUrl) return "";
    const path = mediaType === "tv" ? `/tv/${movie.id}/${season}/${episode}` : `/movie/${movie.id}`;
    
    // Parametri optimizați: temă Netflix roșie (#e50914), autoplay și poziție de start
    const params = new URLSearchParams({
      autoplay: "true",
      primaryColor: "e50914",
      secondaryColor: "141414",
      iconColor: "e50914",
      title: "false",
      poster: "true",
      player: "default",
      startAt: Math.floor(resumeAt).toString(),
    });

    return `${configuredBaseUrl}${path}?${params.toString()}`;
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
      hls = new Hls({ maxBufferLength: 60, backBufferLength: 30 });
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_, data) => data.fatal && setError("Fluxul nu a putut fi redat."));
    } else {
      setError("Browserul nu suportă redarea fluxului video.");
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

  // Ascultător oficial pentru evenimentele de redare din VidLink (postMessage)
  useEffect(() => {
    if (mode !== "iframe") return;
    const allowedOrigin = providerUrl ? new URL(providerUrl).origin : "https://www.youtube-nocookie.com";
    
    const receive = (event: MessageEvent) => {
      if (event.origin !== allowedOrigin || !event.data) return;

      // Formatul oficial transmis de VidLink: PLAYER_EVENT
      if (event.data.type === "PLAYER_EVENT" && event.data.data) {
        const { event: evt, currentTime, duration } = event.data.data;
        receivedPlayerTimeRef.current = true;
        if (typeof currentTime === "number") currentRef.current = currentTime;
        if (typeof duration === "number") durationRef.current = duration;
        playingRef.current = evt === "play" || evt === "timeupdate";
        if (evt === "pause" || evt === "ended") void saveProgress();
      }
    };
    
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [mode, providerUrl, saveProgress]);

  // Cronometru intern de siguranță dacă iframe-ul blochează mesajele
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

  // Heartbeat salvare progres la fiecare 10 secunde
  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      if (playingRef.current) void saveProgress();
    }, 10_000);
    return () => window.clearInterval(heartbeat);
  }, [saveProgress]);

  // Închidere la tasta ESC
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
    <div className="player-modal fixed inset-0 z-50 bg-black/95 flex flex-col justify-center items-center" role="dialog" aria-modal="true">
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between z-10">
        <div className="text-white text-sm font-semibold flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
          ACUM REDAI: <span className="text-neutral-300 font-bold">{movieTitle(movie)}</span>
        </div>
        <button 
          onClick={close} 
          className="text-white bg-neutral-800/80 hover:bg-neutral-700 p-2 rounded-full transition"
          aria-label="Închide playerul"
        >
          ✕
        </button>
      </div>

      <div className="w-full h-full flex items-center justify-center p-0 md:p-6">
        {loadingTrailer && <div className="text-white text-lg font-medium">Se inițializează stream-ul…</div>}
        
        {!loadingTrailer && sourceUrl && mode === "hls" && (
          <video ref={videoRef} className="w-full max-w-6xl aspect-video rounded-lg shadow-2xl" controls autoPlay playsInline />
        )}
        
        {!loadingTrailer && sourceUrl && mode === "iframe" && (
          <iframe
            src={sourceUrl}
            title={movieTitle(movie)}
            className="w-full h-full md:max-w-6xl md:aspect-video rounded-none md:rounded-lg border-0 shadow-2xl"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => { playingRef.current = true; }}
          />
        )}
        
        {!loadingTrailer && !sourceUrl && error && (
          <div className="text-red-500 font-medium">{error}</div>
        )}
      </div>

      <div className="absolute bottom-4 left-6 right-6 flex justify-between text-xs text-neutral-400">
        <span className="bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold">4K UHD / AUTO</span>
        <span>Apasă ESC sau butonul din dreapta pentru închidere</span>
      </div>
    </div>
  );
}