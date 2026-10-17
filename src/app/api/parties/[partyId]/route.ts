import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import { validPartyId, type WatchParty } from "@/lib/watch-party";

type Context = { params: Promise<{ partyId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { partyId } = await context.params;
  if (!validPartyId(partyId)) return NextResponse.json({ error: "Invalid party link." }, { status: 400 });
  try {
    const { supabase } = await getAuthenticatedSupabase(request);
    const { data, error } = await supabase.from("watch_parties").select("*").eq("id", partyId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Party unavailable." }, { status: 404 });
    return NextResponse.json({ party: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not load party." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const { partyId } = await context.params;
  if (!validPartyId(partyId)) return NextResponse.json({ error: "Invalid party link." }, { status: 400 });
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (!["select", "pause", "play", "progress", "lobby", "end"].includes(String(action))) {
      return NextResponse.json({ error: "Invalid party action." }, { status: 400 });
    }
    const { data: current, error: readError } = await supabase.from("watch_parties").select("*").eq("id", partyId).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "Party unavailable." }, { status: 404 });
    const party = current as WatchParty;
    if (party.host_user_id !== userId) return NextResponse.json({ error: "Only the host can control this party." }, { status: 403 });
    if (party.ended_at) return NextResponse.json({ error: "Party has ended." }, { status: 410 });

    const changes: Record<string, unknown> = { playback_updated_at: new Date().toISOString() };
    if (action === "select") {
      const mediaType = body.mediaType;
      const tmdbId = Number(body.tmdbId);
      const season = Number(body.season ?? 1);
      const episode = Number(body.episode ?? 1);
      const position = Number(body.positionSeconds ?? 0);
      if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isSafeInteger(tmdbId) || tmdbId <= 0
        || !Number.isInteger(season) || season < 1 || season > 100
        || !Number.isInteger(episode) || episode < 1 || episode > 1000
        || !Number.isFinite(position) || position < 0 || position > 86400) {
        return NextResponse.json({ error: "Invalid title selection." }, { status: 400 });
      }
      Object.assign(changes, {
        media_type: mediaType, tmdb_id: tmdbId,
        season_number: mediaType === "tv" ? season : 1,
        episode_number: mediaType === "tv" ? episode : 1,
        position_seconds: Math.floor(position), is_playing: true,
        playback_revision: party.playback_revision + 1,
      });
    } else if (action === "lobby" || action === "end") {
      Object.assign(changes, {
        media_type: null, tmdb_id: null, position_seconds: 0,
        is_playing: false, playback_revision: party.playback_revision + 1,
      });
      if (action === "end") changes.ended_at = new Date().toISOString();
    } else {
      const position = Number(body.positionSeconds);
      if (!Number.isFinite(position) || position < 0 || position > 86400) {
        return NextResponse.json({ error: "Invalid playback position." }, { status: 400 });
      }
      if (!party.media_type || !party.tmdb_id) return NextResponse.json({ error: "Select a title first." }, { status: 409 });
      if (action === "progress" && !party.is_playing) return NextResponse.json({ party }, { headers: { "Cache-Control": "no-store" } });
      changes.position_seconds = Math.floor(position);
      if (action !== "progress") {
        changes.is_playing = action === "play";
        changes.playback_revision = party.playback_revision + 1;
      }
    }
    const { data, error } = await supabase.from("watch_parties").update(changes)
      .eq("id", partyId).eq("host_user_id", userId).is("ended_at", null).select("*").single();
    if (error) throw error;
    return NextResponse.json({ party: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not update party." }, { status: 503 });
  }
}
