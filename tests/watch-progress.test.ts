import assert from "node:assert/strict";
import test from "node:test";
import { buildWatchHistory, isWatchComplete, resolveWatchPosition } from "../src/lib/watch-progress";
import type { WatchHistory } from "../src/lib/types";

const savedEpisode: WatchHistory = {
  media_id: "tv_94605",
  title: "Example series",
  poster_path: null,
  backdrop_path: null,
  progress_seconds: 1423,
  duration_seconds: 2400,
  season_number: 2,
  episode_number: 4,
};

test("a series link without episode resumes the saved episode and second", () => {
  assert.deepEqual(resolveWatchPosition("tv", savedEpisode), {
    season: 2,
    episode: 4,
    resumeAt: 1423,
    redirectToSavedEpisode: true,
  });
});

test("an explicit different episode never borrows another episode's position", () => {
  assert.deepEqual(resolveWatchPosition("tv", savedEpisode, 2, 5), {
    season: 2,
    episode: 5,
    resumeAt: 0,
    redirectToSavedEpisode: false,
  });
});

test("an explicit matching episode resumes at the saved second", () => {
  assert.equal(resolveWatchPosition("tv", savedEpisode, 2, 4).resumeAt, 1423);
});

test("movies resume their saved position and new titles start at zero", () => {
  assert.equal(resolveWatchPosition("movie", { ...savedEpisode, media_id: "movie_55" }).resumeAt, 1423);
  assert.equal(resolveWatchPosition("movie", undefined).resumeAt, 0);
  assert.equal(resolveWatchPosition("tv", undefined).resumeAt, 0);
});

const movie = {
  id: 603,
  media_type: "movie" as const,
  title: "The Matrix",
  overview: "",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  vote_average: 8.2,
};

test("building a progress row clamps duration and never saves a zero position", () => {
  assert.equal(buildWatchHistory(movie, { mediaType: "movie", positionSeconds: 0, durationSeconds: 100 }), null);
  const row = buildWatchHistory(movie, { mediaType: "movie", positionSeconds: 250, durationSeconds: 100 });
  assert.ok(row);
  assert.equal(row.media_id, "movie_603");
  assert.equal(row.progress_seconds, 250);
  // Duration is never allowed to fall below the watched position.
  assert.equal(row.duration_seconds, 250);
  assert.equal(row.season_number, undefined);
});

test("a TV progress row keeps the episode it belongs to", () => {
  const row = buildWatchHistory({ ...movie, media_type: "tv" }, {
    mediaType: "tv", positionSeconds: 42, durationSeconds: 2400, season: 3, episode: 7,
  });
  assert.ok(row);
  assert.equal(row.media_id, "tv_603");
  assert.equal(row.season_number, 3);
  assert.equal(row.episode_number, 7);
});

test("finished titles are detected so they leave Continue Watching", () => {
  assert.equal(isWatchComplete({ progress_seconds: 100, duration_seconds: 100 }), true);
  assert.equal(isWatchComplete({ progress_seconds: 92, duration_seconds: 100 }), true);
  assert.equal(isWatchComplete({ progress_seconds: 91, duration_seconds: 100 }), false);
  assert.equal(isWatchComplete({ progress_seconds: 10, duration_seconds: 0 }), false);
});
