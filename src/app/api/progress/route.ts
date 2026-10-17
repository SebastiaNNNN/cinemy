import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import type { WatchHistory } from "@/lib/types";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof ProgressAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const databaseError = error && typeof error === "object"
    ? error as { code?: string; message?: string }
    : null;
  const message = databaseError?.code === "PGRST205"
    ? "The watch_history table is missing. Run supabase/schema.sql in your Supabase project's SQL Editor."
    : databaseError?.message || "Unable to access watch history.";
  return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", userId)
      .gte("progress_seconds", 0)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const body = (await request.json()) as Partial<WatchHistory>;
    if (!body.media_id || !/^(movie|tv)_\d+$/.test(body.media_id) || !body.title) {
      return NextResponse.json({ error: "A valid media_id and title are required." }, { status: 400 });
    }

    const progress = Math.max(0, Math.round(Number(body.progress_seconds) || 0));
    const duration = Math.max(progress, Math.round(Number(body.duration_seconds) || 0));
    const { data, error } = await supabase
      .from("watch_history")
      .upsert(
        {
          user_id: userId,
          media_id: body.media_id,
          title: body.title,
          poster_path: body.poster_path ?? null,
          backdrop_path: body.backdrop_path ?? null,
          progress_seconds: progress,
          duration_seconds: duration,
          season_number: body.season_number ?? null,
          episode_number: body.episode_number ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,media_id" },
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
