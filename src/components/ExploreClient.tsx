"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PlayerModal } from "@/components/PlayerModal";
import type { Movie } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";

const TMDB_PAGES_PER_VIEW = 5;
const RESULTS_PER_BATCH = 20;

const genreNames: Record<string, string> = {
  "28": "Acțiune",
  "35": "Comedie",
  "18": "Dramă",
  "878": "Science Fiction",
  "27": "Horror",
  "53": "Thriller",
};

export function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [loadedBatches, setLoadedBatches] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const genre = searchParams.get("genre") || "";
  const explicitType = searchParams.get("type");
  const type = searchParams.has("top_rated")
    ? "top_rated"
    : searchParams.has("trending")
      ? "trending"
      : explicitType === "top_rated" ? "top_rated" : "trending";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const title = query
    ? `Rezultate pentru „${query}”`
    : genre
      ? genreNames[genre] || "Categorie"
      : type === "top_rated" ? "Cele mai apreciate" : "În tendințe";

  const requestBase = useMemo(() => {
    if (query.trim()) return `q=${encodeURIComponent(query.trim())}`;
    if (genre) return `genre=${genre}`;
    return `type=${type}`;
  }, [genre, query, type]);

  useEffect(() => {
    setLoadedBatches(1);
  }, [genre, page, query, type]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const firstTmdbPage = (page - 1) * TMDB_PAGES_PER_VIEW + 1;
        const requests = Array.from({ length: loadedBatches }, (_, index) =>
          fetch(`/api/movies?${requestBase}&page=${firstTmdbPage + index}`, { signal: controller.signal })
            .then(async (response) => {
              const data = (await response.json()) as { results?: Movie[]; error?: string };
              if (!response.ok) throw new Error(data.error || "Catalogul nu este disponibil.");
              return data.results || [];
            }),
        );
        const batches = await Promise.all(requests);
        const uniqueMovies = Array.from(
          new Map(batches.flat().map((movie) => [movie.id, movie])).values(),
        );
        setMovies(uniqueMovies.slice(0, 100));
        setHasMore((batches.at(-1)?.length || 0) >= RESULTS_PER_BATCH);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setError((reason as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadedBatches, page, query, requestBase]);

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `/explore?${params.toString()}`;
  };

  const canLoadMore = loadedBatches < TMDB_PAGES_PER_VIEW && hasMore;
  const reachedPageLimit = loadedBatches === TMDB_PAGES_PER_VIEW || !hasMore;

  return (
    <main className="explore-page">
      <Navbar query={query} onQueryChange={setQuery} />
      <section className="explore-header">
        <button className="back-button" type="button" onClick={() => router.back()}>← Înapoi</button>
        <p>EXPLOREAZĂ CATALOGUL</p>
        <h1>{title}</h1>
        <span>{loading ? "Se încarcă…" : `${movies.length} din maximum 100 · pagina ${page}`}</span>
      </section>

      {error && <div className="explore-error">{error}</div>}
      <section className="explore-grid" aria-busy={loading}>
        {movies.map((movie) => (
          <button className="explore-card" key={movie.id} onClick={() => setSelected(movie)}>
            {movie.poster_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`Poster ${movieTitle(movie)}`} />
            ) : <div className="poster-placeholder">{movieTitle(movie)}</div>}
            <span className="explore-card-info">
              <strong>{movieTitle(movie)}</strong>
              <small>{movieYear(movie)} · ★ {movie.vote_average?.toFixed(1)}</small>
            </span>
          </button>
        ))}
      </section>

      <div className="load-more-area">
        {canLoadMore && (
          <button className="load-more-button" type="button" disabled={loading} onClick={() => setLoadedBatches((count) => count + 1)}>
            {loading ? "Se încarcă…" : `Încarcă încă ${RESULTS_PER_BATCH}`}
          </button>
        )}
      </div>

      {reachedPageLimit && !query && (
        <nav className="pagination" aria-label="Paginare">
          {page > 1 ? <Link href={pageHref(page - 1)}>← 100 anterioare</Link> : <span />}
          {hasMore && <Link href={pageHref(page + 1)}>Următoarele 100 →</Link>}
        </nav>
      )}

      {selected && <PlayerModal movie={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
