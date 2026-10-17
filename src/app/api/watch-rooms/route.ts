import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const body = await request.json() as Record<string, unknown>;
    const mediaType = body.mediaType;
    const tmdbId = Number(body.tmdbId);
    const season = Number(body.season ?? 1);
    const episode = Number(body.episode ?? 1);
    const position = Number(body.positionSeconds ?? 0);
    if ((mediaType !== "movie" && mediaType !== "tv")
      || !Number.isSafeInteger(tmdbId) || tmdbId <= 0
      || !Number.isInteger(season) || season < 1 || season > 100
      || !Number.isInteger(episode) || episode < 1 || episode > 1000
      || !Number.isFinite(position) || position < 0 || position > 86400) {
      return NextResponse.json({ error: "Invalid watch room details." }, { status: 400 });
    }

    const { data, error } = await supabase.from("watch_rooms").insert({
      host_user_id: userId,
      media_type: mediaType,
      tmdb_id: tmdbId,
      season_number: mediaType === "tv" ? season : 1,
      episode_number: mediaType === "tv" ? episode : 1,
      position_seconds: Math.floor(position),
      is_playing: false,
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ room: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not create a watch room. Check that the Supabase room schema is installed." }, { status: 503 });
  }
}
