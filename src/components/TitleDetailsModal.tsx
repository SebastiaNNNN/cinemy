"use client";

import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import type { Movie } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";
import { MyListButton } from "@/components/MyListButton";
import { useModalExit } from "@/lib/modal-motion";

interface TitleDetailsModalProps {
  movie: Movie;
  onClose: () => void;
  onPlay: (movie: Movie) => void;
  hasProgress?: boolean;
}

export function TitleDetailsModal({ movie, onClose, onPlay, hasProgress = false }: TitleDetailsModalProps) {
  const { text } = useCatalogLanguage();
  const { isClosing, requestClose } = useModalExit(onClose);

  const backdrop = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : undefined;

  return (
    <div className={`details-backdrop${isClosing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-label={text.titleDetails} onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <article className="details-modal">
        <div className="details-visual" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
          <button className="details-close" type="button" onClick={requestClose} aria-label={text.close}>×</button>
          <div className="details-visual-shade" />
          <div className="details-heading">
            <h2>{movieTitle(movie)}</h2>
            <div className="details-meta">
              <span>{movieYear(movie)}</span>
              <span>★ {movie.vote_average?.toFixed(1)}</span>
            </div>
            <div className="details-actions">
              <button className="button button-primary" type="button" onClick={() => onPlay(movie)}>▶ {hasProgress ? text.resumePlayback : text.watchNow}</button>
              <MyListButton movie={{ ...movie, media_type: "movie" }} />
            </div>
          </div>
        </div>
        <div className="details-copy">
          <p>{movie.overview || text.heroDescription}</p>
        </div>
      </article>
    </div>
  );
}
