import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import { PARTY_CAPACITY, validPartyId, type WatchParty } from "@/lib/watch-party";

export async function POST(request: NextRequest, context: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await context.params;
  if (!validPartyId(partyId)) return NextResponse.json({ error: "Invalid party." }, { status: 400 });
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const { data: current, error: readError } = await supabase.from("watch_parties").select("*").eq("id", partyId).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "Party unavailable." }, { status: 404 });
    const party = current as WatchParty;
    if (party.host_user_id !== userId) return NextResponse.json({ error: "Only the host can invite." }, { status: 403 });
    if (party.ended_at) return NextResponse.json({ error: "Party has ended." }, { status: 410 });
    if (party.member_count >= PARTY_CAPACITY) return NextResponse.json({ error: "Party is full." }, { status: 409 });
    const { data, error } = await supabase.from("watch_party_invites")
      .insert({ party_id: partyId }).select("token, expires_at").single();
    if (error) throw error;
    return NextResponse.json({ invite: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not create invite." }, { status: 503 });
  }
}
