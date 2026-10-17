import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { StreamSource } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Legacy endpoint only. Playback now uses the ZXC[STREAM] embed directly.
    const torrentioBase = process.env.TORRENTIO_BASE_URL?.trim().replace(/\/+$/, "");
    if (!torrentioBase) return NextResponse.json({ error: "Legacy source resolver is disabled." }, { status: 410 });
    const query = request.nextUrl.searchParams;
    const imdbId = query.get("imdb_id")?.trim();
    const mediaType = query.get("media_type") === "tv" ? "series" : "movie";
    const season = Math.max(1, Number(query.get("season")) || 1);
    const episode = Math.max(1, Number(query.get("episode")) || 1);
    const sourceKey = query.get("source_key");
    if (!imdbId || !/^tt\d+$/.test(imdbId)) return NextResponse.json({ error: "Missing IMDb ID" }, { status: 400 });
    const suffix = mediaType === "series" ? `:${season}:${episode}` : "";
    const response = await fetch(`${torrentioBase}/stream/${mediaType}/${imdbId}${suffix}.json`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as { streams?: Array<{ url?: string; name?: string; title?: string }> } | null;
    if (!response.ok) return NextResponse.json({ error: `Torrentio responded with ${response.status}` }, { status: 502 });
    const streams = data?.streams?.filter((item) => item.url) || [];
    const sources: StreamSource[] = streams
      .map((item, index) => {
        const description = `${item.name || ""} ${item.title || ""}`;
        const explicitlySilent = /video[ ._-]?only|no[ ._-]?audio|silent/i.test(description);
        const unsupportedAudio = /\b(?:dts(?:-hd)?|truehd|e-?ac-?3|eac3|ddp|dd\+|ac-?3|flac|pcm|atmos)\b/i.test(description);
        const compatibleAudio = /\b(?:aac(?:2\.0|5\.1)?|mp3|opus|vorbis)\b/i.test(description)
          || /\.m3u8(?:$|\?)/i.test(item.url || "");
        return {
          id: index,
          url: item.url as string,
          sourceKey: createHash("sha256")
            .update(`${item.url}|${item.name || ""}|${item.title || ""}`)
            .digest("base64url")
            .slice(0, 24),
          name: item.name,
          title: item.title,
          quality: description.match(/2160p|1080p|720p|480p|4k/i)?.[0]?.toUpperCase(),
          seeders: Number(`${item.title || ""}`.match(/(?:👤|seeders?)\s*(\d+)/i)?.[1] || 0),
          hasAudio: compatibleAudio ? true : explicitlySilent ? false : undefined,
          audioStatus: (compatibleAudio ? "detected" : "unknown") as "detected" | "unknown",
          browserCompatible: !explicitlySilent && !unsupportedAudio,
        };
      })
      .filter((source) => source.browserCompatible)
      .sort((left, right) => {
        const score = (item: StreamSource) => {
          const text = `${item.name || ""} ${item.title || ""} ${item.url || ""}`.toLowerCase();
          let value = 0;
          if (/\b(?:aac|mp3|opus|vorbis)\b/.test(text)) value += 100;
          if (/2160p|4k/.test(text)) value += 4;
          if (/1080p/.test(text)) value += 3;
          if (/\.m3u8(?:$|\?)/.test(item.url || "")) value += 20;
          value += Math.min(item.seeders || 0, 50) / 10;
          return value;
        };
        return score(right) - score(left);
      });
    const explicitlyCompatible = sources.filter((source) => source.audioStatus === "detected");
    const selectableSources = explicitlyCompatible;
    const savedSource = sourceKey ? selectableSources.find((source) => source.sourceKey === sourceKey) : undefined;
    const playable = savedSource || selectableSources[0];
    if (!playable?.url) return NextResponse.json({ error: "No browser-compatible Torrentio source with audio was found." }, { status: 404 });
    return NextResponse.json({
      streamUrl: playable.url,
      streamName: playable.name || playable.title,
      sourceKey: playable.sourceKey,
      sources: selectableSources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Torrentio unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
