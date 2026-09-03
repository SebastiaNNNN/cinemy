import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import type { WatchHistory } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .gt("progress_seconds", 0)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<WatchHistory>;
    if (!body.media_id || !body.title) {
      return NextResponse.json({ error: "media_id și title sunt obligatorii." }, { status: 400 });
    }

    const progress = Math.max(0, Math.round(Number(body.progress_seconds) || 0));
    const duration = Math.max(progress, Math.round(Number(body.duration_seconds) || 0));
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("watch_history")
      .upsert(
        {
          media_id: body.media_id,
          title: body.title,
          poster_path: body.poster_path ?? null,
          backdrop_path: body.backdrop_path ?? null,
          progress_seconds: progress,
          duration_seconds: duration,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "media_id" },
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
