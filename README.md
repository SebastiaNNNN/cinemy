# Cinemy

Aplicație locală Next.js pentru catalog TMDB, player video configurabil și progres sincronizat prin Supabase.

## Pornire locală

1. Copiază `.env.example` ca `.env.local` și completează valorile.
2. Rulează `npm install`.
3. Rulează `npm run dev`.
4. Deschide `http://localhost:3000`.

Rulează `supabase/schema.sql` o singură dată în SQL Editor din proiectul Supabase.

Providerul configurat prin `NEXT_PUBLIC_STREAM_BASE_URL` trebuie să fie unul pe care ai dreptul să îl folosești.
