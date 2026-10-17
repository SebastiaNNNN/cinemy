import type { MediaType } from "@/lib/types";

// Embed host documented at https://vidstuck.cc/documentation.
const DEFAULT_EMBED_BASE = "https://vidstuck.cc/embed";

export function streamEmbedUrl(
  mediaType: MediaType,
  tmdbId: number,
  season = 1,
  episode = 1,
  resumeAt = 0,
  language = "en-US",
) {
  const configured = process.env.NEXT_PUBLIC_STREAM_BASE_URL?.trim();
  const base = (configured || DEFAULT_EMBED_BASE).replace(/\/+$/, "");
  const id = encodeURIComponent(String(tmdbId));
  const path = mediaType === "tv"
    ? `${base}/tv/${id}/${season}/${episode}`
    : `${base}/movie/${id}`;
  const url = new URL(path);
  // Documented query parameters: color, branding, subtitle, server, progress,
  // nextEpisode, episodeSelector, autoplayNextEpisode and overlay.
  url.searchParams.set("branding", "CINEMY");
  url.searchParams.set("color", "B20710");
  url.searchParams.set("subtitle", language === "ro-RO" ? "romanian" : "english");
  url.searchParams.set("overlay", "true");
  // Show the built-in "next episode" button for TV shows.
  if (mediaType === "tv") url.searchParams.set("nextEpisode", "true");
  // Optional preferred streaming server, e.g. "valstrax".
  const server = process.env.NEXT_PUBLIC_STREAM_SERVER?.trim();
  if (server) url.searchParams.set("server", server);
  // Some embeds treat progress=0 as an absent override, so request second 1 for a fresh start.
  const startAt = Number.isFinite(resumeAt) && resumeAt > 0 ? Math.max(1, Math.floor(resumeAt)) : 1;
  url.searchParams.set("progress", String(startAt));
  return url.toString();
}
