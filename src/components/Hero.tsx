import type { Movie } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";

interface HeroProps {
  movie: Movie;
  onPlay: (movie: Movie) => void;
  onMoreInfo: (movie: Movie) => void;
}

export function Hero({ movie, onPlay, onMoreInfo }: HeroProps) {
  const { text } = useCatalogLanguage();
  const backdrop = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : undefined;

  return (
    <section className="hero" id="top" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
      <div className="hero-shade" />
      <div className="hero-content">
        <p className="eyebrow">{text.trendingEyebrow}</p>
        <h1>{movieTitle(movie)}</h1>
        <div className="hero-meta">
          <span className="match">{text.recommended}</span>
          <span>{movieYear(movie)}</span>
          <span className="rating">★ {movie.vote_average?.toFixed(1)}</span>
          <span className="quality">4K</span>
        </div>
        <p className="hero-description">{movie.overview || text.heroDescription}</p>
        <div className="hero-actions">
          <button className="button button-primary" onClick={() => onPlay(movie)}>▶ {text.watchNow}</button>
          <button className="button button-secondary" onClick={() => onMoreInfo(movie)}>ⓘ {text.moreInfo}</button>
        </div>
      </div>
    </section>
  );
}
