"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useMyList } from "@/components/MyListProvider";
import { Hero } from "@/components/Hero";
import { MovieRow } from "@/components/MovieRow";
import { Navbar } from "@/components/Navbar";
import { TitleDetailsModal } from "@/components/TitleDetailsModal";
import { TvShowDetailsModal } from "@/components/TvShowDetailsModal";
import { SurprisePicker } from "@/components/SurprisePicker";
import { mergeRecommendations, nextEpisodeFromHistory, recommendationSeeds } from "@/lib/discovery";
import type { Movie, TvShowDetails, WatchHistory } from "@/lib/types";
import { movieTitle } from "@/lib/types";
import { loadWatchHistory } from "@/lib/progress-storage";
import { isWatchComplete } from "@/lib/watch-progress";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { rememberWatchReturn, watchHref } from "@/lib/watch-links";

const categories = [
  { id: "action", genre: 28 },
  { id: "comedy", genre: 35 },
  { id: "drama", genre: 18 },
];

async function loadMovies(params: string, language: string, signal?: AbortSignal) {
  const response = await fetch(`/api/movies?${params}&language=${encodeURIComponent(language)}`, { signal });
  const data = (await response.json()) as { error?: string; results?: Movie[] };
  if (!response.ok) throw new Error(data.error || "Catalogul nu este disponibil.");
  return (data.results ?? []) as Movie[];
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { items: savedItems } = useMyList();
  const { language, text } = useCatalogLanguage();
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<Movie[]>([]);
  const [trendingTv, setTrendingTv] = useState<Movie[]>([]);
  const [topRated, setTopRated] = useState<Movie[]>([]);
  const [forYou, setForYou] = useState<Movie[]>([]);
  const [nextEpisodes, setNextEpisodes] = useState<Movie[]>([]);
  const [categoryRows, setCategoryRows] = useState<Record<string, Movie[]>>({});
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [history, setHistory] = useState<WatchHistory[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTv, setSelectedTv] = useState<Movie | null>(null);
  const [detailsMovie, setDetailsMovie] = useState<Movie | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setCatalogError("");
    Promise.all([
      loadMovies("type=trending", language, controller.signal),
      loadMovies("type=trending_tv", language, controller.signal),
      loadMovies("type=top_rated", language, controller.signal),
      ...categories.map((category) => loadMovies(`genre=${category.genre}`, language, controller.signal)),
    ])
      .then(([trend, television, top, ...rows]) => {
        setTrending(trend);
        setTrendingTv(television);
        setTopRated(top);
        setCategoryRows(Object.fromEntries(categories.map((category, index) => [category.id, rows[index]])));
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setCatalogError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [language]);

  useEffect(() => {
    let active = true;
    setHistory([]);
    setHistoryError("");
    if (authLoading || !user) return;
    void loadWatchHistory()
      .then((items) => { if (active) setHistory(items); })
      .catch((reason: Error) => { if (active) setHistoryError(reason.message); });
    return () => { active = false; };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/movies?q=${encodeURIComponent(query.trim())}&language=${encodeURIComponent(language)}`, { signal: controller.signal });
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
  }, [language, query]);

  useEffect(() => {
    if (!user || !history.length) return;
    const controller = new AbortController();
    Promise.all(history.map(async (item) => {
      const itemMediaType = item.media_id.startsWith("tv_") ? "tv" : "movie";
      const mediaId = item.media_id.replace(/^.*?_/, "");
      try {
        const response = await fetch(`/api/movies?id=${mediaId}&media_type=${itemMediaType}&language=${encodeURIComponent(language)}`, { signal: controller.signal });
        if (!response.ok) return item;
        const movie = (await response.json()) as Movie;
        return {
          ...item,
          title: movieTitle(movie),
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          vote_average: movie.vote_average,
          release_date: movie.release_date,
          first_air_date: movie.first_air_date,
        };
      } catch {
        return item;
      }
    })).then((localizedHistory) => {
      if (!controller.signal.aborted) setHistory(localizedHistory);
    });
    return () => controller.abort();
  }, [history.length, language, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setForYou([]);
    if (!user) return;
    const savedIds = savedItems.map((item) => item.media_id);
    const seeds = recommendationSeeds(history, savedIds);
    if (!seeds.length) return;
    const excluded = new Set([...savedIds, ...history.map((item) => item.media_id)]);
    void Promise.all(seeds.map(async (seed) => {
      const params = new URLSearchParams({ type: "recommendations", seed, language });
      const response = await fetch(`/api/movies?${params}`, { signal: controller.signal });
      if (!response.ok) return [] as Movie[];
      const data = await response.json() as { results?: Movie[] };
      return data.results ?? [];
    })).then((groups) => {
      if (!controller.signal.aborted) setForYou(mergeRecommendations(groups, excluded));
    }).catch(() => {});
    return () => controller.abort();
  }, [history, language, savedItems, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setNextEpisodes([]);
    if (!user) return;
    const nearFinished = history.filter((item) => item.media_id.startsWith("tv_")
      && item.duration_seconds > 0 && item.progress_seconds / item.duration_seconds >= 0.85).slice(0, 8);
    if (!nearFinished.length) return;
    void Promise.all(nearFinished.map(async (item): Promise<Movie | null> => {
      try {
        const id = item.media_id.slice(3);
        const response = await fetch(`/api/movies?id=${id}&media_type=tv&language=${encodeURIComponent(language)}`, { signal: controller.signal });
        if (!response.ok) return null;
        const details = await response.json() as TvShowDetails;
        const next = nextEpisodeFromHistory(item, details.seasons ?? []);
        return next ? { ...details, media_type: "tv" as const, season_number: next.season, episode_number: next.episode } : null;
      } catch { return null; }
    })).then((items) => {
      if (!controller.signal.aborted) setNextEpisodes(items.filter((item): item is Movie => item !== null));
    });
    return () => controller.abort();
  }, [history, language, user?.id]);

  const progressMap = useMemo(() => new Map(history.map((item) => [item.media_id, item])), [history]);
  const excludedIds = useMemo(() => new Set([...history.map((item) => item.media_id), ...savedItems.map((item) => item.media_id)]), [history, savedItems]);
  const continueMovies = useMemo<Movie[]>(() => history
    .filter((item) => !isWatchComplete(item))
    .map((item) => ({
    id: Number(item.media_id.replace(/^.*?_/, "")),
    media_type: item.media_id.startsWith("tv_") ? "tv" : "movie",
    title: item.title,
    overview: text.continueDescription,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average ?? 0,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    season_number: item.season_number,
    episode_number: item.episode_number,
  })), [history, text.continueDescription]);
  const myListMovies = useMemo<Movie[]>(() => savedItems.map((item) => ({
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
  })), [savedItems]);

  const openPlayer = (movie: Movie) => {
    const href = watchHref(movie, movie.season_number, movie.episode_number);
    rememberWatchReturn(href);
    router.push(href);
  };
  const openTitle = (movie: Movie) => {
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
  const hero = trending[0] ?? {
    id: 550,
    title: text.fallbackTitle,
    overview: text.fallbackOverview,
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    release_date: "2026",
  };

  return (
    <main>
      <Navbar query={query} onQueryChange={setQuery} />
      {query.trim() ? (
        <section className="search-results">
          <div className="search-title"><p>{text.resultsFor}</p><h1>“{query}”</h1></div>
          {!searchResults.length && <div className="empty-state">{text.noResults}</div>}
          <div className="search-grid">
            {searchResults.map((movie) => (
              <button key={`${movie.media_type || "movie"}_${movie.id}`} className="search-card" onClick={() => openTitle(movie)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={`${text.poster} ${movieTitle(movie)}`} />
                <span>{movieTitle(movie)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <Hero movie={hero} onPlay={openPlayer} onMoreInfo={setDetailsMovie} />
          <div className="content-rows">
            {catalogError && (
              <div className="configuration-banner">
                <strong>{text.catalogConfiguration}</strong>
                <span>{catalogError}</span>
              </div>
            )}
            {loading && <div className="loading-row">{text.loadingSelection}</div>}
            {historyError && <div className="configuration-banner"><strong>{text.continueWatching}</strong><span>{historyError}</span></div>}
            {!authLoading && !user && <div className="history-signin-prompt"><span>{language === "ro-RO" ? "Intră în cont pentru istoric și reluarea redării." : "Sign in for watch history and playback progress."}</span><Link href="/account">{language === "ro-RO" ? "Autentifică-te" : "Sign in"} →</Link></div>}
            {user && <MovieRow title={text.continueWatching} movies={continueMovies} onPlay={openTitle} onSelect={openTitle} progress={progressMap} />}
            {user && <MovieRow title={text.nextEpisodeRow} movies={nextEpisodes} onPlay={openPlayer} />}
            {user && <MovieRow title={text.myList} movies={myListMovies} onPlay={openTitle} onSelect={openTitle} exploreHref="/my-list" />}
            <SurprisePicker excludedIds={excludedIds} onSelect={openTitle} />
            {user && <MovieRow title={text.forYou} movies={forYou} onPlay={openPlayer} onSelect={openTitle} />}
            <MovieRow id="trending" title={text.trendingNow} movies={trending} onPlay={openPlayer} onSelect={openTitle} progress={progressMap} exploreHref="/explore?type=trending" />
            <MovieRow id="trending-tv" title={text.trendingTv} movies={trendingTv} onPlay={openPlayer} onSelect={openTitle} progress={progressMap} exploreHref="/explore?type=trending_tv" />
            <MovieRow id="top-rated" title={text.topRated} movies={topRated} onPlay={openPlayer} onSelect={openTitle} progress={progressMap} exploreHref="/explore?type=top_rated" />
            <div id="categories">
              {categories.map((category) => (
                <MovieRow
  key={category.id}
  id={category.id}
  title={text.genres[String(category.genre)]}
  movies={categoryRows[category.id] ?? []}
  onPlay={openPlayer}
  onSelect={openTitle}
  progress={progressMap}
  exploreHref={`/explore?genre=${category.genre}`}
/>
              ))}
            </div>
          </div>
        </>
      )}
      <footer>
        <span className="brand">CINEMY</span>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </footer>
      {detailsMovie && (
        <TitleDetailsModal
          movie={detailsMovie}
          hasProgress={progressMap.has(`movie_${detailsMovie.id}`)}
          onClose={() => setDetailsMovie(null)}
          onPlay={(movie) => {
            setDetailsMovie(null);
            const href = watchHref(movie, 1, 1);
            rememberWatchReturn(href);
            router.push(href);
          }}
        />
      )}
      {selectedTv && (
        <TvShowDetailsModal
          show={selectedTv}
          resumeSeason={progressMap.get(`tv_${selectedTv.id}`)?.season_number}
          resumeEpisode={progressMap.get(`tv_${selectedTv.id}`)?.episode_number}
          onClose={() => setSelectedTv(null)}
          onPlay={openTvEpisode}
        />
      )}
    </main>
  );
}
