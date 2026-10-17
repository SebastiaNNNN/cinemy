import { movieTitle, type MediaType, type Movie, type WatchHistory } from "./types";

/** A saved position belongs to one title and, for TV, one specific episode. */
export function resolveWatchPosition(
  mediaType: MediaType,
  saved: WatchHistory | undefined,
  explicitSeason?: number,
  explicitEpisode?: number,
) {
  const hasExplicitEpisode = explicitSeason !== undefined && explicitEpisode !== undefined;
  const season = mediaType === "tv"
    ? (hasExplicitEpisode ? explicitSeason : saved?.season_number) ?? 1
    : 1;
  const episode = mediaType === "tv"
    ? (hasExplicitEpisode ? explicitEpisode : saved?.episode_number) ?? 1
    : 1;
  const savedMatchesEpisode = mediaType === "movie" || (
    (saved?.season_number ?? 1) === season && (saved?.episode_number ?? 1) === episode
  );
  return {
    season,
    episode,
    resumeAt: saved && savedMatchesEpisode ? Math.max(0, saved.progress_seconds) : 0,
    redirectToSavedEpisode: mediaType === "tv" && !hasExplicitEpisode
      && Boolean(saved?.season_number && saved.episode_number),
  };
}

/**
 * Build the row saved to watch history. Returns null when playback has not
 * really started, so merely opening a title never creates a zero-second
 * "Continue Watching" entry. Duration is never allowed below the position.
 */
export function buildWatchHistory(
  movie: Movie,
  options: {
    mediaType: MediaType;
    positionSeconds: number;
    durationSeconds?: number;
    season?: number;
    episode?: number;
  },
): WatchHistory | null {
  const position = Math.max(0, Math.floor(options.positionSeconds));
  if (position <= 0) return null;
  const requestedDuration = Number.isFinite(options.durationSeconds) ? Math.floor(options.durationSeconds as number) : 0;
  return {
    media_id: `${options.mediaType}_${movie.id}`,
    title: movieTitle(movie),
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    progress_seconds: position,
    duration_seconds: Math.max(position, requestedDuration),
    season_number: options.mediaType === "tv" ? options.season : undefined,
    episode_number: options.mediaType === "tv" ? options.episode : undefined,
  };
}

/**
 * A title counts as finished once it is close enough to the end that resuming
 * it makes no sense. Used to keep completed titles out of Continue Watching.
 */
export function isWatchComplete(
  item: Pick<WatchHistory, "progress_seconds" | "duration_seconds">,
  threshold = 0.92,
): boolean {
  if (!item.duration_seconds || item.duration_seconds <= 0) return false;
  return item.progress_seconds / item.duration_seconds >= threshold;
}
