import { NextRequest, NextResponse } from "next/server";

type Genre = { id: number; name: string };

export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get("language") === "ro-RO" ? "ro-RO" : "en-US";
  const apiKey = process.env.TMDB_API_KEY;
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!apiKey && !token) {
    return NextResponse.json({ error: "TMDB is not configured." }, { status: 503 });
  }

  try {
    const genres = await Promise.all((["movie", "tv"] as const).map(async (mediaType) => {
      const params = new URLSearchParams({ language });
      if (apiKey) params.set("api_key", apiKey);
      const response = await fetch(`https://api.themoviedb.org/3/genre/${mediaType}/list?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
        next: { revalidate: 86400 },
      });
      if (!response.ok) throw new Error(`TMDB genres request failed (${response.status}).`);
      const data = await response.json() as { genres?: Genre[] };
      return (data.genres ?? []).filter((genre) => Number.isInteger(genre.id) && genre.name);
    }));
    return NextResponse.json({ movie: genres[0], tv: genres[1] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load genres." }, { status: 502 });
  }
}
