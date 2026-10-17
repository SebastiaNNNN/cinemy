"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { partyFetch } from "@/lib/party-client";
import { validPartyId } from "@/lib/watch-party";

export function PartyInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const userId = user?.id;
  const { language } = useCatalogLanguage();
  const ro = language === "ro-RO";
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && configured && !userId && validPartyId(token)) {
      router.replace(`/account?next=${encodeURIComponent(`/party/invite/${token}`)}`);
    }
  }, [configured, loading, router, token, userId]);

  useEffect(() => {
    if (loading || !userId || !validPartyId(token)) return;
    let active = true;
    void partyFetch<{ partyId: string }>(`/api/party-invites/${token}/join`, "POST")
      .then((result) => { if (active) router.replace(`/party/${result.partyId}`); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [loading, router, token, userId]);

  return <main className="party-waiting-screen">
    <Link className="brand" href="/">CINEMY</Link>
    <span className="party-waiting-kicker">WATCH PARTY</span>
    {!validPartyId(token) ? <h1>{ro ? "Invitație invalidă" : "Invalid invitation"}</h1>
      : !configured ? <h1>{ro ? "Conturile nu sunt configurate" : "Accounts are not configured"}</h1>
        : loading ? <h1>{ro ? "Verificăm contul..." : "Checking your account..."}</h1>
          : !user ? <><h1>{ro ? "Te ducem la autentificare..." : "Taking you to sign in..."}</h1><Link className="button button-primary" href={`/account?next=${encodeURIComponent(`/party/invite/${token}`)}`}>{ro ? "Autentifică-te" : "Sign in"}</Link></> : error ? <>
            <h1>{ro ? "Nu poți intra în party" : "Cannot join party"}</h1>
            <p role="alert">{error}</p>
            <Link className="button button-primary" href="/">← Home</Link>
          </> : <><h1>{ro ? "Intrăm în party..." : "Joining party..."}</h1><span className="party-loading-dots" aria-hidden="true"><i /><i /><i /></span></>}
  </main>;
}
