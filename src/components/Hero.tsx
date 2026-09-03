import type { Movie } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";

interface HeroProps {
  movie: Movie;
  onPlay: (movie: Movie) => void;
}

export function Hero({ movie, onPlay }: HeroProps) {
  const backdrop = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : undefined;

  return (
    <section className="hero" id="top" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
      <div className="hero-shade" />
      <div className="hero-content">
        <p className="eyebrow">#1 ÎN TRENDING SĂPTĂMÂNA ACEASTA</p>
        <h1>{movieTitle(movie)}</h1>
        <div className="hero-meta">
          <span className="match">Recomandat</span>
          <span>{movieYear(movie)}</span>
          <span className="rating">★ {movie.vote_average?.toFixed(1)}</span>
          <span className="quality">4K</span>
        </div>
        <p className="hero-description">{movie.overview || "Descoperă unul dintre cele mai urmărite titluri ale momentului."}</p>
        <div className="hero-actions">
          <button className="button button-primary" onClick={() => onPlay(movie)}>▶ Vizionează acum</button>
          <button className="button button-secondary" onClick={() => document.getElementById("trending")?.scrollIntoView()}>ⓘ Mai multe</button>
        </div>
      </div>
    </section>
  );
}
