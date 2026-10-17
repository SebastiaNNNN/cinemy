"use client";

import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import type { Movie, WatchHistory } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";

interface MovieRowProps {
  id?: string;
  title: string;
  movies: Movie[];
  onPlay: (movie: Movie, resumeAt?: number) => void;
  onSelect?: (movie: Movie) => void;
  onSelectProgress?: (movie: Movie, progress?: WatchHistory) => void;
  progress?: Map<string, WatchHistory>;
  exploreHref?: string;
}

export function MovieRow({ id, title, movies, onPlay, onSelect, onSelectProgress, progress, exploreHref }: MovieRowProps) {
  const { text } = useCatalogLanguage();
  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; scrollLeft: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  if (!movies.length) return null;

  const scroll = (direction: number) => {
    rowRef.current?.scrollBy({ left: direction * Math.min(window.innerWidth * 0.75, 900), behavior: "smooth" });
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      dragging: false,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !(event.buttons & 1)) return;
    const distance = event.clientX - drag.startX;
    if (!drag.dragging && Math.abs(distance) < 6) return;
    if (!drag.dragging) {
      drag.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add("is-dragging");
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.scrollLeft - distance;
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.dragging) {
      suppressClickRef.current = true;
      event.currentTarget.classList.remove("is-dragging");
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    dragRef.current = null;
  };

  const preventClickAfterDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <section className="movie-section" id={id}>
      <div className="section-heading">
        <h2>{title}</h2>
        {exploreHref && <Link className="explore-link" href={exploreHref}>{text.exploreAll} <b>›</b></Link>}
      </div>
      <div className="row-shell">
        <button className="row-arrow left" onClick={() => scroll(-1)} aria-label={text.scrollLeft(title)}>‹</button>
        <div
          className="movie-row"
          ref={rowRef}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={preventClickAfterDrag}
        >
          {movies.map((movie) => {
            const key = `${movie.media_type || "movie"}_${movie.id}`;
            const itemProgress = progress?.get(key);
            const percent = itemProgress?.duration_seconds
              ? Math.min(100, (itemProgress.progress_seconds / itemProgress.duration_seconds) * 100)
              : 0;
            return (
              <button className="movie-card" key={key} onClick={() => onSelect ? onSelect(movie) : onPlay(movie, itemProgress?.progress_seconds)}>
                {movie.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`${text.poster} ${movieTitle(movie)}`} loading="lazy" draggable={false} />
                ) : <div className="poster-placeholder">{movieTitle(movie)}</div>}
                {movie.vote_average > 0 && (
                  <span className="card-rating" aria-label={`Rating ${movie.vote_average.toFixed(1)}`}>
                    <span aria-hidden="true">★</span> {movie.vote_average.toFixed(1)}
                  </span>
                )}
                <span className="card-overlay">
                  <span className="card-play">▶</span>
                  <strong>{movieTitle(movie)}</strong>
                  {movie.season_number && movie.episode_number
                    ? <small>S{movie.season_number}:E{movie.episode_number}</small>
                    : movieYear(movie) && <small>{movieYear(movie)}</small>}
                </span>
                {percent > 0 && <span className="progress-track"><span style={{ width: `${percent}%` }} /></span>}
              </button>
            );
          })}
        </div>
        <button className="row-arrow right" onClick={() => scroll(1)} aria-label={text.scrollRight(title)}>›</button>
      </div>
    </section>
  );
}
