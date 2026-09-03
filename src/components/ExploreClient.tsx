"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PlayerModal } from "@/components/PlayerModal";
import type { Movie } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";

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

  const requestParams = useMemo(() => {
    if (query.trim()) return `q=${encodeURIComponent(query.trim())}&page=${page}`;
    if (genre) return `genre=${genre}&page=${page}`;
    return `type=${type}&page=${page}`;
  }, [genre, page, query, type]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/movies?${requestParams}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: Movie[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Catalogul nu este disponibil.");
        setMovies(data.results || []);
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
  }, [query, requestParams]);

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `/explore?${params.toString()}`;
  };

  return (
    <main className="explore-page">
      <Navbar query={query} onQueryChange={setQuery} />
      <section className="explore-header">
        <button className="back-button" type="button" onClick={() => router.back()}>← Înapoi</button>
        <p>EXPLOREAZĂ CATALOGUL</p>
        <h1>{title}</h1>
        <span>{loading ? "Se încarcă…" : `${movies.length} filme · pagina ${page}`}</span>
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

      {!query && (
        <nav className="pagination" aria-label="Paginare">
          {page > 1 ? <Link href={pageHref(page - 1)}>← Pagina anterioară</Link> : <span />}
          <Link href={pageHref(page + 1)}>Pagina următoare →</Link>
        </nav>
      )}

      {selected && <PlayerModal movie={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
