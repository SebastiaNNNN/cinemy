import assert from "node:assert/strict";
import test from "node:test";
import { partyPosition, validPartyId, type WatchParty } from "../src/lib/watch-party";

const party: WatchParty = {
  id: "1b506fea-f67f-45c4-9418-17916f1e8155",
  host_user_id: "3d661a67-e107-444e-9ff4-d6b703c3bc60",
  media_type: "movie",
  tmdb_id: 123,
  season_number: 1,
  episode_number: 1,
  position_seconds: 90,
  is_playing: true,
  playback_revision: 2,
  member_count: 1,
  ended_at: null,
  updated_at: "2026-09-24T12:00:09.000Z",
  playback_updated_at: "2026-09-24T12:00:00.000Z",
};

test("party links require UUIDs", () => {
  assert.equal(validPartyId(party.id), true);
  assert.equal(validPartyId("../../account"), false);
  assert.equal(validPartyId("not-a-party"), false);
});

test("playing position advances from playback timestamp, not member joins", () => {
  assert.equal(partyPosition(party, Date.parse("2026-09-24T12:00:10.000Z")), 100);
});

test("paused position stays fixed", () => {
  assert.equal(partyPosition({ ...party, is_playing: false }, Date.parse("2026-09-24T12:05:00.000Z")), 90);
});
