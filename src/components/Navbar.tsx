"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { catalogLanguages, useCatalogLanguage } from "@/components/CatalogLanguageProvider";
import { useAuth } from "@/components/AuthProvider";
import { useTmdbGenres } from "@/lib/tmdb-genres";
import { PartyControls } from "@/components/PartyControls";

interface NavbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel?: string;
}

export function Navbar({ query, onQueryChange, searchLabel }: NavbarProps) {
  const pathname = usePathname();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { language, setLanguage, text } = useCatalogLanguage();
  const { genres, error: genreError } = useTmdbGenres(language);
  const { user } = useAuth();
  const accountLabel = language === "ro-RO" ? "Cont" : "Account";
  const currentLanguage = catalogLanguages.find((option) => option.code === language) ?? catalogLanguages[0];

  return (
    <header className="navbar">
      <Link className="brand" href="/" aria-label={`Cinemy - ${text.home}`}>CINEMY</Link>
      <nav className="nav-links" aria-label={text.mainNavigation}>
        <Link href="/">{text.home}</Link>
        <Link href="/movies">{text.movies}</Link>
        <Link href="/series">{text.tvSeries}</Link>
        <Link href="/my-list">{text.myList}</Link>
        <div
          className={`nav-dropdown${categoriesOpen ? " is-open" : ""}`}
          onMouseEnter={() => setCategoriesOpen(true)}
          onMouseLeave={() => setCategoriesOpen(false)}
        >
          <button
            className="categories-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={categoriesOpen}
            onClick={() => {
              setLanguageOpen(false);
              setCategoriesOpen((open) => !open);
            }}
          >
            {text.categories} <span className="dropdown-chevron" aria-hidden="true">⌄</span>
          </button>
          <div className="genre-menu categories-menu" role="menu">
            <Link href="/movies" role="menuitem" onClick={() => setCategoriesOpen(false)}>
              {text.movies}<span aria-hidden="true">›</span>
            </Link>
            <Link href="/series" role="menuitem" onClick={() => setCategoriesOpen(false)}>
              {text.tvSeries}<span aria-hidden="true">›</span>
            </Link>
            <Link href="/my-list" role="menuitem" onClick={() => setCategoriesOpen(false)}>
              {text.myList}<span aria-hidden="true">›</span>
            </Link>
            <span className="genre-menu-divider" aria-hidden="true" />
            {(["movie", "tv"] as const).map((mediaType) => (
              <div className="genre-menu-group" key={mediaType}>
                <span className="genre-menu-label">{mediaType === "movie" ? text.movies : text.tvSeries}</span>
                {genres[mediaType].map((genre) => (
                  <Link
                    key={`${mediaType}_${genre.id}`}
                    href={`/explore?media_type=${mediaType}&genre=${genre.id}`}
                    role="menuitem"
                    onClick={() => setCategoriesOpen(false)}
                  >
                    {genre.name}<span aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>
            ))}
            {genreError && <span className="genre-menu-error">{genreError}</span>}
          </div>
        </div>
        <div
          className={`nav-dropdown language-dropdown${languageOpen ? " is-open" : ""}`}
          onMouseEnter={() => setLanguageOpen(true)}
          onMouseLeave={() => setLanguageOpen(false)}
        >
          <button
            className="categories-trigger language-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={languageOpen}
            onClick={() => {
              setCategoriesOpen(false);
              setLanguageOpen((open) => !open);
            }}
          >
            <Image className="language-flag" src={currentLanguage.flag} alt="" width={20} height={14} aria-hidden="true" />
            {text.language} <span className="dropdown-chevron" aria-hidden="true">⌄</span>
          </button>
          <div className="genre-menu language-menu" role="menu" aria-label="Catalog language">
            {catalogLanguages.map((option) => (
              <button
                key={option.code}
                className={option.code === language ? "is-active" : ""}
                type="button"
                role="menuitem"
                onClick={(event) => {
                  setLanguage(option.code);
                  setLanguageOpen(false);
                  event.currentTarget.blur();
                }}
              >
                <span className="language-option-label">
                  <Image className="language-flag" src={option.flag} alt="" width={20} height={14} aria-hidden="true" />
                  {option.label}
                </span>
                {option.code === language && <span className="language-check" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <label className="search-box desktop-search-box">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">{searchLabel || text.searchMovies}</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={text.searchPlaceholder}
          aria-label={searchLabel || text.searchMovies}
          autoComplete="off"
        />
      </label>
      <button className="tv-search-trigger" type="button" onClick={() => setSearchOpen(true)}>
        <span aria-hidden="true">⌕</span> {searchLabel || text.searchMovies}
      </button>
      <PartyControls />
      <Link className="profile-dot" href="/account" title={accountLabel} aria-label={accountLabel}>
        {user?.email?.charAt(0).toUpperCase() || "S"}
      </Link>

      <nav className="mobile-bottom-nav" aria-label={text.mainNavigation}>
        <Link className={pathname === "/" ? "is-active" : ""} href="/">
          <span aria-hidden="true">⌂</span><small>{text.home}</small>
        </Link>
        <Link className={pathname === "/movies" ? "is-active" : ""} href="/movies">
          <span aria-hidden="true">▣</span><small>{text.movies}</small>
        </Link>
        <Link className={pathname === "/series" ? "is-active" : ""} href="/series">
          <span aria-hidden="true">▤</span><small>{text.tvSeries}</small>
        </Link>
        <Link className={pathname === "/my-list" ? "is-active" : ""} href="/my-list">
          <span aria-hidden="true">＋</span><small>{text.myList}</small>
        </Link>
        <button className={searchOpen || query ? "is-active" : ""} type="button" onClick={() => setSearchOpen(true)}>
          <span aria-hidden="true">⌕</span><small>{text.searchMovies}</small>
        </button>
        <Link className={pathname === "/account" ? "is-active" : ""} href="/account">
          <span aria-hidden="true">◉</span><small>{accountLabel}</small>
        </Link>
      </nav>

      {searchOpen && (
        <div className="responsive-search-overlay" role="dialog" aria-modal="true" aria-label={searchLabel || text.searchMovies}>
          <button className="responsive-search-close" type="button" onClick={() => setSearchOpen(false)} aria-label={text.close}>×</button>
          <div className="responsive-search-panel">
            <span className="responsive-search-kicker">CINEMY</span>
            <label>
              <span aria-hidden="true">⌕</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setSearchOpen(false);
                  if (event.key === "Escape") setSearchOpen(false);
                }}
                placeholder={text.searchPlaceholder}
                aria-label={searchLabel || text.searchMovies}
                autoComplete="off"
              />
            </label>
            <p>{searchLabel || text.searchMovies} · Enter</p>
          </div>
        </div>
      )}
    </header>
  );
}
