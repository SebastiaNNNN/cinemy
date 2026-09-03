"use client";

interface NavbarProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function Navbar({ query, onQueryChange }: NavbarProps) {
  return (
    <header className="navbar">
      <a className="brand" href="#top" aria-label="Cinemy - Acasă">CINEMY</a>
      <nav className="nav-links" aria-label="Navigație principală">
        <a href="#trending">Acasă</a>
        <a href="#top-rated">Top filme</a>
        <a href="#categories">Categorii</a>
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
