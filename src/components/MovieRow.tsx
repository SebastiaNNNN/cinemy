"use client";

import { useRef } from "react";
import type { Movie, WatchHistory } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";

interface MovieRowProps {
  id?: string;
  title: string;
  movies: Movie[];
  onPlay: (movie: Movie, resumeAt?: number) => void;
  progress?: Map<string, WatchHistory>;
}

export function MovieRow({ id, title, movies, onPlay, progress }: MovieRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!movies.length) return null;

  const scroll = (direction: number) => {
    rowRef.current?.scrollBy({ left: direction * Math.min(window.innerWidth * 0.75, 900), behavior: "smooth" });
  };

  return (
    <section className="movie-section" id={id}>
      <div className="section-heading">
        <h2>{title}</h2>
        <span>Explorează toate <b>›</b></span>
      </div>
      <div className="row-shell">
        <button className="row-arrow left" onClick={() => scroll(-1)} aria-label={`Derulează ${title} la stânga`}>‹</button>
        <div className="movie-row" ref={rowRef}>
          {movies.map((movie) => {
            const key = `${movie.media_type || "movie"}_${movie.id}`;
            const itemProgress = progress?.get(key);
            const percent = itemProgress?.duration_seconds
              ? Math.min(100, (itemProgress.progress_seconds / itemProgress.duration_seconds) * 100)
              : 0;
            return (
              <button className="movie-card" key={key} onClick={() => onPlay(movie, itemProgress?.progress_seconds)}>
                {movie.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`Poster ${movieTitle(movie)}`} loading="lazy" />
                ) : <div className="poster-placeholder">{movieTitle(movie)}</div>}
                <span className="card-overlay">
                  <span className="card-play">▶</span>
                  <strong>{movieTitle(movie)}</strong>
                  <small>{movieYear(movie)} · ★ {movie.vote_average?.toFixed(1)}</small>
                </span>
                {percent > 0 && <span className="progress-track"><span style={{ width: `${percent}%` }} /></span>}
              </button>
            );
          })}
        </div>
        <button className="row-arrow right" onClick={() => scroll(1)} aria-label={`Derulează ${title} la dreapta`}>›</button>
      </div>
    </section>
  );
}
