"use client";

import { useEffect, useMemo, useState } from "react";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import type { Movie, TvSeason, TvShowDetails } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";
import { MyListButton } from "@/components/MyListButton";
import { useModalExit } from "@/lib/modal-motion";

interface TvShowDetailsModalProps {
  show: Movie;
  onClose: () => void;
  onPlay: (show: Movie, season: number, episode: number) => void;
  resumeSeason?: number;
  resumeEpisode?: number;
}

export function TvShowDetailsModal({ show, onClose, onPlay, resumeSeason, resumeEpisode }: TvShowDetailsModalProps) {
  const { language, text } = useCatalogLanguage();
  const { isClosing, requestClose } = useModalExit(onClose);
  const [details, setDetails] = useState<TvShowDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/movies?id=${show.id}&media_type=tv&language=${encodeURIComponent(language)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as TvShowDetails & { error?: string };
        if (!response.ok) throw new Error(data.error || text.detailsUnavailable);
        return { ...data, media_type: "tv" as const };
      })
      .then((loaded) => {
        setDetails(loaded);
        const firstSeason = loaded.seasons?.find((season) => season.season_number > 0 && season.episode_count > 0)
          || loaded.seasons?.find((season) => season.episode_count > 0);
        if (resumeSeason && loaded.seasons?.some((season) => season.season_number === resumeSeason)) {
          setSelectedSeason(resumeSeason);
          setSelectedEpisode(resumeEpisode || 1);
        } else if (firstSeason) setSelectedSeason(firstSeason.season_number);
      })
      .catch((reason: Error) => reason.name !== "AbortError" && setError(reason.message));
    return () => controller.abort();
  }, [language, resumeEpisode, resumeSeason, show.id, text.detailsUnavailable]);

  const seasons = useMemo(
    () => (details?.seasons || []).filter((season) => season.episode_count > 0 && season.season_number > 0),
    [details],
  );
  const currentSeason = seasons.find((season) => season.season_number === selectedSeason) as TvSeason | undefined;
  const episodeCount = currentSeason?.episode_count || 0;
  const playableShow: Movie = details || { ...show, media_type: "tv" };
  const backdropPath = details?.backdrop_path || show.backdrop_path;
  const backdrop = backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : undefined;

  const changeSeason = (seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(1);
  };

  return (
    <div className={`details-backdrop${isClosing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-label={text.selectEpisode} onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <article className="details-modal tv-details-modal">
        <div className="details-visual" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
          <button className="details-close" type="button" onClick={requestClose} aria-label={text.close}>×</button>
          <div className="details-visual-shade" />
          <div className="details-heading">
            <span className="details-kicker">TV SERIES</span>
            <h2>{movieTitle(playableShow)}</h2>
            <div className="details-meta"><span>{movieYear(playableShow)}</span><span>★ {playableShow.vote_average?.toFixed(1)}</span></div>
            <div className="details-actions"><MyListButton movie={playableShow} /></div>
          </div>
        </div>
        <div className="details-copy tv-details-copy">
          {!details && !error && <p className="details-status">{text.loadingDetails}</p>}
          {error && <p className="details-status details-error">{error}</p>}
          {details && (
            <>
              <p>{details.overview || text.heroDescription}</p>
              {seasons.length ? (
                <div className="episode-picker">
                  <label>
                    <span>{text.season}</span>
                    <select value={selectedSeason} onChange={(event) => changeSeason(Number(event.target.value))}>
                      {seasons.map((season) => <option key={season.id} value={season.season_number}>{season.name || `${text.season} ${season.season_number}`}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>{text.episode}</span>
                    <select value={selectedEpisode} onChange={(event) => setSelectedEpisode(Number(event.target.value))}>
                      {Array.from({ length: episodeCount }, (_, index) => index + 1).map((episode) => <option key={episode} value={episode}>{text.episode} {episode}</option>)}
                    </select>
                  </label>
                  <button className="button button-primary episode-play-button" type="button" onClick={() => onPlay(playableShow, selectedSeason, selectedEpisode)}>
                    ▶ {resumeSeason === selectedSeason && resumeEpisode === selectedEpisode ? text.resumePlayback : text.playEpisode} S{selectedSeason}:E{selectedEpisode}
                  </button>
                </div>
              ) : <p className="details-status">{text.noEpisodes}</p>}
            </>
          )}
        </div>
      </article>
    </div>
  );
}
