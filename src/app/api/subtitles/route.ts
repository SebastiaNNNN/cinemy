import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OPENSUBTITLES_BASE = "https://opensubtitles-v3.strem.io";
const ALLOWED_LANGUAGES = new Set(["ron", "rum", "eng"]);

type Subtitle = { url?: string; lang?: string; subtitleFileName?: string; movieReleaseName?: string };

function toWebVtt(content: string) {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const body = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}\n`;
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams;
    const imdbId = query.get("imdb_id")?.trim();
    const mediaType = query.get("media_type") === "tv" ? "series" : "movie";
    const season = Math.max(1, Number(query.get("season")) || 1);
    const episode = Math.max(1, Number(query.get("episode")) || 1);
    const language = query.get("lang")?.toLowerCase() || "ron";
    const addonLanguages = language === "ron" ? new Set(["ron", "rum"]) : new Set([language]);
    const fileId = query.get("file");

    if (fileId) {
      const subtitleUrl = Buffer.from(fileId, "base64url").toString("utf8");
      if (!subtitleUrl.startsWith("https://subs5.strem.io/")) return NextResponse.json({ error: "Invalid subtitle source." }, { status: 400 });
      const response = await fetch(subtitleUrl, { cache: "no-store" });
      if (!response.ok) return NextResponse.json({ error: "Subtitle unavailable." }, { status: 502 });
      const content = await response.text();
      return new NextResponse(toWebVtt(content), { headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
    }

    if (!imdbId || !/^tt\d+$/.test(imdbId)) return NextResponse.json({ error: "Missing IMDb ID" }, { status: 400 });
    if (!ALLOWED_LANGUAGES.has(language)) return NextResponse.json({ error: "Unsupported subtitle language." }, { status: 400 });
    const suffix = mediaType === "series" ? `:${season}:${episode}` : "";
    const response = await fetch(`${OPENSUBTITLES_BASE}/subtitles/${mediaType}/${imdbId}${suffix}.json`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as { subtitles?: Subtitle[] } | null;
    if (!response.ok) return NextResponse.json({ error: `OpenSubtitles responded with ${response.status}` }, { status: 502 });
    const subtitles = (data?.subtitles || []).filter((item) => item.url && addonLanguages.has(item.lang || "")).slice(0, 3);
    return NextResponse.json({ subtitles: subtitles.map((item, index) => ({
      id: `${language}-${index}`,
      label: language === "ron" ? "Română" : "English",
      language,
      url: `/api/subtitles?file=${encodeURIComponent(Buffer.from(item.url as string).toString("base64url"))}`,
      release: item.movieReleaseName || item.subtitleFileName,
    })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subtitles unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
