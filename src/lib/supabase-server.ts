import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export class ProgressAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function getAuthenticatedSupabase(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  if (!token) throw new ProgressAuthError("Sign in to access watch history.", 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    throw new ProgressAuthError("Accounts are not configured yet.", 503);
  }

  // Query with the user's JWT so Postgres RLS applies even on server routes.
  const supabase = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ProgressAuthError("Session expired. Sign in again.", 401);

  return { supabase, userId: user.id };
}
