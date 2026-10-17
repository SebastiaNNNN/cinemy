import assert from "node:assert/strict";
import test from "node:test";
import { resolveWatchPosition } from "../src/lib/watch-progress";
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
