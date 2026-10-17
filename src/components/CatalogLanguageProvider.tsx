"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UI_TEXT } from "@/lib/i18n";
import type { CatalogLanguage, UiText } from "@/lib/i18n";

export type { CatalogLanguage } from "@/lib/i18n";

export const catalogLanguages: Array<{ code: CatalogLanguage; label: string; flag: string }> = [
  { code: "en-US", label: "English", flag: "/flags/gb.svg" },
  { code: "ro-RO", label: "Română", flag: "/flags/ro.svg" },
];

const DEFAULT_LANGUAGE: CatalogLanguage = "en-US";
const STORAGE_KEY = "cinemy_catalog_language";

interface CatalogLanguageContextValue {
  language: CatalogLanguage;
  setLanguage: (language: CatalogLanguage) => void;
  text: UiText;
}

const CatalogLanguageContext = createContext<CatalogLanguageContextValue | null>(null);

function isCatalogLanguage(value: string | null): value is CatalogLanguage {
  return catalogLanguages.some((language) => language.code === value);
}

export function CatalogLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<CatalogLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const storedLanguage = window.localStorage.getItem(STORAGE_KEY);
      if (isCatalogLanguage(storedLanguage)) setLanguageState(storedLanguage);
    } catch {
      // English remains the default when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language.slice(0, 2);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: CatalogLanguage) => {
    setLanguageState(nextLanguage);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // The selector still works for the current session without localStorage.
    }
  }, []);

  const value = useMemo(() => ({ language, setLanguage, text: UI_TEXT[language] }), [language, setLanguage]);

  return (
    <CatalogLanguageContext.Provider value={value}>
      {children}
    </CatalogLanguageContext.Provider>
  );
}

export function useCatalogLanguage() {
  const context = useContext(CatalogLanguageContext);
  if (!context) throw new Error("useCatalogLanguage must be used inside CatalogLanguageProvider");
  return context;
}
