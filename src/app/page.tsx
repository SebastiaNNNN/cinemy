"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hero } from "@/components/Hero";
import { MovieRow } from "@/components/MovieRow";
import { Navbar } from "@/components/Navbar";
import { PlayerModal } from "@/components/PlayerModal";
import type { Movie, WatchHistory } from "@/lib/types";

const FALLBACK_HERO: Movie = {
  id: 550,
  title: "Biblioteca ta. Un singur ecran.",
  overview: "Conectează TMDB pentru catalogul în limba română și providerul tău video pentru redare online.",
  poster_path: null,
  backdrop_path: null,
  vote_average: 0,
  release_date: "2026",
};

const categories = [
  { id: "action", title: "Acțiune", genre: 28 },
  { id: "comedy", title: "Comedie", genre: 35 },
  { id: "drama", title: "Dramă", genre: 18 },
];

async function loadMovies(params: string) {
  const response = await fetch(`/api/movies?${params}`);
  const data = (await response.json()) as { error?: string; results?: Movie[] };
  if (!response.ok) throw new Error(data.error || "Catalogul nu este disponibil.");
  return (data.results ?? []) as Movie[];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<Movie[]>([]);
  const [topRated, setTopRated] = useState<Movie[]>([]);
  const [categoryRows, setCategoryRows] = useState<Record<string, Movie[]>>({});
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [history, setHistory] = useState<WatchHistory[]>([]);
  const [selected, setSelected] = useState<{ movie: Movie; resumeAt?: number } | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/progress", { cache: "no-store" });
      if (response.ok) setHistory(await response.json());
    } catch {
      // Aplicația poate funcționa fără sincronizare până este configurat Supabase.
    }
  }, []);

  useEffect(() => {
    Promise.all([
      loadMovies("type=trending"),
      loadMovies("type=top_rated"),
      ...categories.map((category) => loadMovies(`genre=${category.genre}`)),
    ])
      .then(([trend, top, ...rows]) => {
        setTrending(trend);
        setTopRated(top);
        setCategoryRows(Object.fromEntries(categories.map((category, index) => [category.id, rows[index]])));
      })
      .catch((error: Error) => setCatalogError(error.message))
      .finally(() => setLoading(false));
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/movies?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: Movie[] };
        if (response.ok) setSearchResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSearchResults([]);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const progressMap = useMemo(() => new Map(history.map((item) => [item.media_id, item])), [history]);
  const continueMovies = useMemo<Movie[]>(() => history.map((item) => ({
    id: Number(item.media_id.replace(/^.*?_/, "")),
    media_type: item.media_id.startsWith("tv_") ? "tv" : "movie",
    title: item.title,
    overview: "Continuă de unde ai rămas.",
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: 0,
  })), [history]);

  const openPlayer = (movie: Movie, resumeAt?: number) => setSelected({ movie, resumeAt });
  const hero = trending[0] ?? FALLBACK_HERO;

  return (
    <main>
      <Navbar query={query} onQueryChange={setQuery} />
      {query.trim() ? (
        <section className="search-results">
          <div className="search-title"><p>REZULTATE PENTRU</p><h1>„{query}”</h1></div>
          {!searchResults.length && <div className="empty-state">Nu am găsit încă rezultate.</div>}
          <div className="search-grid">
            {searchResults.map((movie) => (
              <button key={movie.id} className="search-card" onClick={() => openPlayer(movie)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title} />
                <span>{movie.title}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <Hero movie={hero} onPlay={openPlayer} />
          <div className="content-rows">
            {catalogError && (
              <div className="configuration-banner">
                <strong>Catalogul așteaptă cheia TMDB.</strong>
                <span>{catalogError}</span>
              </div>
            )}
            {loading && <div className="loading-row">Se încarcă selecția pentru tine…</div>}
            <MovieRow title="Continuă vizionarea" movies={continueMovies} onPlay={openPlayer} progress={progressMap} />
            <MovieRow id="trending" title="În tendințe acum" movies={trending} onPlay={openPlayer} progress={progressMap} />
            <MovieRow id="top-rated" title="Cele mai apreciate" movies={topRated} onPlay={openPlayer} progress={progressMap} />
            <div id="categories">
              {categories.map((category) => (
                <MovieRow key={category.id} id={category.id} title={category.title} movies={categoryRows[category.id] ?? []} onPlay={openPlayer} progress={progressMap} />
              ))}
            </div>
          </div>
        </>
      )}
      <footer>
        <span className="brand">CINEMY</span>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </footer>
      {selected && (
        <PlayerModal
          movie={selected.movie}
          resumeAt={selected.resumeAt}
          onClose={() => setSelected(null)}
          onProgressSaved={refreshHistory}
        />
      )}
    </main>
  );
}
