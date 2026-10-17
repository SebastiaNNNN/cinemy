import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import { validPartyId } from "@/lib/watch-party";

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!validPartyId(token)) return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
  try {
    const { supabase } = await getAuthenticatedSupabase(request);
    const { data, error } = await supabase.rpc("join_watch_party", { p_token: token });
    if (error) {
      const message = error.message || "Could not join party.";
      const status = /expired|invalid|unavailable/i.test(message) ? 410 : /host|full/i.test(message) ? 403 : 503;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ partyId: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not join party." }, { status: 503 });
  }
}
