"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import { movieTitle } from "@/lib/types";

interface PlayerModalProps {
  movie: Movie;
  resumeAt?: number;
  season?: number;
  episode?: number;
  onClose: () => void;
  onProgressSaved?: () => void;
}

export function PlayerModal({ movie, resumeAt = 0, season = 1, episode = 1, onClose, onProgressSaved }: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentRef = useRef(resumeAt);
  const durationRef = useRef(0);
  const playingRef = useRef(false);
  const [error, setError] = useState("");
  const baseUrl = process.env.NEXT_PUBLIC_STREAM_BASE_URL?.replace(/\/$/, "");
  const mode = process.env.NEXT_PUBLIC_STREAM_MODE === "hls" ? "hls" : "iframe";
  const mediaType = movie.media_type || "movie";

  const sourceUrl = useMemo(() => {
    if (!baseUrl) return "";
    const path = mediaType === "tv" ? `/tv/${movie.id}/${season}/${episode}` : `/movie/${movie.id}`;
    const separator = `${baseUrl}${path}`.includes("?") ? "&" : "?";
    return `${baseUrl}${path}${separator}autoplay=true&start=${Math.floor(resumeAt)}`;
  }, [baseUrl, mediaType, movie.id, season, episode, resumeAt]);

  const saveProgress = useCallback(async (keepalive = false) => {
    if (currentRef.current <= 0) return;
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive,
        body: JSON.stringify({
          media_id: `${mediaType}_${movie.id}`,
          title: movieTitle(movie),
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          progress_seconds: Math.floor(currentRef.current),
          duration_seconds: Math.floor(durationRef.current),
        }),
      });
      onProgressSaved?.();
    } catch {
      // Următorul heartbeat va reîncerca fără să întrerupă redarea.
    }
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
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError("Fluxul HLS nu a putut fi redat.");
      });
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
    // iframe-urile cross-origin nu expun timpul playerului. Providerul poate trimite
    // mesaje { type: "timeupdate", currentTime, duration, paused } pentru sincronizare exactă.
    const providerOrigin = baseUrl ? new URL(baseUrl).origin : "";
    const receive = (event: MessageEvent) => {
      if (!providerOrigin || event.origin !== providerOrigin || typeof event.data !== "object") return;
      const data = event.data as { type?: string; currentTime?: number; duration?: number; paused?: boolean };
      if (data.type === "timeupdate") {
        if (typeof data.currentTime === "number") currentRef.current = data.currentTime;
        if (typeof data.duration === "number") durationRef.current = data.duration;
        playingRef.current = !data.paused;
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [mode, baseUrl]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (playingRef.current) void saveProgress();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [saveProgress]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
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
        {!sourceUrl ? (
          <div className="player-message">
            <span>▶</span>
            <h2>Configurează providerul video</h2>
            <p>Adaugă un URL autorizat în <code>NEXT_PUBLIC_STREAM_BASE_URL</code>, apoi repornește aplicația.</p>
          </div>
        ) : mode === "hls" ? (
          <video ref={videoRef} controls autoPlay playsInline aria-label={movieTitle(movie)} />
        ) : (
          <iframe
            src={sourceUrl}
            title={movieTitle(movie)}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => { playingRef.current = true; }}
          />
        )}
        {error && <div className="player-error">{error}</div>}
      </div>
      <div className="player-footer">
        <span>HD</span><span>Subtitrări</span><span>ESC pentru închidere</span>
      </div>
    </div>
  );
}
