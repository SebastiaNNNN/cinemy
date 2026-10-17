import assert from "node:assert/strict";
import test from "node:test";
import { roomPosition, validRoomId, type WatchRoom } from "../src/lib/watch-room";

const room: WatchRoom = {
  id: "5fa2903f-6f42-4efd-b48a-3bbd61c609da",
  host_user_id: "bfb6a120-8d11-4a0d-8063-a677925508a6",
  media_type: "movie",
  tmdb_id: 798,
  season_number: 1,
  episode_number: 1,
  position_seconds: 120,
  is_playing: false,
  playback_revision: 0,
  updated_at: "2026-09-24T12:00:00.000Z",
  expires_at: "2026-09-25T12:00:00.000Z",
};

test("watch room accepts UUID invitation links only", () => {
  assert.equal(validRoomId(room.id), true);
  assert.equal(validRoomId("../../watch_history"), false);
  assert.equal(validRoomId("short"), false);
});

test("paused rooms stay at the host's position", () => {
  assert.equal(roomPosition(room, Date.parse("2026-09-24T12:01:00.000Z")), 120);
});

test("late joiners start near the host's current position", () => {
  assert.equal(roomPosition({ ...room, is_playing: true }, Date.parse("2026-09-24T12:00:07.000Z")), 127);
});
