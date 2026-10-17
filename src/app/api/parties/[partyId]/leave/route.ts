import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import { validPartyId } from "@/lib/watch-party";

export async function POST(request: NextRequest, context: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await context.params;
  if (!validPartyId(partyId)) return NextResponse.json({ error: "Invalid party." }, { status: 400 });
  try {
    const { supabase } = await getAuthenticatedSupabase(request);
    const { data, error } = await supabase.rpc("leave_watch_party", { p_party_id: partyId });
    if (error) throw error;
    return NextResponse.json({ left: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not leave party." }, { status: 503 });
  }
}
