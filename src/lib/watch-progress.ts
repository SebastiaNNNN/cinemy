import type { MediaType, WatchHistory } from "./types";

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
      && Boolean(saved?.season_number && saved?.episode_number),
  };
}
