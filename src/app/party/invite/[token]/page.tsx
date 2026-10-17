import { PartyInviteClient } from "@/components/PartyInviteClient";

export default async function PartyInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PartyInviteClient token={token} />;
}
