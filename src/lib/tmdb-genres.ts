"use client";

import { useEffect, useState } from "react";
import type { CatalogLanguage } from "./i18n";
import type { MediaType } from "./types";

export interface TmdbGenre { id: number; name: string }
export type GenreCatalog = Record<MediaType, TmdbGenre[]>;

const cache = new Map<CatalogLanguage, GenreCatalog>();
const pending = new Map<CatalogLanguage, Promise<GenreCatalog>>();
const empty: GenreCatalog = { movie: [], tv: [] };

function loadGenres(language: CatalogLanguage): Promise<GenreCatalog> {
  const cached = cache.get(language);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(language);
  if (inFlight) return inFlight;
  const promise = fetch(`/api/genres?language=${language}`)
    .then(async (response) => {
      const data = await response.json() as GenreCatalog & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load genres.");
      cache.set(language, data);
      return data;
    })
    .finally(() => pending.delete(language));
  pending.set(language, promise);
  return promise;
}

export function useTmdbGenres(language: CatalogLanguage) {
  const [state, setState] = useState<{ language: CatalogLanguage; genres: GenreCatalog; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    void loadGenres(language)
      .then((genres) => { if (active) setState({ language, genres, error: "" }); })
      .catch((reason: Error) => { if (active) setState({ language, genres: empty, error: reason.message }); });
    return () => { active = false; };
  }, [language]);
  return state?.language === language ? state : { language, genres: cache.get(language) ?? empty, error: "" };
}
