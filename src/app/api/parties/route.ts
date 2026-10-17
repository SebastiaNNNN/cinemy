import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const { data, error } = await supabase.from("watch_parties")
      .insert({ host_user_id: userId }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ party: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    if (reason instanceof ProgressAuthError) return NextResponse.json({ error: reason.message }, { status: reason.status });
    return NextResponse.json({ error: "Could not create party. Install the latest Supabase schema." }, { status: 503 });
  }
}
