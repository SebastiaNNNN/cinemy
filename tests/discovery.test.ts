import assert from "node:assert/strict";
import test from "node:test";
import { mergeRecommendations, nextEpisodeFromHistory, recommendationSeeds } from "../src/lib/discovery";
import type { Movie, WatchHistory } from "../src/lib/types";

const movie = (id: number, media_type: "movie" | "tv" = "movie"): Movie => ({
  id, media_type, title: `Title ${id}`, overview: "", poster_path: "/poster.jpg", backdrop_path: null, vote_average: 8,
});

test("recommendations mix seeds, omit watched titles and deduplicate", () => {
  const merged = mergeRecommendations([[movie(1), movie(3)], [movie(2, "tv"), movie(3)]], new Set(["movie_1"]));
  assert.deepEqual(merged.map((item) => `${item.media_type}_${item.id}`), ["tv_2", "movie_3"]);
});

test("recommendation seeds stay unique and valid", () => {
  assert.deepEqual(recommendationSeeds([{ media_id: "tv_2" } as WatchHistory], ["movie_1", "tv_2", "bad"]), ["movie_1", "tv_2"]);
});

test("next episode appears only near the end and crosses seasons", () => {
  const saved = { media_id: "tv_2", season_number: 1, episode_number: 2, progress_seconds: 850, duration_seconds: 1000 } as WatchHistory;
  const seasons = [
    { id: 1, name: "One", season_number: 1, episode_count: 2, poster_path: null },
    { id: 2, name: "Two", season_number: 2, episode_count: 3, poster_path: null },
  ];
  assert.deepEqual(nextEpisodeFromHistory(saved, seasons), { season: 2, episode: 1 });
  assert.equal(nextEpisodeFromHistory({ ...saved, progress_seconds: 400 }, seasons), null);
});
