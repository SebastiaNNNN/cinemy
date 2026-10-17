"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { TitleDetailsModal } from "@/components/TitleDetailsModal";
import { TvShowDetailsModal } from "@/components/TvShowDetailsModal";
import { useMyList } from "@/components/MyListProvider";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { loadWatchHistory } from "@/lib/progress-storage";
import { movieTitle, movieYear, type Movie, type WatchHistory } from "@/lib/types";
import { rememberWatchReturn, watchHref } from "@/lib/watch-links";

export default function MyListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { language, text } = useCatalogLanguage();
  const { items, loading, error, refresh, toggle } = useMyList();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<WatchHistory[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);

  useEffect(() => {
    let active = true;
    setHistory([]);
    if (user) void loadWatchHistory().then((data) => { if (active) setHistory(data); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!selected || selected.media_type === "tv") return;
    const controller = new AbortController();
    const id = selected.id;
    void fetch(`/api/movies?id=${id}&media_type=movie&language=${encodeURIComponent(language)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<Movie> : null)
      .then((details) => {
        if (details && !controller.signal.aborted) {
          setSelected((current) => current?.id === id ? { ...details, media_type: "movie" } : current);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, [language, selected?.id, selected?.media_type]);

  const movies = useMemo(() => items.map((item): Movie => ({
    id: Number(item.media_id.split("_")[1]),
    media_type: item.media_id.startsWith("tv_") ? "tv" : "movie",
    title: item.title,
    name: item.media_id.startsWith("tv_") ? item.title : undefined,
    overview: "",
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  })).filter((movie) => movieTitle(movie).toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  const startWatching = (movie: Movie, season = 1, episode = 1) => {
    const href = watchHref(movie, season, episode);
    rememberWatchReturn(href);
    setSelected(null);
    router.push(href);
  };

  return <main className="explore-page my-list-page">
    <Navbar query={query} onQueryChange={setQuery} />
    <section className="explore-header">
      <p>CINEMY</p>
      <h1>{text.myList}</h1>
      {user && <span>{items.length} {text.myList}</span>}
    </section>

    {authLoading || loading ? <p className="my-list-message">{text.loading}</p>
      : !user ? <div className="my-list-message"><p>{text.myListSignIn}</p><Link className="button button-primary" href="/account">{text.personalProfile} →</Link></div>
      : error ? <div className="explore-error" role="alert">{error} <button type="button" onClick={() => void refresh()}>{language === "ro-RO" ? "Reîncearcă" : "Retry"}</button></div>
      : movies.length === 0 ? <p className="my-list-message">{query ? text.noResults : text.myListEmpty}</p>
      : <section className="explore-grid">
        {movies.map((movie) => <div className="my-list-card" key={`${movie.media_type}_${movie.id}`}>
          <button className="explore-card" type="button" onClick={() => setSelected(movie)}>
            {movie.poster_path
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`${text.poster} ${movieTitle(movie)}`} loading="lazy" />
              : <span className="poster-placeholder">{movieTitle(movie)}</span>}
            <span className="explore-card-info"><strong>{movieTitle(movie)}</strong><small>{movieYear(movie)} · ★ {movie.vote_average?.toFixed(1)}</small></span>
          </button>
          <button className="my-list-remove" type="button" aria-label={`${text.removeFromList}: ${movieTitle(movie)}`} title={text.removeFromList} onClick={() => void toggle(movie).catch(() => {})}>×</button>
        </div>)}
      </section>}

    {selected?.media_type === "tv" && <TvShowDetailsModal
      show={selected}
      resumeSeason={history.find((item) => item.media_id === `tv_${selected.id}`)?.season_number}
      resumeEpisode={history.find((item) => item.media_id === `tv_${selected.id}`)?.episode_number}
      onClose={() => setSelected(null)}
      onPlay={(show, season, episode) => startWatching(show, season, episode)}
    />}
    {selected?.media_type !== "tv" && selected && <TitleDetailsModal
      movie={selected}
      hasProgress={history.some((item) => item.media_id === `movie_${selected.id}`)}
      onClose={() => setSelected(null)}
      onPlay={startWatching}
    />}
  </main>;
}
