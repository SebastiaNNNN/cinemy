# Cinemy

Aplicație locală Next.js 16 pentru catalog TMDB, player video configurabil și progres sincronizat prin Supabase. Necesită Node.js 20.9 sau mai nou.

## Pornire locală

1. Copiază `.env.example` ca `.env.local` și completează valorile.
2. Rulează `npm ci`.
3. Rulează `npm run dev`.
4. Deschide `http://localhost:3000`.

Rulează `supabase/schema.sql` o singură dată în SQL Editor din proiectul Supabase.

Providerul configurat prin `NEXT_PUBLIC_STREAM_BASE_URL` trebuie să fie unul pe care ai dreptul să îl folosești.

## Încărcare pe GitHub

Încarcă numai sursele proiectului, fără `.env.local`, `node_modules`, `.next`, cache-uri sau fișiere de debug. `.env.example` conține doar numele variabilelor. După clonare, fiecare instalare își creează propriul `.env.local` și rulează `npm ci`.

Cheia Supabase **publishable** poate exista în codul client, dar cheia **service-role/secret** nu trebuie pusă niciodată acolo. Pentru datele conturilor, aplică politicile RLS din `supabase/schema.sql` înainte să folosești aplicația cu utilizatori reali.

## Watch Together

Rulează din nou `supabase/schema.sql` în Supabase SQL Editor pentru a crea camerele, politicile RLS și abonarea Realtime. Gazda creează camera din meniul de distribuire al playerului, apoi copiază linkul camerei. Invitații trebuie să fie autentificați; numai gazda poate modifica redarea pentru toți. Camera expiră după 24 de ore.

Sursa video actuală este un iframe extern. La pauză, Cinemy oprește iframe-ul; la reluare îl reîncarcă de la secunda salvată. Sincronizarea este aproximativă și autoplay-ul poate fi limitat de browser sau de furnizor. Un invitat își poate opri local propriul iframe, dar nu poate pune camera tuturor pe pauză.

## Party lobby

Rulează din nou `supabase/schema.sql` pentru tabelele de party și invitații. În bara de navigare, gazda apasă `+` lângă profil pentru a crea lobby-ul și un link de invitație valabil două minute. Pot intra cel mult patru invitați autentificați. Gazda nu poate folosi propriul link; invitații care s-au alăturat rămân în party după expirarea invitației.

Când gazda deschide un film sau episod, invitații trec automat de la ecranul de așteptare la player. Pagina cinematică pune party-ul pe pauză, iar revenirea la catalog readuce ecranul de așteptare. Gazda poate închide party-ul din meniul de lângă profil. Sincronizarea rămâne aproximativă din cauza iframe-ului extern.
