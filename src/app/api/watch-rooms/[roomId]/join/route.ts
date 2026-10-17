import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import { validRoomId } from "@/lib/watch-room";

export async function POST(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  if (!validRoomId(roomId)) return NextResponse.json({ error: "Invalid room link." }, { status: 400 });
  try {
    const { supabase } = await getAuthenticatedSupabase(request);
    const { data: joined, error } = await supabase.rpc("join_watch_room", { room_id: roomId });
    if (error) throw error;
    if (!joined) return NextResponse.json({ error: "This room was not found or has expired." }, { status: 404 });
    const { data: room, error: roomError } = await supabase.from("watch_rooms").select("*").eq("id", roomId).single();
    if (roomError || !room) throw roomError || new Error("Room unavailable");
    return NextResponse.json({ room }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not join this room. Check the Supabase room schema." }, { status: 503 });
  }
}
