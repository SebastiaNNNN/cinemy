import { expectedPositionSeconds } from "@/lib/playback-sync";
import type { MediaType } from "@/lib/types";

export interface WatchRoom {
  id: string;
  host_user_id: string;
  media_type: MediaType;
  tmdb_id: number;
  season_number: number;
  episode_number: number;
  position_seconds: number;
  is_playing: boolean;
  playback_revision: number;
  updated_at: string;
  expires_at: string;
}

export function validRoomId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function roomPosition(room: WatchRoom, now = Date.now()) {
  return expectedPositionSeconds(room.position_seconds, room.updated_at, room.is_playing, now);
}
