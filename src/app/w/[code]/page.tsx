import { WatchClient } from "@/components/WatchClient";

export default async function WatchPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ s?: string; e?: string }> }) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const season = resolvedSearchParams.s ? Math.max(1, Number.parseInt(resolvedSearchParams.s, 10) || 1) : undefined;
  const episode = resolvedSearchParams.e ? Math.max(1, Number.parseInt(resolvedSearchParams.e, 10) || 1) : undefined;
  return <WatchClient code={resolvedParams.code} initialSeason={season} initialEpisode={episode} />;
}
