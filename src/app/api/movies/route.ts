import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const ALLOWED_TYPES = new Set(["trending", "top_rated", "popular", "now_playing"]);

function tmdbHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  const accessToken = process.env.TMDB_READ_ACCESS_TOKEN;

  if (!apiKey && !accessToken) {
    return NextResponse.json(
      { error: "TMDB nu este configurat. Adaugă TMDB_API_KEY sau TMDB_READ_ACCESS_TOKEN în .env.local." },
      { status: 503 },
    );
  }

  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim();
  const type = params.get("type") || "trending";
  const genre = params.get("genre");
  const page = Math.max(1, Number(params.get("page")) || 1);

  let endpoint: string;
  const search = new URLSearchParams({ language: "ro-RO", page: String(page), include_adult: "false" });
  if (apiKey) search.set("api_key", apiKey);

  if (query) {
    endpoint = "/search/movie";
    search.set("query", query);
  } else if (genre) {
    endpoint = "/discover/movie";
    search.set("with_genres", genre);
    search.set("sort_by", "popularity.desc");
  } else if (type === "trending") {
    endpoint = "/trending/movie/week";
  } else {
    endpoint = `/movie/${ALLOWED_TYPES.has(type) ? type : "popular"}`;
    search.set("region", "RO");
  }

  try {
    const response = await fetch(`${TMDB_BASE}${endpoint}?${search}`, {
      headers: tmdbHeaders(),
      next: { revalidate: query ? 0 : 1800 },
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json({ error: `TMDB a răspuns cu ${response.status}`, details: message }, { status: response.status });
    }

    const data = (await response.json()) as {
      results?: Array<{ poster_path?: string | null }>;
      [key: string]: unknown;
    };
    return NextResponse.json({
      ...data,
      results: (data.results ?? []).filter((movie) => Boolean(movie.poster_path)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
