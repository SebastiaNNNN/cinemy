import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const ALLOWED_TYPES = new Set(["top_rated", "popular", "now_playing"]);

function tmdbHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const language = params.get("language") === "ro-RO" ? "ro-RO" : "en-US";
  const messages = language === "ro-RO"
    ? {
        missingConfig: "TMDB nu este configurat. Adaugă TMDB_API_KEY sau TMDB_READ_ACCESS_TOKEN în .env.local.",
        unknownError: "Eroare necunoscută",
        tmdbError: (status: number) => `TMDB a răspuns cu ${status}`,
      }
    : {
        missingConfig: "TMDB is not configured. Add TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN to .env.local.",
        unknownError: "Unknown error",
        tmdbError: (status: number) => `TMDB responded with ${status}`,
      };
  const apiKey = process.env.TMDB_API_KEY;
  const accessToken = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!apiKey && !accessToken) {
    return NextResponse.json(
      { error: messages.missingConfig },
      { status: 503 },
    );
  }

  const query = params.get("q")?.trim();
  const movieId = params.get("id")?.trim();
  const requestedMediaType = params.get("media_type");
  const hasMediaTypeFilter = requestedMediaType === "movie" || requestedMediaType === "tv";
  const mediaType = requestedMediaType === "tv" ? "tv" : "movie";
  const type = params.get("type") || "trending";
  const genre = params.get("genre");
  const page = Math.min(500, Math.max(1, Math.floor(Number(params.get("page")) || 1)));
  const seed = params.get("seed");

  let endpoint: string;
  const search = new URLSearchParams({ language, page: String(page), include_adult: "false" });
  if (apiKey) search.set("api_key", apiKey);

  if (movieId && /^\d+$/.test(movieId)) {
    endpoint = `/${mediaType}/${movieId}`;
    search.set("append_to_response", "videos,external_ids");
  } else if (query) {
    endpoint = hasMediaTypeFilter ? `/search/${mediaType}` : "/search/multi";
    search.set("query", query);
  } else if (type === "recommendations") {
    if (!seed || !/^(movie|tv)_\d+$/.test(seed)) {
      return NextResponse.json({ error: "A valid recommendation seed is required." }, { status: 400 });
    }
    const [seedType, seedId] = seed.split("_");
    endpoint = `/${seedType}/${seedId}/recommendations`;
  } else if (type === "discover") {
    endpoint = `/discover/${mediaType}`;
    search.set("sort_by", "popularity.desc");
    search.set("vote_average.gte", "6.5");
    search.set("vote_count.gte", "100");
    if (genre && /^\d+$/.test(genre)) search.set("with_genres", genre);
  } else if (genre) {
    endpoint = `/discover/${mediaType}`;
    search.set("with_genres", genre);
    search.set("sort_by", "popularity.desc");
  } else if (type === "trending") {
    endpoint = `/trending/${mediaType}/week`;
  } else if (type === "trending_tv") {
    endpoint = "/trending/tv/week";
  } else {
    endpoint = `/${mediaType}/${ALLOWED_TYPES.has(type) ? type : "popular"}`;
    if (mediaType === "movie") search.set("region", "RO");
  }

  try {
    const response = await fetch(`${TMDB_BASE}${endpoint}?${search}`, {
      headers: tmdbHeaders(),
      next: { revalidate: query ? 0 : 1800 },
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json({ error: messages.tmdbError(response.status), details: message }, { status: response.status });
    }

    const data = (await response.json()) as {
      results?: Array<{ id: number; poster_path?: string | null; media_type?: string }>;
      [key: string]: unknown;
    };
    if (movieId) {
      const currentVideos = data.videos as { results?: unknown[] } | undefined;
      if (!currentVideos?.results?.length) {
        const videoSearch = new URLSearchParams({ language: "en-US" });
        if (apiKey) videoSearch.set("api_key", apiKey);
        const videoResponse = await fetch(`${TMDB_BASE}/${mediaType}/${movieId}/videos?${videoSearch}`, {
          headers: tmdbHeaders(),
          next: { revalidate: 1800 },
        });
        if (videoResponse.ok) data.videos = await videoResponse.json();
      }
      return NextResponse.json(data);
    }
    const defaultMediaType = type === "trending_tv" || mediaType === "tv" || seed?.startsWith("tv_") ? "tv" : "movie";
    // TMDB list responses already contain everything the cards need. Fetch full metadata
    // only when a title is opened; doing it for every result multiplies API traffic.
    const results = (data.results ?? [])
      .filter((item) => Boolean(item.poster_path) && (item.media_type === undefined || item.media_type === "movie" || item.media_type === "tv"))
      .map((item) => ({ ...item, media_type: item.media_type || defaultMediaType }));
    return NextResponse.json({ ...data, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : messages.unknownError;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
