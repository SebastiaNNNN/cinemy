import "server-only";

const TORBOX_API = "https://api.torbox.app/v1/api";

export interface TorBoxFile {
  id: number;
  name: string;
  size: number;
}

export interface TorBoxTorrent {
  id: number;
  name: string;
  downloadState: string;
  files: TorBoxFile[];
}

function token() {
  const value = process.env.TORBOX_API_TOKEN?.trim();
  if (!value) throw new Error("TORBOX_API_TOKEN is not configured");
  return value;
}

async function torBoxFetch(path: string) {
  const response = await fetch(`${TORBOX_API}${path}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; detail?: string; data?: unknown } | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.detail || `TorBox request failed (${response.status})`);
  }
  return payload.data;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getTorBoxLibrary(): Promise<TorBoxTorrent[]> {
  const raw = await torBoxFetch("/torrents/mylist?limit=1000") as unknown;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  return list.map((entry) => {
    const item = entry as Record<string, unknown>;
    const rawFiles = Array.isArray(item.files) ? item.files : [];
    return {
      id: asNumber(item.id ?? item.torrent_id),
      name: String(item.name ?? item.torrent_name ?? "Untitled"),
      downloadState: String(item.download_state ?? item.status ?? ""),
      files: rawFiles.map((file, index) => {
        const value = file as Record<string, unknown>;
        return {
          id: asNumber(value.id ?? value.file_id ?? index),
          name: String(value.name ?? value.short_name ?? value.path ?? `File ${index + 1}`),
          size: asNumber(value.size ?? value.filesize),
        };
      }),
    };
  }).filter((item) => item.id > 0);
}

const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|mkv|avi|mov|ts|m2ts)$/i;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function episodeMatches(name: string, season: number, episode: number) {
  return [
    new RegExp(`s0?${season}e0?${episode}(?:\\D|$)`, "i"),
    new RegExp(`(?:^|\\D)0?${season}x0?${episode}(?:\\D|$)`, "i"),
    new RegExp(`season\\D*0?${season}.*episode\\D*0?${episode}`, "i"),
  ].some((pattern) => pattern.test(name));
}

export async function resolveTorBoxMedia(input: {
  title: string;
  year?: string;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
}) {
  const library = await getTorBoxLibrary();
  const normalizedTitle = normalize(input.title);
  const titleWords = normalizedTitle.split(" ").filter((word) => word.length > 2);
  const candidates: Array<{ torrent: TorBoxTorrent; file: TorBoxFile; score: number }> = [];

  for (const torrent of library) {
    for (const file of torrent.files.filter((item) => VIDEO_EXTENSIONS.test(item.name))) {
      const rawName = `${torrent.name} ${file.name}`;
      const haystack = normalize(rawName);
      const matchedWords = titleWords.filter((word) => haystack.includes(word)).length;
      let score = titleWords.length ? (matchedWords / titleWords.length) * 100 : 0;
      if (haystack.includes(normalizedTitle)) score += 100;
      if (input.year && haystack.includes(input.year)) score += 15;
      if (input.mediaType === "tv") {
        if (!episodeMatches(rawName, input.season || 1, input.episode || 1)) continue;
        score += 120;
      }
      score += Math.min(file.size / 1_000_000_000, 20);
      if (matchedWords > 0) candidates.push({ torrent, file, score });
    }
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 55 ? best : null;
}

export async function requestTorBoxDownload(torrentId: number, fileId: number) {
  const accessToken = token();
  const params = new URLSearchParams({
    token: accessToken,
    torrent_id: String(torrentId),
    file_id: String(fileId),
    redirect: "false",
  });
  const response = await fetch(`${TORBOX_API}/torrents/requestdl?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    detail?: string;
    data?: string | { url?: string; link?: string };
  } | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.detail || `TorBox download request failed (${response.status})`);
  }
  const url = typeof payload.data === "string" ? payload.data : payload.data?.url || payload.data?.link;
  if (!url || !/^https:\/\//i.test(url)) throw new Error("TorBox did not return a playable URL");
  return url;
}
