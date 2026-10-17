import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import { validRoomId, type WatchRoom } from "@/lib/watch-room";

type RoomContext = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, context: RoomContext) {
  const { roomId } = await context.params;
  if (!validRoomId(roomId)) return NextResponse.json({ error: "Invalid room link." }, { status: 400 });
  try {
    const { supabase } = await getAuthenticatedSupabase(request);
    const { data, error } = await supabase.from("watch_rooms").select("*").eq("id", roomId).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Room unavailable." }, { status: 404 });
    return NextResponse.json({ room: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not load this room." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest, context: RoomContext) {
  const { roomId } = await context.params;
  if (!validRoomId(roomId)) return NextResponse.json({ error: "Invalid room link." }, { status: 400 });
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    const position = Number(body.positionSeconds);
    if (!["pause", "play", "progress", "episode"].includes(String(action))
      || !Number.isFinite(position) || position < 0 || position > 86400) {
      return NextResponse.json({ error: "Invalid playback update." }, { status: 400 });
    }
    const { data: current, error: readError } = await supabase.from("watch_rooms").select("*").eq("id", roomId).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "Room unavailable." }, { status: 404 });
    const room = current as WatchRoom;
    if (room.host_user_id !== userId) return NextResponse.json({ error: "Only the host can control this room." }, { status: 403 });
    if (action === "progress" && !room.is_playing) return NextResponse.json({ room }, { headers: { "Cache-Control": "no-store" } });

    const changes: Record<string, unknown> = {
      position_seconds: Math.floor(position),
    };
    if (action !== "progress") {
      changes.playback_revision = room.playback_revision + 1;
      changes.is_playing = action !== "pause";
    }
    if (action === "episode") {
      const season = Number(body.season);
      const episode = Number(body.episode);
      if (room.media_type !== "tv" || !Number.isInteger(season) || season < 1 || season > 100
        || !Number.isInteger(episode) || episode < 1 || episode > 1000) {
        return NextResponse.json({ error: "Invalid episode." }, { status: 400 });
      }
      changes.season_number = season;
      changes.episode_number = episode;
    }
    const { data: updated, error: updateError } = await supabase.from("watch_rooms").update(changes).eq("id", roomId).eq("host_user_id", userId).select("*").single();
    if (updateError) throw updateError;
    return NextResponse.json({ room: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not update this room." }, { status: 503 });
  }
}
