"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { useParty } from "@/components/PartyProvider";
import { PARTY_CAPACITY } from "@/lib/watch-party";

interface InviteView { url: string; expiresAt: string }

export function PartyControls() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useCatalogLanguage();
  const ro = language === "ro-RO";
  const { party, busy, error, clearError, createInvite, endParty } = useParty();
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const remaining = invite ? Math.max(0, Math.ceil((Date.parse(invite.expiresAt) - now) / 1000)) : 0;

  useEffect(() => {
    if (!open || !invite) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [invite, open]);

  const inviteGuest = async () => {
    if (!user) { router.push("/account"); return; }
    setOpen(true);
    clearError();
    setCopied(false);
    try {
      const created = await createInvite();
      setInvite({ url: `${window.location.origin}/party/invite/${created.token}`, expiresAt: created.expires_at });
      setNow(Date.now());
    } catch { /* Error appears in the popover. */ }
  };

  const copyInvite = async () => {
    if (!invite || remaining <= 0) return;
    try { await navigator.clipboard.writeText(invite.url); setCopied(true); }
    catch { setCopied(false); }
  };

  return <div className="party-control-wrap">
    <div className={`party-slots${party ? " is-active" : ""}`} aria-label={ro ? "Lobby-ul tău" : "Your party lobby"}>
      <button className="party-host-slot" type="button" title={ro ? "Gazda party-ului" : "Party host"} onClick={() => setOpen((value) => !value)}>
        {user?.email?.charAt(0).toUpperCase() || "S"}
      </button>
      {Array.from({ length: PARTY_CAPACITY }, (_, index) => index < (party?.member_count || 0)
        ? <span className="party-guest-slot is-joined" key={index} title={ro ? `Invitat ${index + 1}` : `Guest ${index + 1}`}>●</span>
        : <button className="party-guest-slot" key={index} type="button" disabled={busy} title={ro ? "Invită un prieten" : "Invite a friend"} onClick={() => void inviteGuest()}>+</button>)}
    </div>
    {open && <div className="party-popover" role="dialog" aria-label={ro ? "Invitații party" : "Party invitations"}>
      <button className="party-popover-close" type="button" aria-label={ro ? "Închide" : "Close"} onClick={() => setOpen(false)}>×</button>
      <span className="party-popover-kicker">CINEMY PARTY</span>
      <h2>{party ? (ro ? "Lobby-ul tău" : "Your lobby") : (ro ? "Priviți împreună" : "Watch together")}</h2>
      <p>{ro ? "Tu alegi filmul. Prietenii așteaptă în lobby până pornești ceva." : "You pick the title. Friends wait in the lobby until you start watching."}</p>
      {invite && remaining > 0 && <div className="party-invite-box">
        <span>{ro ? `Invitația expiră în ${remaining}s` : `Invite expires in ${remaining}s`}</span>
        <input readOnly value={invite.url} aria-label={ro ? "Link invitație" : "Invite link"} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" onClick={() => void copyInvite()}>{copied ? (ro ? "✓ Copiat" : "✓ Copied") : (ro ? "Copiază linkul" : "Copy invite link")}</button>
      </div>}
      {invite && remaining === 0 && <p className="party-expired">{ro ? "Linkul a expirat. Generează unul nou." : "Invite expired. Generate a new one."}</p>}
      <button className="party-new-invite" type="button" disabled={busy || (party?.member_count || 0) >= PARTY_CAPACITY} onClick={() => void inviteGuest()}>
        {busy ? "..." : ro ? "+ Generează invitație (2 min)" : "+ Generate 2-minute invite"}
      </button>
      {party && <button className="party-end" type="button" disabled={busy} onClick={() => void endParty().then(() => { setInvite(null); setOpen(false); }).catch(() => {})}>
        {ro ? "Închide party-ul" : "End party"}
      </button>}
      {error && <p className="party-control-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
