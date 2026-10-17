import type { Movie, TvSeason, WatchHistory } from "./types";

export function mediaKey(movie: Movie): string {
  return `${movie.media_type === "tv" ? "tv" : "movie"}_${movie.id}`;
}

export function recommendationSeeds(history: WatchHistory[], savedIds: string[], limit = 4): string[] {
  return [...new Set([...savedIds, ...history.map((item) => item.media_id)])]
    .filter((id) => /^(movie|tv)_\d+$/.test(id))
    .slice(0, limit);
}

export function mergeRecommendations(groups: Movie[][], excludedIds: Set<string>, limit = 20): Movie[] {
  const result: Movie[] = [];
  const seen = new Set(excludedIds);
  const maxLength = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < maxLength && result.length < limit; index++) {
    for (const group of groups) {
      const movie = group[index];
      if (!movie?.poster_path || seen.has(mediaKey(movie))) continue;
      seen.add(mediaKey(movie));
      result.push(movie);
      if (result.length >= limit) break;
    }
  }
  return result;
}

export function nextEpisodeFromHistory(item: WatchHistory, seasons: TvSeason[]) {
  if (!item.media_id.startsWith("tv_") || !item.season_number || !item.episode_number) return null;
  if (!item.duration_seconds || item.progress_seconds / item.duration_seconds < 0.85) return null;
  const playable = seasons.filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const current = playable.find((season) => season.season_number === item.season_number);
  if (!current) return null;
  if (item.episode_number < current.episode_count) {
    return { season: item.season_number, episode: item.episode_number + 1 };
  }
  const following = playable.find((season) => season.season_number > item.season_number!);
  return following ? { season: following.season_number, episode: 1 } : null;
}
