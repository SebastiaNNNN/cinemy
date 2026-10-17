import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, ProgressAuthError } from "@/lib/supabase-server";
import type { MyListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof ProgressAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const databaseError = error && typeof error === "object" ? error as { code?: string; message?: string } : null;
  const message = databaseError?.code === "PGRST205"
    ? "The my_list table is missing. Run supabase/schema.sql in your Supabase SQL Editor."
    : databaseError?.message || "Unable to access My List.";
  return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const { data, error } = await supabase.from("my_list").select("*")
      .eq("user_id", userId).order("added_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const item = await request.json() as Partial<MyListItem>;
    if (!item.media_id || !/^(movie|tv)_\d+$/.test(item.media_id) || !item.title?.trim()) {
      return NextResponse.json({ error: "A valid media_id and title are required." }, { status: 400 });
    }
    const { data, error } = await supabase.from("my_list").upsert({
      user_id: userId,
      media_id: item.media_id,
      title: item.title.trim(),
      poster_path: item.poster_path ?? null,
      backdrop_path: item.backdrop_path ?? null,
      vote_average: Number.isFinite(item.vote_average) ? item.vote_average : 0,
      release_date: item.release_date || null,
      first_air_date: item.first_air_date || null,
    }, { onConflict: "user_id,media_id" }).select().single();
    if (error) throw error;
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedSupabase(request);
    const mediaId = request.nextUrl.searchParams.get("media_id");
    if (!mediaId || !/^(movie|tv)_\d+$/.test(mediaId)) {
      return NextResponse.json({ error: "A valid media_id is required." }, { status: 400 });
    }
    const { error } = await supabase.from("my_list").delete()
      .eq("user_id", userId).eq("media_id", mediaId);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
