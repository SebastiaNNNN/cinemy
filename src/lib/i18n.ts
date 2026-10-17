export type CatalogLanguage = "en-US" | "ro-RO";

export interface UiText {
  home: string;
  topMovies: string;
  movies: string;
  tvSeries: string;
  myList: string;
  forYou: string;
  nextEpisodeRow: string;
  surpriseMe: string;
  surpriseDescription: string;
  surpriseFormat: string;
  surprisePick: string;
  surpriseAgain: string;
  surpriseYourPick: string;
  surpriseEmpty: string;
  allGenres: string;
  addToList: string;
  removeFromList: string;
  myListEmpty: string;
  myListSignIn: string;
  myListError: string;
  browseMovies: string;
  browseSeries: string;
  categories: string;
  language: string;
  mainNavigation: string;
  searchMovies: string;
  searchSeries: string;
  searchPlaceholder: string;
  personalProfile: string;
  genres: Record<string, string>;
  trendingEyebrow: string;
  recommended: string;
  heroDescription: string;
  watchNow: string;
  moreInfo: string;
  exploreAll: string;
  scrollLeft: (title: string) => string;
  scrollRight: (title: string) => string;
  continueWatching: string;
  continueDescription: string;
  trendingNow: string;
  trendingTv: string;
  topRated: string;
  resultsFor: string;
  noResults: string;
  catalogConfiguration: string;
  loadingSelection: string;
  fallbackTitle: string;
  fallbackOverview: string;
  back: string;
  exploreCatalog: string;
  searchResults: (query: string) => string;
  category: string;
  trending: string;
  loading: string;
  resultCount: (count: number, page: number) => string;
  loadingMovies: string;
  scrollForMore: string;
  pagination: string;
  previous100: string;
  next100: string;
  preparingCatalog: string;
  catalogUnavailable: string;
  poster: string;
  close: string;
  saveAndGoHome: string;
  trailerUnavailable: string;
  noTrailer: string;
  hlsFailed: string;
  hlsUnsupported: string;
  copyLink: string;
  copied: string;
  copyFailed: string;
  loadingMovie: string;
  invalidWatchLink: string;
  movieUnavailable: string;
  backHome: string;
  protectedAction: string;
  season: string;
  episode: string;
  selectEpisode: string;
  playEpisode: string;
  loadingDetails: string;
  detailsUnavailable: string;
  noEpisodes: string;
  nextEpisodeIn: (seconds: number) => string;
  playNext: string;
  titleDetails: string;
  resumePlayback: string;
  nowPlaying: string;
  expandPlayer: string;
  cinematicView: string;
}

export const UI_TEXT: Record<CatalogLanguage, UiText> = {
  "en-US": {
    home: "Home",
    topMovies: "Top Movies",
    movies: "Movies",
    tvSeries: "TV Series",
    myList: "My List",
    forYou: "For You",
    nextEpisodeRow: "Next Episode",
    surpriseMe: "Don't know what to watch?",
    surpriseDescription: "Let Cinemy find a well-rated title you haven't watched yet.",
    surpriseFormat: "Format",
    surprisePick: "Surprise me",
    surpriseAgain: "Try another",
    surpriseYourPick: "YOUR PICK",
    surpriseEmpty: "No fresh suggestion in this selection. Try another genre.",
    allGenres: "All genres",
    addToList: "Add to My List",
    removeFromList: "Remove from My List",
    myListEmpty: "Your list is empty. Open a title and add it here.",
    myListSignIn: "Sign in to save movies and shows to your list.",
    myListError: "Could not update My List.",
    browseMovies: "BROWSE MOVIES",
    browseSeries: "BROWSE TV SERIES",
    categories: "Categories",
    language: "Language",
    mainNavigation: "Main navigation",
    searchMovies: "Search movies",
    searchSeries: "Search TV series",
    searchPlaceholder: "Title, actor, genre...",
    personalProfile: "Personal profile",
    genres: { "28": "Action", "35": "Comedy", "18": "Drama", "80": "Crime", "9648": "Mystery", "878": "Science Fiction", "27": "Horror", "53": "Thriller" },
    trendingEyebrow: "#1 TRENDING THIS WEEK",
    recommended: "Recommended",
    heroDescription: "Discover one of the most watched titles right now.",
    watchNow: "Watch now",
    moreInfo: "More info",
    exploreAll: "Explore all",
    scrollLeft: (title) => `Scroll ${title} left`,
    scrollRight: (title) => `Scroll ${title} right`,
    continueWatching: "Continue Watching",
    continueDescription: "Continue where you left off.",
    trendingNow: "Trending Now",
    trendingTv: "Trending TV Shows",
    topRated: "Top Rated",
    resultsFor: "RESULTS FOR",
    noResults: "No results yet.",
    catalogConfiguration: "The catalog is waiting for the TMDB key.",
    loadingSelection: "Loading your selection...",
    fallbackTitle: "Your library. One screen.",
    fallbackOverview: "Connect TMDB for the online catalog and your video provider for playback.",
    back: "Back",
    exploreCatalog: "EXPLORE THE CATALOG",
    searchResults: (query) => `Results for “${query}”`,
    category: "Category",
    trending: "Trending",
    loading: "Loading...",
    resultCount: (count, page) => `${count} loaded · TMDB page ${page}`,
    loadingMovies: "Loading movies...",
    scrollForMore: "Scroll for more",
    pagination: "Pagination",
    previous100: "Previous 100",
    next100: "Next 100",
    preparingCatalog: "Preparing the catalog...",
    catalogUnavailable: "The catalog is unavailable.",
    poster: "Poster",
    close: "Close",
    saveAndGoHome: "Save progress and go to the main menu",
    trailerUnavailable: "Trailer unavailable",
    noTrailer: "No trailer is available for this title.",
    hlsFailed: "The HLS stream could not be played.",
    hlsUnsupported: "This browser does not support HLS playback.",
    copyLink: "Copy link",
    copied: "Copied!",
    copyFailed: "Could not copy",
    loadingMovie: "Loading movie...",
    invalidWatchLink: "This movie link is invalid",
    movieUnavailable: "This movie is unavailable.",
    backHome: "Back home",
    protectedAction: "This action is disabled.",
    season: "Season",
    episode: "Episode",
    selectEpisode: "Choose an episode",
    playEpisode: "Play episode",
    loadingDetails: "Loading series details...",
    detailsUnavailable: "Series details are unavailable.",
    noEpisodes: "No playable episodes were found.",
    nextEpisodeIn: (seconds) => `Next episode starts in ${seconds}s`,
    playNext: "Play next",
    titleDetails: "Title details",
    resumePlayback: "Resume",
    nowPlaying: "Now playing",
    expandPlayer: "Return to fullscreen",
    cinematicView: "Open cinematic view",
  },
  "ro-RO": {
    home: "Acasă",
    topMovies: "Top filme",
    movies: "Filme",
    tvSeries: "Seriale",
    myList: "Lista mea",
    forYou: "Pentru tine",
    nextEpisodeRow: "Următorul episod",
    surpriseMe: "Nu știi la ce să te uiți?",
    surpriseDescription: "Cinemy îți propune un titlu apreciat pe care nu l-ai văzut încă.",
    surpriseFormat: "Format",
    surprisePick: "Surprinde-mă",
    surpriseAgain: "Încearcă altul",
    surpriseYourPick: "PROPUNEREA TA",
    surpriseEmpty: "Nicio sugestie nouă aici. Încearcă alt gen.",
    allGenres: "Toate genurile",
    addToList: "Adaugă în lista mea",
    removeFromList: "Scoate din lista mea",
    myListEmpty: "Lista ta e goală. Deschide un titlu și adaugă-l aici.",
    myListSignIn: "Autentifică-te ca să salvezi filme și seriale în listă.",
    myListError: "Lista nu a putut fi actualizată.",
    browseMovies: "EXPLOREAZĂ FILME",
    browseSeries: "EXPLOREAZĂ SERIALE",
    categories: "Categorii",
    language: "Limbă",
    mainNavigation: "Navigație principală",
    searchMovies: "Caută filme",
    searchSeries: "Caută seriale",
    searchPlaceholder: "Titlu, actor, gen...",
    personalProfile: "Profil personal",
    genres: { "28": "Acțiune", "35": "Comedie", "18": "Dramă", "80": "Crime", "9648": "Mister", "878": "SF", "27": "Horror", "53": "Thriller" },
    trendingEyebrow: "#1 ÎN TRENDING SĂPTĂMÂNA ACEASTA",
    recommended: "Recomandat",
    heroDescription: "Descoperă unul dintre cele mai urmărite titluri ale momentului.",
    watchNow: "Vizionează acum",
    moreInfo: "Mai multe",
    exploreAll: "Explorează toate",
    scrollLeft: (title) => `Derulează ${title} la stânga`,
    scrollRight: (title) => `Derulează ${title} la dreapta`,
    continueWatching: "Continuă vizionarea",
    continueDescription: "Continuă de unde ai rămas.",
    trendingNow: "În tendințe acum",
    trendingTv: "Seriale în tendințe",
    topRated: "Cele mai apreciate",
    resultsFor: "REZULTATE PENTRU",
    noResults: "Nu am găsit încă rezultate.",
    catalogConfiguration: "Catalogul așteaptă cheia TMDB.",
    loadingSelection: "Se încarcă selecția pentru tine...",
    fallbackTitle: "Biblioteca ta. Un singur ecran.",
    fallbackOverview: "Conectează TMDB pentru catalogul online și providerul tău video pentru redare.",
    back: "Înapoi",
    exploreCatalog: "EXPLOREAZĂ CATALOGUL",
    searchResults: (query) => `Rezultate pentru „${query}”`,
    category: "Categorie",
    trending: "În tendințe",
    loading: "Se încarcă...",
    resultCount: (count, page) => `${count} încărcate · pagina TMDB ${page}`,
    loadingMovies: "Se încarcă filmele...",
    scrollForMore: "Derulează pentru mai multe",
    pagination: "Paginare",
    previous100: "100 anterioare",
    next100: "Următoarele 100",
    preparingCatalog: "Se pregătește catalogul...",
    catalogUnavailable: "Catalogul nu este disponibil.",
    poster: "Poster",
    close: "Închide",
    saveAndGoHome: "Salvează progresul și mergi la meniul principal",
    trailerUnavailable: "Trailer indisponibil",
    noTrailer: "Nu există trailer pentru acest titlu.",
    hlsFailed: "Fluxul HLS nu a putut fi redat.",
    hlsUnsupported: "Browserul nu suportă redarea HLS.",
    copyLink: "Copiază linkul",
    copied: "Copiat!",
    copyFailed: "Nu s-a putut copia",
    loadingMovie: "Se încarcă filmul...",
    invalidWatchLink: "Linkul filmului nu este valid",
    movieUnavailable: "Filmul nu este disponibil.",
    backHome: "Înapoi acasă",
    protectedAction: "Această acțiune este dezactivată.",
    season: "Sezon",
    episode: "Episod",
    selectEpisode: "Alege episodul",
    playEpisode: "Redă episodul",
    loadingDetails: "Se încarcă detaliile serialului...",
    detailsUnavailable: "Detaliile serialului nu sunt disponibile.",
    noEpisodes: "Nu am găsit episoade disponibile.",
    nextEpisodeIn: (seconds) => `Următorul episod începe în ${seconds}s`,
    playNext: "Redă următorul",
    titleDetails: "Detalii titlu",
    resumePlayback: "Continuă",
    nowPlaying: "Acum redai",
    expandPlayer: "Înapoi la ecran complet",
    cinematicView: "Deschide pagina cinematică",
  },
};
