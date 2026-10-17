"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getAccessToken } from "@/lib/auth-token";
import type { Movie, MyListItem } from "@/lib/types";
import { movieTitle } from "@/lib/types";

interface MyListContextValue {
  items: MyListItem[];
  loading: boolean;
  error: string;
  isSaved: (movie: Movie) => boolean;
  toggle: (movie: Movie) => Promise<void>;
  refresh: () => Promise<void>;
}

const MyListContext = createContext<MyListContextValue | null>(null);

function mediaId(movie: Movie) {
  return `${movie.media_type === "tv" ? "tv" : "movie"}_${movie.id}`;
}

async function requestMyList(method: "GET" | "POST" | "DELETE", movie?: Movie) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to use My List.");
  const id = movie ? mediaId(movie) : "";
  const response = await fetch(`/api/my-list${method === "DELETE" ? `?media_id=${encodeURIComponent(id)}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" && movie ? JSON.stringify({
      media_id: id,
      title: movieTitle(movie),
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      vote_average: movie.vote_average || 0,
      release_date: movie.release_date,
      first_air_date: movie.first_air_date,
    }) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as MyListItem & { error?: string };
  if (!response.ok) throw new Error(data.error || "Unable to update My List.");
  return data;
}

export function MyListProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<MyListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeUserIdRef = useRef<string | null>(null);
  activeUserIdRef.current = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await requestMyList("GET");
      if (!Array.isArray(data)) throw new Error("Invalid My List response.");
      if (activeUserIdRef.current === user.id) setItems(data);
    } catch (reason) {
      if (activeUserIdRef.current === user.id) setError(reason instanceof Error ? reason.message : "Unable to load My List.");
    } finally {
      if (activeUserIdRef.current === user.id) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setItems([]);
    setError("");
    if (!authLoading && user) void refresh();
    else setLoading(false);
  }, [authLoading, refresh, user?.id]);

  const isSaved = useCallback((movie: Movie) => items.some((item) => item.media_id === mediaId(movie)), [items]);
  const toggle = useCallback(async (movie: Movie) => {
    if (!user) throw new Error("Sign in to use My List.");
    const id = mediaId(movie);
    const saved = items.some((item) => item.media_id === id);
    setError("");
    try {
      if (saved) {
        await requestMyList("DELETE", movie);
        if (activeUserIdRef.current === user.id) setItems((current) => current.filter((item) => item.media_id !== id));
      } else {
        const added = await requestMyList("POST", movie);
        if (activeUserIdRef.current === user.id) setItems((current) => [added, ...current.filter((item) => item.media_id !== id)]);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to update My List.";
      if (activeUserIdRef.current === user.id) setError(message);
      throw reason;
    }
  }, [items, user]);

  return <MyListContext.Provider value={{ items, loading, error, isSaved, toggle, refresh }}>{children}</MyListContext.Provider>;
}

export function useMyList() {
  const context = useContext(MyListContext);
  if (!context) throw new Error("useMyList must be used inside MyListProvider");
  return context;
}
