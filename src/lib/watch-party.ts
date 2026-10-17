import type { MediaType } from "@/lib/types";

export interface WatchParty {
  id: string;
  host_user_id: string;
  media_type: MediaType | null;
  tmdb_id: number | null;
  season_number: number;
  episode_number: number;
  position_seconds: number;
  is_playing: boolean;
  playback_revision: number;
  member_count: number;
  ended_at: string | null;
  updated_at: string;
  playback_updated_at: string;
}

export const PARTY_CAPACITY = 4;

export function validPartyId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function partyPosition(party: WatchParty, now = Date.now()) {
  const elapsed = party.is_playing ? Math.max(0, (now - Date.parse(party.playback_updated_at)) / 1000) : 0;
  return Math.max(0, Math.floor(party.position_seconds + (Number.isFinite(elapsed) ? elapsed : 0)));
}
