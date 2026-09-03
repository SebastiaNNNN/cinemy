export type MediaType = "movie" | "tv";

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
}

export interface WatchHistory {
  id?: number;
  media_id: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  progress_seconds: number;
  duration_seconds: number;
  updated_at?: string;
}

export function movieTitle(movie: Movie) {
  return movie.title || movie.name || "Titlu necunoscut";
}

export function movieYear(movie: Movie) {
  return (movie.release_date || movie.first_air_date || "").slice(0, 4);
}
