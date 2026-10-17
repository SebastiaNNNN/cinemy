import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedPositionSeconds,
  isStalePlaybackUpdate,
  positionDrift,
  type PlaybackClock,
} from "../src/lib/playback-sync";

test("a higher playback revision always wins, a lower one is stale", () => {
  const previous: PlaybackClock = { playback_revision: 3, updated_at: "2026-09-24T12:00:30.000Z" };
  assert.equal(isStalePlaybackUpdate({ playback_revision: 4, updated_at: "2026-09-24T11:59:00.000Z" }, previous), false);
  assert.equal(isStalePlaybackUpdate({ playback_revision: 2, updated_at: "2026-09-24T12:01:00.000Z" }, previous), true);
});

test("within one revision only the newest timestamp is accepted", () => {
  const previous: PlaybackClock = { playback_revision: 1, updated_at: "2026-09-24T12:00:10.000Z" };
  assert.equal(isStalePlaybackUpdate({ playback_revision: 1, updated_at: "2026-09-24T12:00:11.000Z" }, previous), false);
  assert.equal(isStalePlaybackUpdate({ playback_revision: 1, updated_at: "2026-09-24T12:00:09.000Z" }, previous), true);
  assert.equal(isStalePlaybackUpdate({ playback_revision: 1, updated_at: "2026-09-24T12:00:10.000Z" }, previous), false);
});

test("unparseable timestamps never reject a same-revision update", () => {
  const previous: PlaybackClock = { playback_revision: 0, updated_at: "not-a-date" };
  assert.equal(isStalePlaybackUpdate({ playback_revision: 0, updated_at: "2026-09-24T12:00:00.000Z" }, previous), false);
});

test("a paused timeline is frozen while a playing one advances with real time", () => {
  const now = Date.parse("2026-09-24T12:00:10.000Z");
  assert.equal(expectedPositionSeconds(120, "2026-09-24T12:00:00.000Z", false, now), 120);
  assert.equal(expectedPositionSeconds(120, "2026-09-24T12:00:00.000Z", true, now), 130);
});

test("expected position guards against bad input and clock skew", () => {
  const now = Date.parse("2026-09-24T12:00:10.000Z");
  assert.equal(expectedPositionSeconds(-5, "2026-09-24T12:00:00.000Z", true, now), 10);
  assert.equal(expectedPositionSeconds(Number.NaN, "2026-09-24T12:00:00.000Z", false, now), 0);
  assert.equal(expectedPositionSeconds(50, "garbage", true, now), 50);
  // A timestamp slightly in the future must not subtract time.
  assert.equal(expectedPositionSeconds(30, "2026-09-24T12:00:20.000Z", true, now), 30);
});

test("drift reports how far a viewer is from the shared timeline", () => {
  assert.equal(positionDrift(100, 90), 10);
  assert.equal(positionDrift(80, 90), -10);
  assert.equal(positionDrift(Number.NaN, 90), 0);
});
