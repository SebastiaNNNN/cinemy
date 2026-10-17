"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { TvShowDetailsModal } from "@/components/TvShowDetailsModal";
import { TitleDetailsModal } from "@/components/TitleDetailsModal";
import type { MediaType, Movie, WatchHistory } from "@/lib/types";
import { movieTitle, movieYear } from "@/lib/types";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { rememberWatchReturn, watchHref } from "@/lib/watch-links";
import { loadWatchHistory } from "@/lib/progress-storage";
import { useAuth } from "@/components/AuthProvider";
import { useTmdbGenres } from "@/lib/tmdb-genres";

interface ExploreClientProps {
  mediaType?: MediaType;
}

export function ExploreClient({ mediaType: fixedMediaType }: ExploreClientProps = {}) {
  const { language, text } = useCatalogLanguage();
  const { genres } = useTmdbGenres(language);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadedBatches, setLoadedBatches] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTv, setSelectedTv] = useState<Movie | null>(null);
  const [detailsMovie, setDetailsMovie] = useState<Movie | null>(null);
  const [history, setHistory] = useState<WatchHistory[]>([]);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const genre = searchParams.get("genre") || "";
  const requestedMediaType = searchParams.get("media_type");
  const activeMediaType = fixedMediaType ?? (requestedMediaType === "tv" ? "tv" : requestedMediaType === "movie" ? "movie" : undefined);
  const explicitType = searchParams.get("type");
  const type = fixedMediaType ? "popular" : searchParams.has("top_rated")
    ? "top_rated"
    : searchParams.has("trending")
      ? "trending"
      : explicitType === "top_rated" ? "top_rated" : explicitType === "trending_tv" ? "trending_tv" : "trending";

  const title = query
    ? text.searchResults(query)
    : fixedMediaType === "movie"
      ? text.movies
      : fixedMediaType === "tv"
        ? text.tvSeries
    : genre
      ? genres[activeMediaType ?? "movie"].find((item) => String(item.id) === genre)?.name || text.genres[genre] || text.category
      : type === "top_rated" ? text.topRated : type === "trending_tv" ? text.trendingTv : text.trending;

  const requestBase = useMemo(() => {
    const mediaFilter = activeMediaType ? `&media_type=${activeMediaType}` : "";
    if (query.trim()) return `q=${encodeURIComponent(query.trim())}${mediaFilter}`;
    if (genre) return `genre=${genre}${mediaFilter}`;
    return `type=${type}${mediaFilter}`;
  }, [activeMediaType, genre, query, type]);

  useEffect(() => {
    let active = true;
    setHistory([]);
    if (authLoading || !user) return;
    void loadWatchHistory()
      .then((items) => { if (active) setHistory(items); })
      .catch(() => { if (active) setHistory([]); });
    return () => { active = false; };
  }, [authLoading, user?.id]);

  useEffect(() => {
    setMovies([]);
    setLoadedBatches(1);
    setHasMore(true);
  }, [fixedMediaType, genre, language, query, type]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/movies?${requestBase}&page=${loadedBatches}&language=${encodeURIComponent(language)}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: Movie[]; page?: number; total_pages?: number; error?: string };
        if (!response.ok) throw new Error(data.error || text.catalogUnavailable);
        const incoming = data.results || [];
        setMovies((current) => Array.from(
          new Map(
            [...(loadedBatches === 1 ? [] : current), ...incoming]
              .map((movie) => [`${movie.media_type || "movie"}_${movie.id}`, movie]),
          ).values(),
        ));
        const currentPage = data.page || loadedBatches;
        setHasMore(currentPage < (data.total_pages || currentPage));
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
  }, [language, loadedBatches, query, requestBase, text.catalogUnavailable]);

  const canLoadMore = hasMore;

  const openMovie = (movie: Movie) => {
    if (movie.media_type === "tv" || Boolean(movie.first_air_date) || Boolean(movie.name)) {
      setSelectedTv(movie);
      return;
    }
    setDetailsMovie(movie);
  };

  const openTvEpisode = (show: Movie, season: number, episode: number) => {
    const href = watchHref({ ...show, media_type: "tv" }, season, episode);
    rememberWatchReturn(href);
    setSelectedTv(null);
    router.push(href);
  };

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !canLoadMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLoadedBatches((count) => count + 1);
        }
      },
      { rootMargin: "500px 0px", threshold: 0.01 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loading]);

  return (
    <main className="explore-page">
      <Navbar query={query} onQueryChange={setQuery} searchLabel={fixedMediaType === "tv" ? text.searchSeries : text.searchMovies} />
      <section className="explore-header">
        <button className="back-button" type="button" onClick={() => router.back()}>← {text.back}</button>
        <p>{fixedMediaType === "movie" ? text.browseMovies : fixedMediaType === "tv" ? text.browseSeries : text.exploreCatalog}</p>
        <h1>{title}</h1>
        <span>{loading ? text.loading : text.resultCount(movies.length, loadedBatches)}</span>
      </section>

      {error && <div className="explore-error">{error}</div>}
      <section className="explore-grid" aria-busy={loading}>
        {movies.map((movie) => (
          <button className="explore-card" key={`${movie.media_type || "movie"}_${movie.id}`} onClick={() => openMovie(movie)}>
            {movie.poster_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`${text.poster} ${movieTitle(movie)}`} />
            ) : <div className="poster-placeholder">{movieTitle(movie)}</div>}
            <span className="explore-card-info">
              <strong>{movieTitle(movie)}</strong>
              <small>{movieYear(movie)} · ★ {movie.vote_average?.toFixed(1)}</small>
            </span>
          </button>
        ))}
      </section>

      <div ref={loadMoreSentinelRef} className="infinite-scroll-sentinel" aria-live="polite">
        {canLoadMore && <span>{loading ? text.loadingMovies : text.scrollForMore}</span>}
      </div>

      {selectedTv && (
        <TvShowDetailsModal
          show={selectedTv}
          resumeSeason={history.find((item) => item.media_id === `tv_${selectedTv.id}`)?.season_number}
          resumeEpisode={history.find((item) => item.media_id === `tv_${selectedTv.id}`)?.episode_number}
          onClose={() => setSelectedTv(null)}
          onPlay={openTvEpisode}
        />
      )}
      {detailsMovie && (
        <TitleDetailsModal
          movie={detailsMovie}
          hasProgress={history.some((item) => item.media_id === `movie_${detailsMovie.id}`)}
          onClose={() => setDetailsMovie(null)}
          onPlay={(movie) => {
            const href = watchHref(movie, 1, 1);
            rememberWatchReturn(href);
            setDetailsMovie(null);
            router.push(href);
          }}
        />
      )}

    </main>
  );
}

export function ExploreLoading() {
  const { text } = useCatalogLanguage();
  return <div className="explore-loading">{text.preparingCatalog}</div>;
}
