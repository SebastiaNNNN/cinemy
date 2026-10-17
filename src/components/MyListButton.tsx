"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { useMyList } from "@/components/MyListProvider";
import type { Movie } from "@/lib/types";

export function MyListButton({ movie }: { movie: Movie }) {
  const router = useRouter();
  const { user } = useAuth();
  const { text } = useCatalogLanguage();
  const { isSaved, toggle } = useMyList();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saved = isSaved(movie);

  const click = async () => {
    if (!user) {
      router.push("/account");
      return;
    }
    setBusy(true);
    setError("");
    try { await toggle(movie); }
    catch (reason) { setError(reason instanceof Error ? reason.message : text.myListError); }
    finally { setBusy(false); }
  };

  return <span className="my-list-action">
    <button className="button my-list-button" type="button" aria-pressed={saved} disabled={busy} onClick={() => void click()}>
      {saved ? "✓" : "+"} {saved ? text.removeFromList : text.addToList}
    </button>
    {error && <small role="alert">{error}</small>}
  </span>;
}
