import { WatchTogetherClient } from "@/components/WatchTogetherClient";

export default async function WatchTogetherPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <WatchTogetherClient roomId={roomId} />;
}
