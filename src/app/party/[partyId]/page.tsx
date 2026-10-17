import { PartyGuestClient } from "@/components/PartyGuestClient";

export default async function PartyPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  return <PartyGuestClient partyId={partyId} />;
}
