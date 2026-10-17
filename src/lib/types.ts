export type MediaType = "movie" | "tv";

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  url: string;
  release?: string;
}

export interface StreamSource {
  id: number;
  url: string;
  sourceKey?: string;
  name?: string;
  title?: string;
  quality?: string;
  seeders?: number;
  hasAudio?: boolean;
  audioStatus?: "detected" | "unknown";
  browserCompatible?: boolean;
  headers?: Record<string, string>;
}

export interface Movie {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  external_ids?: { imdb_id?: string | null };
  runtime?: number | null;
  episode_run_time?: number[];
  season_number?: number;
  episode_number?: number;
}

export interface TvSeason {
  id: number;
  name: string;
  overview?: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date?: string;
}

export interface TvShowDetails extends Movie {
  media_type: "tv";
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: TvSeason[];
}

export interface WatchHistory {
  id?: number;
  media_id: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  progress_seconds: number;
  duration_seconds: number;
  season_number?: number;
  episode_number?: number;
  updated_at?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

export interface MyListItem {
  id?: number;
  media_id: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  added_at?: string;
}

export function movieTitle(movie: Movie) {
  return movie.title || movie.name || "Unknown title";
}

export function movieYear(movie: Movie) {
  return (movie.release_date || movie.first_air_date || "").slice(0, 4);
}
