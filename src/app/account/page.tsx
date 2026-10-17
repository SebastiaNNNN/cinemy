"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { loadWatchHistory, saveWatchProgress } from "@/lib/progress-storage";
import { supabase } from "@/lib/supabase";
import type { WatchHistory } from "@/lib/types";
import { watchHref } from "@/lib/watch-links";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return /^\/(?:w\/[mt][0-9a-z]+|watch-together\/[0-9a-f-]{36}|party\/(?:invite\/)?[0-9a-f-]{36})(?:\?.*)?$/i.test(value) ? value : null;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const accountUserId = user?.id;
  const { language } = useCatalogLanguage();
  const ro = language === "ro-RO";
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<WatchHistory[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [legacyHistory, setLegacyHistory] = useState<WatchHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!accountUserId) return;
    const destination = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
    if (destination) router.replace(destination);
  }, [accountUserId, router]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("cinemy.watch-history.v1") || "[]") as WatchHistory[];
      if (Array.isArray(saved)) {
        setLegacyHistory(saved.filter((item) => /^(movie|tv)_\d+$/.test(item.media_id) && Boolean(item.title)));
      }
    } catch {
      // Old browser storage is optional and never assigned to an account automatically.
    }
  }, []);

  useEffect(() => {
    setHistory([]);
    setHistoryError("");
    if (!user) return;
    let active = true;
    setHistoryLoading(true);
    void loadWatchHistory()
      .then((items) => { if (active) setHistory(items); })
      .catch((reason: Error) => { if (active) setHistoryError(reason.message); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "sign-up") {
        const destination = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/account${destination ? `?next=${encodeURIComponent(destination)}` : ""}` },
        });
        if (authError) throw authError;
        setMessage(data.session
          ? (ro ? "Cont creat. Istoricul tău este acum privat." : "Account created. Your history is now private.")
          : (ro ? "Verifică emailul pentru confirmarea contului, apoi autentifică-te." : "Check your email to confirm your account, then sign in."));
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        setMessage(ro ? "Autentificat." : "Signed in.");
      }
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (ro ? "Autentificarea a eșuat." : "Authentication failed."));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(authError.message);
    else {
      setHistory([]);
      setMessage("");
    }
    setBusy(false);
  };

  const legacyToImport = legacyHistory.filter((item) => !history.some((saved) => saved.media_id === item.media_id));
  const importLegacyHistory = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      for (const item of legacyToImport) await saveWatchProgress(item);
      setHistory(await loadWatchHistory());
      setHistoryError("");
      setMessage(ro ? "Istoricul de pe acest dispozitiv a fost importat." : "History from this device was imported.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`account-page${configured && !loading && !user ? " is-sign-in" : ""}`}>
      <header className="account-header">
        <Link className="brand" href="/">CINEMY</Link>
        <Link href="/">← {ro ? "Înapoi la filme" : "Back to movies"}</Link>
      </header>
      <div className="account-content">
        <p className="account-kicker">CINEMY ACCOUNT</p>
        <h1>{ro ? "Contul tău" : "Your account"}</h1>
        {!configured ? (
          <div className="account-panel">
            <h2>{ro ? "Conturile nu sunt configurate încă" : "Accounts are not configured yet"}</h2>
            <p>{ro
              ? "Adaugă URL-ul proiectului Supabase și cheia publică în .env.local, apoi rulează supabase/schema.sql în SQL Editor."
              : "Add your Supabase project URL and publishable key to .env.local, then run supabase/schema.sql in the SQL Editor."}</p>
          </div>
        ) : loading ? (
          <p className="account-muted">{ro ? "Se verifică sesiunea..." : "Checking your session..."}</p>
        ) : !user ? (
          <div className="account-panel">
            <h2>{mode === "sign-in" ? (ro ? "Autentificare" : "Sign in") : (ro ? "Creează cont" : "Create account")}</h2>
            <p>{ro
              ? "Intră în cont ca să vezi istoricul și să reiei filmele sau episoadele de unde ai rămas."
              : "Sign in to see your history and resume movies or episodes where you left off."}</p>
            <form className="account-form" onSubmit={submit}>
              <label>
                Email
                <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                {ro ? "Parolă" : "Password"}
                <input type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button type="submit" disabled={busy}>{busy ? "..." : mode === "sign-in" ? (ro ? "Intră în cont" : "Sign in") : (ro ? "Creează cont" : "Create account")}</button>
            </form>
            <button className="account-switch" type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); setMessage(""); }}>
              {mode === "sign-in" ? (ro ? "Nu ai cont? Creează unul" : "No account? Create one") : (ro ? "Ai deja cont? Autentifică-te" : "Already have an account? Sign in")}
            </button>
          </div>
        ) : (
          <>
            <div className="account-panel account-profile">
              <div className="account-avatar">{user.email?.charAt(0).toUpperCase() || "C"}</div>
              <div><h2>{user.email}</h2><p>{ro ? "Istoricul este salvat doar în contul tău." : "Watch history is saved only to your account."}</p></div>
              <button type="button" onClick={signOut} disabled={busy}>{ro ? "Ieși din cont" : "Sign out"}</button>
            </div>
            <section className="account-history">
              <h2>{ro ? "Istoric de vizionare" : "Watch history"}</h2>
              {!historyLoading && legacyToImport.length > 0 && (
                <div className="account-import">
                  <p>{ro
                    ? `${legacyToImport.length} titluri au istoric vechi salvat în acest browser. Le poți adăuga în acest cont.`
                    : `${legacyToImport.length} titles have old history saved in this browser. You can add them to this account.`}</p>
                  {!historyError && <button type="button" disabled={busy} onClick={importLegacyHistory}>{ro ? "Importă istoricul" : "Import history"}</button>}
                </div>
              )}
              {historyLoading ? <p className="account-muted">{ro ? "Se încarcă istoricul..." : "Loading history..."}</p>
                : historyError ? <p className="account-error" role="alert">{historyError}</p>
                : history.length === 0 ? <p className="account-muted">{ro ? "Încă nu ai nimic în istoric." : "Your history is empty for now."}</p>
                  : <div className="account-history-grid">
                    {history.map((item) => {
                      const mediaType = item.media_id.startsWith("tv_") ? "tv" : "movie";
                      const id = Number(item.media_id.split("_")[1]);
                      const percent = item.duration_seconds > 0
                        ? Math.min(100, Math.round(item.progress_seconds / item.duration_seconds * 100)) : 0;
                      return <Link key={item.media_id} className="account-history-card" href={watchHref({ id, media_type: mediaType }, item.season_number || 1, item.episode_number || 1)}>
                        {item.poster_path
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt="" loading="lazy" />
                          : <span className="account-poster-placeholder">CINEMY</span>}
                        <strong>{item.title}</strong>
                        <small>{mediaType === "tv" ? `S${item.season_number || 1}:E${item.episode_number || 1} · ` : ""}{percent}%</small>
                        <span className="account-progress"><span style={{ width: `${percent}%` }} /></span>
                      </Link>;
                    })}
                  </div>}
            </section>
          </>
        )}
        {message && <p className="account-notice" role="status">{message}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
