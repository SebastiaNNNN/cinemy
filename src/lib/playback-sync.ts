/**
 * Shared playback clock used by watch rooms and party lobbies.
 *
 * Realtime events and polling both deliver the same row, so updates can arrive
 * out of order: a slow HTTP response may land after a newer Realtime event.
 * These helpers keep every viewer on the same timeline regardless of order.
 */

/** The fields that describe where a shared playback is and when it changed. */
export interface PlaybackClock {
  playback_revision: number;
  updated_at: string;
}

/**
 * True when `next` is older than `previous` and must be ignored so a late event
 * cannot rewind playback for everyone. A higher revision always wins; within
 * the same revision the newest timestamp wins.
 */
export function isStalePlaybackUpdate(next: PlaybackClock, previous: PlaybackClock): boolean {
  if (next.playback_revision !== previous.playback_revision) {
    return next.playback_revision < previous.playback_revision;
  }
  const nextUpdatedAt = Date.parse(next.updated_at);
  const previousUpdatedAt = Date.parse(previous.updated_at);
  if (!Number.isFinite(nextUpdatedAt) || !Number.isFinite(previousUpdatedAt)) return false;
  return nextUpdatedAt < previousUpdatedAt;
}

/**
 * Where a shared playback should be right now, given the position stored on the
 * server at `updatedAt`. A playing timeline advances with real time; a paused
 * one stays frozen so late joiners always land on the host's second.
 */
export function expectedPositionSeconds(
  positionSeconds: number,
  updatedAt: string,
  isPlaying: boolean,
  now = Date.now(),
): number {
  const base = Number.isFinite(positionSeconds) && positionSeconds > 0 ? positionSeconds : 0;
  if (!isPlaying) return Math.floor(base);
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) return Math.floor(base);
  const elapsed = Math.max(0, (now - updatedAtMs) / 1000);
  return Math.max(0, Math.floor(base + elapsed));
}

/**
 * How far a viewer is from the shared timeline. Positive means the viewer is
 * ahead of everyone else, negative means they are behind.
 */
export function positionDrift(localSeconds: number, expectedSeconds: number): number {
  if (!Number.isFinite(localSeconds) || !Number.isFinite(expectedSeconds)) return 0;
  return localSeconds - expectedSeconds;
}
