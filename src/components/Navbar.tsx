"use client";

import Link from "next/link";
import { useState } from "react";

const genres = [
  { label: "Acțiune", id: 28 },
  { label: "Comedie", id: 35 },
  { label: "Dramă", id: 18 },
  { label: "SF", id: 878 },
  { label: "Horror", id: 27 },
  { label: "Thriller", id: 53 },
];

interface NavbarProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function Navbar({ query, onQueryChange }: NavbarProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <header className="navbar">
      <Link className="brand" href="/" aria-label="Cinemy - Acasă">CINEMY</Link>
      <nav className="nav-links" aria-label="Navigație principală">
        <Link href="/">Acasă</Link>
        <Link href="/explore?type=top_rated">Top filme</Link>
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
            onClick={() => setCategoriesOpen((open) => !open)}
          >
            Categorii <span aria-hidden="true">⌄</span>
          </button>
          <div className="genre-menu" role="menu">
            {genres.map((genre) => (
              <Link
                key={genre.id}
                href={`/explore?genre=${genre.id}`}
                role="menuitem"
                onClick={() => setCategoriesOpen(false)}
              >
                {genre.label}<span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Caută filme</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Titlu, actor, gen..."
          autoComplete="off"
        />
      </label>
      <div className="profile-dot" title="Profil personal">S</div>
    </header>
  );
}
