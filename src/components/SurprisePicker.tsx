"use client";

import { useRef, useState } from "react";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { mediaKey } from "@/lib/discovery";
import type { MediaType, Movie } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";
import { useTmdbGenres } from "@/lib/tmdb-genres";

export function SurprisePicker({ excludedIds, onSelect }: { excludedIds: Set<string>; onSelect: (movie: Movie) => void }) {
  const { language, text } = useCatalogLanguage();
  const { genres, error: genreError } = useTmdbGenres(language);
  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [genre, setGenre] = useState("");
  const [suggestion, setSuggestion] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const previousPicks = useRef(new Set<string>());

  const surpriseMe = async () => {
    setLoading(true);
    setError("");
    setSuggestion(null);
    try {
      let availablePages = 1;
      for (let attempt = 0; attempt < 3; attempt++) {
        const page = attempt === 0 ? 1 : Math.floor(Math.random() * Math.min(availablePages, 30)) + 1;
        const params = new URLSearchParams({ type: "discover", media_type: mediaType, language, page: String(page) });
        if (genre) params.set("genre", genre);
        const response = await fetch(`/api/movies?${params}`);
        const data = await response.json() as { results?: Movie[]; total_pages?: number; error?: string };
        if (!response.ok) throw new Error(data.error || text.catalogUnavailable);
        availablePages = Math.max(1, data.total_pages || 1);
        const candidates = (data.results ?? []).filter((movie) =>
          movie.poster_path && !excludedIds.has(mediaKey(movie)) && !previousPicks.current.has(mediaKey(movie)),
        );
        if (candidates.length) {
          const picked = candidates[Math.floor(Math.random() * candidates.length)];
          previousPicks.current.add(mediaKey(picked));
          setSuggestion(picked);
          return;
        }
      }
      setError(text.surpriseEmpty);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.catalogUnavailable);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surprise-section" aria-label={text.surpriseMe}>
      <div>
        <span className="surprise-kicker">CINEMY DISCOVERY</span>
        <h2>{text.surpriseMe}</h2>
        <p>{text.surpriseDescription}</p>
      </div>
      <div className="surprise-controls">
        <label><span>{text.surpriseFormat}</span>
          <select value={mediaType} onChange={(event) => { setMediaType(event.target.value as MediaType); setGenre(""); setSuggestion(null); }}>
            <option value="movie">{text.movies}</option><option value="tv">{text.tvSeries}</option>
          </select>
        </label>
        <label><span>{text.category}</span>
          <select value={genre} onChange={(event) => { setGenre(event.target.value); setSuggestion(null); }}>
            <option value="">{text.allGenres}</option>
            {genres[mediaType].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button className="button button-primary" type="button" disabled={loading} onClick={() => void surpriseMe()}>
          {loading ? text.loading : `✦ ${suggestion ? text.surpriseAgain : text.surprisePick}`}
        </button>
      </div>
      {error && <p className="surprise-error" role="status">{error}</p>}
      {genreError && <p className="surprise-error" role="status">{genreError}</p>}
      {suggestion && (
        <button className="surprise-result" type="button" onClick={() => onSelect(suggestion)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {suggestion.poster_path && <img src={`https://image.tmdb.org/t/p/w500${suggestion.poster_path}`} alt="" />}
          <span><small>{text.surpriseYourPick}</small><strong>{movieTitle(suggestion)}</strong><small>{movieYear(suggestion)} · ★ {suggestion.vote_average.toFixed(1)}</small><em>{text.moreInfo} →</em></span>
        </button>
      )}
    </section>
  );
}
