"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteDoc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { entries, sourceCount, totalRuntime, type WatchEntry } from "./data";
import { episodeMetadata } from "./episode-metadata";
import { episodeMetadataOverrides, metadataKey, metadataOverrides, normalizeGenres } from "./metadata-overrides";
import { achievementData, divisionFor, franchiseFor, infinityStones, orderEntries, presetMatches, searchCreditsFor, upcomingProjects, yearFor, type Profile, type UpcomingProject, type WatchOrder } from "./catalog";
import { archiveDocument, auth, signInWithGoogle, signOutGoogle } from "./firebase";

type View = "archive" | "analytics" | "timeline" | "history" | "settings";
type Filter = "all" | "movie" | "episode" | "special" | "short" | "remaining" | "favorites";
type Scope = "completionist" | "official";

const STORAGE_KEY = "infinity-archive-progress-v1";
// Bump when the resolver changes so inaccurate cached records are discarded.
const DETAILS_KEY = "infinity-archive-details-v5";
const HISTORY_KEY = "infinity-archive-history-v1";
const SPOILER_KEY = "infinity-archive-hide-spoilers";
const HIDE_WATCHED_KEY = "infinity-archive-hide-watched";
const PROFILES_KEY = "infinity-archive-profiles-v1";
const ACTIVE_PROFILE_KEY = "infinity-archive-active-profile-v1";
const DELETED_PROFILES_KEY = "infinity-archive-deleted-profiles-v1";
const APP_VERSION = "2.4.0";
const METADATA_VERSION = "2026.07.21-v14.1";
const ACHIEVEMENTS_SEEN_KEY = "infinity-archive-achievements-seen-v1";
const posterCache = new Map<string, string | null>();
type MediaDetails = { episodeTitle?: string; releaseDate?: string; genres?: string[]; cast?: string[]; description?: string };
const detailsCache = new Map<string, MediaDetails>();
const titleColors = [
  ["#6f1520", "#151c2a"], ["#283b59", "#111827"], ["#6f4c20", "#15120d"],
  ["#293f36", "#0d1714"], ["#42305f", "#110f1b"], ["#4d2732", "#151015"],
];

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function posterStyle(title: string) {
  const hash = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [a, b] = titleColors[hash % titleColors.length];
  return { background: `radial-gradient(circle at 68% 28%, ${a} 0, transparent 38%), linear-gradient(145deg, ${b}, #05070b 78%)` };
}

function trailerUrl(title: string) {
  if (metadataOverrides[title]?.trailer) return metadataOverrides[title].trailer!;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer Marvel`)}`;
}

function withOverride(entry: WatchEntry, details: MediaDetails): MediaDetails {
  const override = episodeMetadataOverrides[metadataKey(entry.collection, entry.season, entry.episode)] || metadataOverrides[entry.collection] || {};
  return { ...details, episodeTitle: override.title || details.episodeTitle, releaseDate: override.releaseDate || details.releaseDate, genres: normalizeGenres(override.genres || details.genres), cast: override.cast || details.cast, description: override.description || details.description };
}

function cleanMarkup(value?: string | null) {
  if (!value) return undefined;
  const document = new DOMParser().parseFromString(value, "text/html");
  return document.body.textContent?.trim() || undefined;
}

function miniSynopsis(value?: string, limit = 680) {
  if (!value) return undefined;
  const cleaned = value.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= limit) return cleaned;
  const excerpt = cleaned.slice(0, limit + 1);
  const sentenceEnd = Math.max(excerpt.lastIndexOf(". "), excerpt.lastIndexOf("! "), excerpt.lastIndexOf("? "));
  return `${excerpt.slice(0, sentenceEnd > limit * .55 ? sentenceEnd + 1 : limit).trim()}…`;
}

function displayDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function watchedTimestamp(date: string) { return `${date}T12:00:00`; }
function displayWatchedDate(value: string) { return new Date(value.length === 10 ? watchedTimestamp(value) : value).toLocaleDateString(); }

const themes = [
  { id: "infinity", name: "Infinity Archive Gold" }, { id: "tva", name: "TVA Amber" },
  { id: "wakanda", name: "Wakandan Violet" }, { id: "stark", name: "Stark Interface Blue" },
  { id: "scarlet", name: "Scarlet Cosmic Red" },
] as const;
type Theme = typeof themes[number]["id"];
type ActivityEvent = { id: string; at: string; type: "viewed" | "edited" };
type SyncStatus = "local" | "connecting" | "syncing" | "synced" | "offline" | "error";
type CloudArchive = {
  schemaVersion: 4;
  appVersion: string;
  updatedAt: string;
  activeProfileId: string;
  profiles: Profile[];
  deletedProfiles?: Record<string, string>;
  preferences: { hideSpoilers: boolean; hideWatched: boolean };
};

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

function mergeProfile(local: Profile, cloud: Profile): Profile {
  const localWins = (local.updatedAt || "") >= (cloud.updatedAt || "");
  const newest = localWins ? local : cloud;
  return {
    ...newest,
    completed: [...new Set([...local.completed, ...cloud.completed])],
    history: uniqueBy([...local.history, ...cloud.history], (event) => `${event.id}|${event.at}`).sort((a, b) => a.at.localeCompare(b.at)),
    activity: uniqueBy([...(local.activity || []), ...(cloud.activity || [])], (event) => `${event.id}|${event.type}|${event.at}`).sort((a, b) => a.at.localeCompare(b.at)).slice(-250),
    createdAt: [local.createdAt, cloud.createdAt].filter(Boolean).sort()[0] || newest.createdAt,
    updatedAt: [local.updatedAt, cloud.updatedAt].filter(Boolean).sort().at(-1) || newest.updatedAt,
  };
}

function mergeArchives(local: CloudArchive, cloud: CloudArchive): CloudArchive {
  const deletedProfiles = { ...(cloud.deletedProfiles || {}), ...(local.deletedProfiles || {}) };
  const byId = new Map(local.profiles.map((profile) => [profile.id, profile]));
  cloud.profiles.forEach((profile) => {
    const existing = byId.get(profile.id);
    byId.set(profile.id, existing ? mergeProfile(existing, profile) : profile);
  });
  const profiles = [...byId.values()].filter((profile) => !deletedProfiles[profile.id] || deletedProfiles[profile.id] < profile.updatedAt);
  const localWins = local.updatedAt >= cloud.updatedAt;
  const preferredActive = localWins ? local.activeProfileId : cloud.activeProfileId;
  return {
    ...(localWins ? local : cloud),
    schemaVersion: 4,
    appVersion: APP_VERSION,
    updatedAt: new Date().toISOString(),
    profiles,
    deletedProfiles,
    activeProfileId: profiles.some((profile) => profile.id === preferredActive) ? preferredActive : profiles[0]?.id || "default",
  };
}

function archiveFingerprint(archive: CloudArchive) {
  return JSON.stringify({ ...archive, updatedAt: "" });
}

async function wikidataLabels(ids: string[]) {
  if (!ids.length) return [];
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=labels&languages=en&format=json&origin=*`;
  const data = await fetch(url).then((response) => response.json());
  return ids.map((id) => data.entities?.[id]?.labels?.en?.value).filter(Boolean);
}

async function resolveWikipediaTitle(entry: WatchEntry) {
  const query = encodeURIComponent(`"${entry.collection}" Marvel ${entry.kind === "movie" ? "film" : "special"}`);
  const data = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&srlimit=8&format=json&origin=*`).then((response) => response.json());
  const target = entry.collection.toLowerCase();
  const results = (data.query?.search || []) as Array<{ title: string; snippet?: string }>;
  const score = (result: { title: string; snippet?: string }) => {
    const title = result.title.toLowerCase(); const snippet = cleanMarkup(result.snippet)?.toLowerCase() || "";
    let points = title === target ? 12 : title.startsWith(`${target} (`) ? 15 : title.includes(target) ? 5 : 0;
    if (/\bfilm\b/.test(title)) points += 7;
    if (/marvel|cinematic universe|superhero/.test(snippet)) points += 5;
    if (/soundtrack|character|armor|comic|disambiguation|video game/.test(title)) points -= 25;
    return points;
  };
  return results.sort((a, b) => score(b) - score(a))[0]?.title || entry.collection;
}

async function fetchPlotSynopsis(pageTitle: string, fallback?: string) {
  try {
    const sectionsData = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=sections&format=json&origin=*`).then((response) => response.json());
    const sections = (sectionsData.parse?.sections || []) as Array<{ index: string; line: string }>;
    const section = sections.find((item) => /^(plot|premise|synopsis|summary)$/i.test(cleanMarkup(item.line) || ""));
    if (!section) return miniSynopsis(fallback);
    const plotData = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&section=${section.index}&prop=text&format=json&origin=*`).then((response) => response.json());
    const html = plotData.parse?.text?.["*"];
    if (!html) return miniSynopsis(fallback);
    const document = new DOMParser().parseFromString(html, "text/html");
    const paragraphs = [...document.querySelectorAll("p")].map((paragraph) => paragraph.textContent?.trim()).filter(Boolean).slice(0, 3).join(" ");
    return miniSynopsis(paragraphs || fallback);
  } catch { return miniSynopsis(fallback); }
}

async function fetchFilmDetails(entry: WatchEntry): Promise<MediaDetails> {
  const pageTitle = await resolveWikipediaTitle(entry);
  const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`).then((response) => response.json());
  const description = await fetchPlotSynopsis(pageTitle, summary.extract);
  const itemId = summary.wikibase_item;
  if (!itemId) return withOverride(entry, { description });
  const entityData = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${itemId}.json`).then((response) => response.json());
  const claims = entityData.entities?.[itemId]?.claims || {};
  const ids = (property: string, limit: number) => (claims[property] || []).map((claim: { mainsnak?: { datavalue?: { value?: { id?: string } } } }) => claim.mainsnak?.datavalue?.value?.id).filter(Boolean).slice(0, limit);
  const releaseDate = claims.P577?.[0]?.mainsnak?.datavalue?.value?.time?.replace(/^\+/, "").slice(0, 10);
  const [genres, cast] = await Promise.all([wikidataLabels(ids("P136", 3)), wikidataLabels(ids("P161", 3))]);
  return withOverride(entry, { releaseDate, genres, cast, description });
}

async function fetchEpisodeDetails(entry: WatchEntry): Promise<MediaDetails> {
  const details = episodeMetadata[metadataKey(entry.collection, entry.season, entry.episode)] || {};
  return withOverride(entry, { ...details, description: miniSynopsis(details.description) });
}

function useMediaDetails(entry?: WatchEntry) {
  const [details, setDetails] = useState<MediaDetails | undefined>(() => entry ? detailsCache.get(entry.id) : undefined);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!entry) return;
    let active = true;
    const saved = (() => { try { return JSON.parse(localStorage.getItem(DETAILS_KEY) || "{}")[entry.id] as MediaDetails | undefined; } catch { return undefined; } })();
    const cached = detailsCache.get(entry.id) || saved;
    if (cached) {
      // Saved metadata may predate a hand-reviewed correction. Always reapply
      // the current override before rendering instead of trusting it verbatim.
      const corrected = withOverride(entry, cached);
      detailsCache.set(entry.id, corrected);
      try { const all = JSON.parse(localStorage.getItem(DETAILS_KEY) || "{}"); all[entry.id] = corrected; localStorage.setItem(DETAILS_KEY, JSON.stringify(all)); } catch { /* cache is optional */ }
      queueMicrotask(() => active && setDetails(corrected));
      return () => { active = false; };
    }
    queueMicrotask(() => active && setLoading(true));
    (entry.kind === "episode" ? fetchEpisodeDetails(entry) : fetchFilmDetails(entry)).then((result) => {
      detailsCache.set(entry.id, result);
      try { const all = JSON.parse(localStorage.getItem(DETAILS_KEY) || "{}"); all[entry.id] = result; localStorage.setItem(DETAILS_KEY, JSON.stringify(all)); } catch { /* cache is optional */ }
      if (active) setDetails(result);
    }).catch(() => { if (active) setDetails(withOverride(entry, {})); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [entry]);
  return { details, loading };
}

function PosterArt({ title, hero = false }: { title: string; hero?: boolean }) {
  const [src, setSrc] = useState<string | null | undefined>(() => posterCache.get(title));
  useEffect(() => {
    let active = true;
    if (posterCache.has(title)) return () => { active = false; };
    const likelySeries = entries.some((entry) => entry.collection === title && entry.kind === "episode");
    const candidates = [title, `${title} (${likelySeries ? "TV series" : "film"})`, `${title} (Marvel Cinematic Universe)`];
    (async () => {
      for (const candidate of candidates) {
        try {
          const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`);
          if (!response.ok) continue;
          const data = await response.json();
          const image = data.originalimage?.source || data.thumbnail?.source;
          if (image) { posterCache.set(title, image); if (active) setSrc(image); return; }
        } catch { /* use the designed fallback */ }
      }
      posterCache.set(title, null); if (active) setSrc(null);
    })();
    return () => { active = false; };
  }, [title]);
  if (hero) return src ? <img className="hero-art" src={src} alt="" /> : null;
  return <span className={`mini-poster ${src ? "has-art" : ""}`} style={src ? undefined : posterStyle(title)}>
    {src ? <img src={src} alt={`${title} poster artwork`} loading="lazy" /> : <b>{title.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}</b>}
  </span>;
}

function Icon({ name }: { name: "check" | "search" | "chevron" | "download" | "upload" | "menu" | "play" }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5" /><path d="M5 20h14" /></>,
    upload: <><path d="M12 16V4m0 0 5 5m-5-5L7 9" /><path d="M5 20h14" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function ProgressRing({ value }: { value: number }) {
  return <div className="progress-ring" style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}><div><strong>{Math.round(value)}%</strong><span>complete</span></div></div>;
}

function DetailDrawer({ entry, completed, hideSpoilers, rating, favorite, note, watchDates, onClose, onToggle, onRating, onFavorite, onNote, onWatchedDate, onRewatch }: { entry?: WatchEntry; completed: boolean; hideSpoilers: boolean; rating: number; favorite: boolean; note: string; watchDates: string[]; onClose: () => void; onToggle: () => void; onRating: (value: number) => void; onFavorite: () => void; onNote: (value: string) => void; onWatchedDate: (value: string) => void; onRewatch: (value: string) => void }) {
  const { details, loading } = useMediaDetails(entry);
  const [rewatchDate, setRewatchDate] = useState(localDateKey());
  useEffect(() => {
    if (!entry) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.classList.add("drawer-open"); document.addEventListener("keydown", close);
    return () => { document.body.classList.remove("drawer-open"); document.removeEventListener("keydown", close); };
  }, [entry, onClose]);
  if (!entry) return null;
  const concealed = hideSpoilers && !completed;
  return <div className="drawer-backdrop" onMouseDown={onClose} role="presentation">
    <aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${entry.title} details`}>
      <button className="drawer-close" onClick={onClose} aria-label="Close details">×</button>
      <div className="drawer-art" style={posterStyle(entry.collection)}><PosterArt title={entry.collection} hero /></div>
      <div className="drawer-content">
        <p className="eyebrow">{entry.phase} · {entry.kind}</p>
        <h2>{entry.title}</h2>
        {details?.episodeTitle && <h3>{concealed ? "Episode title hidden" : `“${details.episodeTitle}”`}</h3>}
        <p className="drawer-meta">{entry.detail} · {displayDate(details?.releaseDate) || "Release date unavailable"} · {entry.runtime} min</p>
        {!!details?.genres?.length && <p className="genre-row">{details.genres.join(" · ")}</p>}
        <div className={`drawer-description ${concealed ? "concealed" : ""}`}>{loading ? "Retrieving archive details…" : concealed ? "Episode description hidden until you complete it." : details?.description || "Detailed information is not available for this entry yet."}</div>
        {!!details?.cast?.length && !concealed && <p className="cast-row"><span>Starring</span>{details.cast.join(" · ")}</p>}
        <section className="personal-record"><div><span>Your rating</span><div className="stars" aria-label="Your rating">{[1,2,3,4,5].map((star) => <button key={star} className={star <= rating ? "active" : ""} onClick={() => onRating(star === rating ? 0 : star)} aria-label={star === rating ? "Clear rating" : `${star} stars`}>★</button>)}{rating > 0 && <button className="clear-rating" onClick={() => onRating(0)}>Clear</button>}</div></div><button className={favorite ? "favorite active" : "favorite"} onClick={onFavorite}>{favorite ? "♥ Favorite" : "♡ Add favorite"}</button><label className="watched-date"><span>First watched</span><input type="date" max={localDateKey()} value={watchDates[0]?.slice(0, 10) || ""} onChange={(event) => onWatchedDate(event.target.value)} /><small>{watchDates.length > 1 ? `${watchDates.length} total viewings · latest ${displayWatchedDate(watchDates.at(-1)!)}` : "Selecting a date also marks this entry complete."}</small></label>{completed && <div className="rewatch-control"><span>Watch again</span><div><input type="date" max={localDateKey()} value={rewatchDate} onChange={(event) => setRewatchDate(event.target.value)} /><button onClick={() => rewatchDate && onRewatch(rewatchDate)}>Add viewing</button></div>{watchDates.length > 1 && <small>{watchDates.slice(1).map(displayWatchedDate).join(" · ")}</small>}</div>}<label><span>Private notes</span><textarea value={note} onChange={(event) => onNote(event.target.value)} placeholder="Add thoughts, callbacks, or rewatch notes…" /></label><small>Saved locally, included in backups, and synced when you connect Google.</small></section>
        <div className="drawer-actions"><button className={completed ? "drawer-complete done" : "drawer-complete"} onClick={onToggle}><Icon name="check" />{completed ? "Completed" : "Mark complete"}</button><a href={trailerUrl(entry.collection)} target="_blank" rel="noreferrer"><Icon name="play" />Official trailer</a></div>
      </div>
    </aside>
  </div>;
}

function UpcomingDrawer({ project, onClose }: { project?: UpcomingProject; onClose: () => void }) {
  useEffect(() => { if (!project) return; const close = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.body.classList.add("drawer-open"); document.addEventListener("keydown", close); return () => { document.body.classList.remove("drawer-open"); document.removeEventListener("keydown", close); }; }, [project, onClose]);
  if (!project) return null;
  return <div className="drawer-backdrop" onMouseDown={onClose} role="presentation"><aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${project.title} preview`}><button className="drawer-close" onClick={onClose} aria-label="Close details">×</button><div className="drawer-art" style={posterStyle(project.title)}><PosterArt title={project.title} hero /></div><div className="drawer-content"><p className="eyebrow">On the horizon · {project.type}</p><h2>{project.title}</h2><p className="drawer-meta">{displayDate(project.date)} · Upcoming theatrical release</p><p className="genre-row">{project.genres.join(" · ")}</p><div className="drawer-description">{project.description}</div><p className="cast-row"><span>Starring</span>{project.cast.join(" · ")}</p><div className="release-lock">Completion unlocks on release day</div><div className="drawer-actions"><a href={project.trailer} target="_blank" rel="noreferrer"><Icon name="play" />Official trailer</a></div></div></aside></div>;
}

function EpisodeRow({ item, completed, onOpen, onToggle }: { item: WatchEntry; completed: boolean; onOpen: () => void; onToggle: () => void }) {
  const { details } = useMediaDetails(item);
  return <div className={`episode-row ${completed ? "done" : ""}`}>
    <button className="episode-check" onClick={onToggle} aria-label={completed ? `Mark ${item.detail} incomplete` : `Complete ${item.detail}`}><span><Icon name="check" /></span></button>
    <button className="episode-details" onClick={onOpen}><b>{item.detail}{details?.episodeTitle ? ` · ${details.episodeTitle}` : ""}</b><small>{details?.releaseDate ? displayDate(details.releaseDate) : `${item.runtime} min`}</small></button>
  </div>;
}

export default function Home() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("archive");
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<Scope>("completionist");
  const [query, setQuery] = useState("");
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set());
  const [mobileNav, setMobileNav] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WatchEntry>();
  const [selectedUpcoming, setSelectedUpcoming] = useState<UpcomingProject>();
  const [hideSpoilers, setHideSpoilers] = useState(true);
  const [hideWatched, setHideWatched] = useState(false);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [toast, setToast] = useState<{ message: string; ids: string[]; wasComplete: boolean; previous?: string[] }>();
  const [history, setHistory] = useState<Array<{ id: string; at: string }>>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [theme, setTheme] = useState<Theme>("infinity");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("default");
  const [watchOrder, setWatchOrder] = useState<WatchOrder>("release");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [deletedProfiles, setDeletedProfiles] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [franchiseFilter, setFranchiseFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [preset, setPreset] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bulkWatchDate, setBulkWatchDate] = useState("");
  const [achievementToast, setAchievementToast] = useState<{ name: string; description: string; icon: string }>();
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const [today, setToday] = useState<Date>();
  const importRef = useRef<HTMLInputElement>(null);
  const localArchiveRef = useRef<CloudArchive | null>(null);
  const syncReadyRef = useRef(false);
  const migrationHandledRef = useRef("");
  const lastWrittenAtRef = useRef("");
  const syncedFingerprintRef = useRef("");
  const remoteApplyingUntilRef = useRef(0);
  const closeDetails = useCallback(() => setSelectedEntry(undefined), []);

  useEffect(() => {
    queueMicrotask(() => {
      let savedProfiles: Profile[] = [];
      try { savedProfiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]"); } catch { savedProfiles = []; }
      if (!savedProfiles.length) {
        let legacyCompleted: string[] = []; let legacyHistory: Array<{ id: string; at: string }> = [];
        try { legacyCompleted = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { /* migrate empty */ }
        try { legacyHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { /* migrate empty */ }
        const now = new Date().toISOString();
        savedProfiles = [{ id: "default", name: "My First Watch", order: "release", scope: "completionist", completed: legacyCompleted, history: legacyHistory, ratings: {}, favorites: [], notes: {}, createdAt: now, updatedAt: now }];
      }
      const preferred = localStorage.getItem(ACTIVE_PROFILE_KEY) || savedProfiles[0].id;
      const active = savedProfiles.find((profile) => profile.id === preferred) || savedProfiles[0];
      setProfiles(savedProfiles); setActiveProfileId(active.id); setCompleted(new Set(active.completed)); setHistory(active.history); setActivity(active.activity || []); setTheme(active.theme || "infinity"); setWatchOrder(active.order); setScope(active.scope); setRatings(active.ratings || {}); setFavorites(new Set(active.favorites || [])); setNotes(active.notes || {});
      setHideSpoilers(localStorage.getItem(SPOILER_KEY) !== "false");
      setHideWatched(localStorage.getItem(HIDE_WATCHED_KEY) === "true");
      try { setDeletedProfiles(JSON.parse(localStorage.getItem(DELETED_PROFILES_KEY) || "{}")); } catch { setDeletedProfiles({}); }
      setToday(new Date());
      setBulkWatchDate(localDateKey());
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const now = new Date().toISOString();
    queueMicrotask(() => setProfiles((current) => {
      const next = current.map((profile) => profile.id === activeProfileId ? { ...profile, order: watchOrder, scope, completed: [...completed], history, activity, theme, ratings, favorites: [...favorites], notes, updatedAt: now } : profile);
      localStorage.setItem(PROFILES_KEY, JSON.stringify(next)); return next;
    }));
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [activeProfileId, activity, completed, favorites, history, hydrated, notes, ratings, scope, theme, watchOrder]);
  useEffect(() => { if (hydrated) localStorage.setItem(DELETED_PROFILES_KEY, JSON.stringify(deletedProfiles)); }, [deletedProfiles, hydrated]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (hydrated) localStorage.setItem(SPOILER_KEY, String(hideSpoilers)); }, [hideSpoilers, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(HIDE_WATCHED_KEY, String(hideWatched)); }, [hideWatched, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const currentProfiles = profiles.map((profile) => profile.id === activeProfileId ? { ...profile, order: watchOrder, scope, completed: [...completed], history, activity, theme, ratings, favorites: [...favorites], notes } : profile);
    const archive: CloudArchive = { schemaVersion: 4, appVersion: APP_VERSION, updatedAt: new Date().toISOString(), activeProfileId, profiles: currentProfiles, deletedProfiles, preferences: { hideSpoilers, hideWatched } };
    localArchiveRef.current = archive;
    if (!user || !syncReadyRef.current || Date.now() < remoteApplyingUntilRef.current) return;
    if (!navigator.onLine) { queueMicrotask(() => setSyncStatus("offline")); return; }
    queueMicrotask(() => setSyncStatus("syncing"));
    const timer = window.setTimeout(async () => {
      const next = { ...localArchiveRef.current!, updatedAt: new Date().toISOString() };
      try {
        lastWrittenAtRef.current = next.updatedAt;
        await setDoc(archiveDocument(user), next);
        syncedFingerprintRef.current = archiveFingerprint(next);
        setLastSyncedAt(next.updatedAt); setSyncStatus("synced");
      } catch { setSyncStatus(navigator.onLine ? "error" : "offline"); }
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [activeProfileId, activity, completed, deletedProfiles, favorites, hideSpoilers, hideWatched, history, hydrated, notes, profiles, ratings, scope, theme, user, watchOrder]);
  useEffect(() => {
    if (!hydrated) return;
    let unsubscribeCloud: () => void = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      unsubscribeCloud(); setUser(nextUser); syncReadyRef.current = false;
      if (!nextUser) { migrationHandledRef.current = ""; setSyncStatus("local"); return; }
      setSyncStatus("connecting");
      const reference = archiveDocument(nextUser);
      unsubscribeCloud = onSnapshot(reference, async (snapshot) => {
        const local = localArchiveRef.current;
        if (!local) return;
        if (!snapshot.exists()) {
          const initial = { ...local, updatedAt: new Date().toISOString() };
          lastWrittenAtRef.current = initial.updatedAt;
          try { await setDoc(reference, initial); syncedFingerprintRef.current = archiveFingerprint(initial); syncReadyRef.current = true; setLastSyncedAt(initial.updatedAt); setSyncStatus("synced"); }
          catch { setSyncStatus(navigator.onLine ? "error" : "offline"); }
          return;
        }
        const cloud = snapshot.data() as CloudArchive;
        if (cloud.updatedAt === lastWrittenAtRef.current) { syncedFingerprintRef.current = archiveFingerprint(cloud); syncReadyRef.current = true; setLastSyncedAt(cloud.updatedAt); setSyncStatus("synced"); return; }
        if (migrationHandledRef.current !== nextUser.uid) {
          migrationHandledRef.current = nextUser.uid;
          const hasLocalProgress = local.profiles.length > 1 || local.profiles.some((profile) => profile.completed.length || profile.history.length || Object.keys(profile.ratings || {}).length || profile.favorites.length || Object.keys(profile.notes || {}).length);
          let selected = cloud;
          if (hasLocalProgress && JSON.stringify(local.profiles) !== JSON.stringify(cloud.profiles)) {
            const merge = confirm("Cloud profiles were found for this Google account.\n\nChoose OK to safely merge them with the profiles on this device. Choose Cancel for replacement options.");
            if (merge) selected = mergeArchives(local, cloud);
            else {
              const useCloud = confirm("Choose OK to replace this device with the cloud archive.\n\nChoose Cancel to keep this device's archive and replace the cloud copy. An automatic browser backup remains available until local storage is cleared.");
              selected = useCloud ? cloud : { ...local, updatedAt: new Date().toISOString() };
            }
          }
          if (selected !== cloud) {
            lastWrittenAtRef.current = selected.updatedAt;
            await setDoc(reference, selected);
          }
          syncedFingerprintRef.current = archiveFingerprint(selected); applyCloudArchive(selected); syncReadyRef.current = true; setLastSyncedAt(selected.updatedAt); setSyncStatus("synced");
          return;
        }
        if (cloud.updatedAt) {
          const hasUnsyncedLocalChanges = archiveFingerprint(local) !== syncedFingerprintRef.current;
          const selected = hasUnsyncedLocalChanges ? mergeArchives(local, cloud) : cloud;
          if (hasUnsyncedLocalChanges) { lastWrittenAtRef.current = selected.updatedAt; await setDoc(reference, selected); }
          syncedFingerprintRef.current = archiveFingerprint(selected); applyCloudArchive(selected); setLastSyncedAt(selected.updatedAt); setSyncStatus("synced");
        }
      }, () => setSyncStatus(navigator.onLine ? "error" : "offline"));
    });
    const online = () => { if (auth.currentUser) { setSyncStatus("connecting"); void syncNow(); } };
    const offline = () => auth.currentUser && setSyncStatus("offline");
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { unsubscribeCloud(); unsubscribeAuth(); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  // Authentication is subscribed once after local data has hydrated. Live values are read from localArchiveRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(undefined), 4500); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => undefined);
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as Event & { prompt: () => Promise<void> }); };
    window.addEventListener("beforeinstallprompt", capture); return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  const scopedEntries = useMemo(() => orderEntries(scope === "official" ? entries.filter((e) => e.scope === "official") : entries, watchOrder), [scope, watchOrder]);
  const scopedComplete = scopedEntries.filter((e) => completed.has(e.id)).length;
  const percentage = scopedEntries.length ? (scopedComplete / scopedEntries.length) * 100 : 0;
  const nextEntry = scopedEntries.find((e) => !completed.has(e.id)) || scopedEntries[0];
  useEffect(() => { queueMicrotask(() => setHeroExpanded(false)); }, [nextEntry?.id]);
  const { details: nextDetails, loading: detailsLoading } = useMediaDetails(nextEntry);
  const heroConcealed = !!nextEntry && hideSpoilers && !completed.has(nextEntry.id);
  const remainingRuntime = scopedEntries.filter((e) => !completed.has(e.id)).reduce((sum, e) => sum + e.runtime, 0);

  const filtered = useMemo(() => scopedEntries.filter((entry) => {
    if (hideWatched && completed.has(entry.id)) return false;
    if (filter === "remaining" && completed.has(entry.id)) return false;
    if (filter === "favorites" && !favorites.has(entry.id)) return false;
    if (!["all", "remaining"].includes(filter) && entry.kind !== filter) return false;
    if (phaseFilter && entry.phase !== phaseFilter) return false;
    if (franchiseFilter && franchiseFor(entry) !== franchiseFilter) return false;
    if (divisionFilter && divisionFor(entry) !== divisionFilter) return false;
    if (yearFilter && String(yearFor(entry)) !== yearFilter) return false;
    if (!presetMatches(entry, preset)) return false;
    const override = episodeMetadataOverrides[metadataKey(entry.collection, entry.season, entry.episode)] || metadataOverrides[entry.collection] || {};
    const episode = episodeMetadata[metadataKey(entry.collection, entry.season, entry.episode)] || {};
    return `${entry.title} ${entry.collection} ${entry.detail} ${entry.phase} ${franchiseFor(entry)} ${divisionFor(entry)} ${searchCreditsFor(entry)} ${(override.cast || episode.cast || []).join(" ")} ${(override.genres || episode.genres || []).join(" ")} ${override.title || episode.episodeTitle || ""} ${override.description || episode.description || ""} ${notes[entry.id] || ""}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [scopedEntries, filter, query, completed, favorites, hideWatched, notes, phaseFilter, franchiseFilter, divisionFilter, yearFilter, preset]);

  const collections = useMemo(() => {
    const groups: Array<[string, WatchEntry[]]> = [];
    filtered.forEach((entry) => { const prior = groups.at(-1); if (prior && prior[1][0].sourceTitle === entry.sourceTitle) prior[1].push(entry); else groups.push([`${entry.sourceTitle}-${groups.length}`, [entry]]); });
    return groups;
  }, [filtered]);

  function applyCloudArchive(archive: CloudArchive) {
    if (!archive.profiles?.length) return;
    remoteApplyingUntilRef.current = Date.now() + 1800;
    const active = archive.profiles.find((profile) => profile.id === archive.activeProfileId) || archive.profiles[0];
    setProfiles(archive.profiles); setDeletedProfiles(archive.deletedProfiles || {}); setActiveProfileId(active.id);
    setCompleted(new Set(active.completed || [])); setHistory(active.history || []); setActivity(active.activity || []); setTheme(active.theme || "infinity");
    setWatchOrder(active.order || "release"); setScope(active.scope || "completionist"); setRatings(active.ratings || {}); setFavorites(new Set(active.favorites || [])); setNotes(active.notes || {});
    setHideSpoilers(archive.preferences?.hideSpoilers !== false); setHideWatched(archive.preferences?.hideWatched === true);
  }

  async function connectGoogle() {
    setSyncStatus("connecting");
    try { await signInWithGoogle(); }
    catch (error) {
      setSyncStatus("error");
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "auth/popup-closed-by-user") alert("Google sign-in could not be completed. Confirm cinematicarchiveshq.github.io is listed in Firebase Authorized domains, then try again.");
    }
  }

  async function syncNow() {
    const currentUser = user || auth.currentUser;
    if (!currentUser || !localArchiveRef.current) return;
    setSyncStatus(navigator.onLine ? "syncing" : "offline");
    try {
      const reference = archiveDocument(currentUser); const snapshot = await getDoc(reference);
      const local = { ...localArchiveRef.current, updatedAt: new Date().toISOString() };
      const next = snapshot.exists() ? mergeArchives(local, snapshot.data() as CloudArchive) : local;
      lastWrittenAtRef.current = next.updatedAt; await setDoc(reference, next); syncedFingerprintRef.current = archiveFingerprint(next); applyCloudArchive(next);
      setLastSyncedAt(next.updatedAt); setSyncStatus("synced");
    } catch { setSyncStatus(navigator.onLine ? "error" : "offline"); }
  }

  async function removeCloudArchive() {
    if (!user || !confirm("Permanently delete the Infinity Archive profiles stored in this Google account? The profiles currently saved on this device will remain local.")) return;
    try { await deleteDoc(archiveDocument(user)); await signOutGoogle(); setSyncStatus("local"); }
    catch { alert("The cloud archive could not be deleted. Please try again while online."); }
  }

  function loadProfile(profile: Profile) {
    setActiveProfileId(profile.id); setCompleted(new Set(profile.completed)); setHistory(profile.history); setActivity(profile.activity || []); setTheme(profile.theme || "infinity"); setWatchOrder(profile.order); setScope(profile.scope); setRatings(profile.ratings || {}); setFavorites(new Set(profile.favorites || [])); setNotes(profile.notes || {}); setView("archive");
  }
  function createProfile() {
    const name = prompt("Name this watch-through", `Watch-through ${profiles.length + 1}`)?.trim(); if (!name) return;
    const now = new Date().toISOString(); const profile: Profile = { id: `profile-${Date.now()}`, name, order: watchOrder, scope, completed: [], history: [], activity: [], theme, ratings: {}, favorites: [], notes: {}, createdAt: now, updatedAt: now };
    setProfiles((current) => [...current, profile]); loadProfile(profile);
  }
  function deleteProfile(id: string) {
    if (profiles.length === 1) return alert("Keep at least one watch-through profile.");
    if (!confirm("Delete this watch-through and all of its local progress?")) return;
    const next = profiles.filter((profile) => profile.id !== id); setDeletedProfiles((current) => ({ ...current, [id]: new Date().toISOString() })); setProfiles(next); if (id === activeProfileId) loadProfile(next[0]);
  }
  function recordActivity(id: string, type: ActivityEvent["type"]) {
    setActivity((current) => [...current, { id, type, at: new Date().toISOString() }].slice(-250));
  }
  function openEntry(entry?: WatchEntry) {
    if (!entry) return;
    setSelectedEntry(entry); recordActivity(entry.id, "viewed");
  }

  function toggleEntry(id: string, label = "Item") {
    const wasComplete = completed.has(id);
    setCompleted((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setHistory((current) => wasComplete ? current.filter((event) => event.id !== id) : [...current.filter((event) => event.id !== id), { id, at: watchedTimestamp(localDateKey()) }]);
    setToast({ message: `${label} marked ${wasComplete ? "incomplete" : "complete"}`, ids: [id], wasComplete });
  }
  function completeCollection(items: WatchEntry[]) {
    const allDone = items.every((item) => completed.has(item.id));
    setCompleted((current) => { const next = new Set(current); items.forEach((item) => allDone ? next.delete(item.id) : next.add(item.id)); return next; });
    const now = watchedTimestamp(localDateKey()); setHistory((current) => allDone ? current.filter((event) => !items.some((item) => item.id === event.id)) : [...current.filter((event) => !items.some((item) => item.id === event.id)), ...items.map((item) => ({ id: item.id, at: now }))]);
    setToast({ message: `${items[0].collection} marked ${allDone ? "incomplete" : "complete"}`, ids: items.map((item) => item.id), wasComplete: allDone });
  }
  function setScopedCompletion(makeComplete: boolean, date = bulkWatchDate || localDateKey()) {
    const ids = scopedEntries.map((item) => item.id);
    const previous = ids.filter((id) => completed.has(id));
    setCompleted((current) => {
      const next = new Set(current);
      ids.forEach((id) => makeComplete ? next.add(id) : next.delete(id));
      return next;
    });
    const now = watchedTimestamp(date);
    setHistory((current) => makeComplete
      ? [...current.filter((event) => !ids.includes(event.id)), ...ids.map((id) => ({ id, at: now }))]
      : current.filter((event) => !ids.includes(event.id)));
    setToast({ message: `${makeComplete ? "Selected" : "Deselected"} all ${scope === "official" ? "Official MCU" : "Completionist"} items`, ids, wasComplete: !makeComplete, previous });
  }
  function setEntryWatchedDate(id: string, date: string) {
    if (!date) {
      setCompleted((current) => { const next = new Set(current); next.delete(id); return next; });
      setHistory((current) => current.filter((event) => event.id !== id));
      return;
    }
    setCompleted((current) => new Set(current).add(id));
    setHistory((current) => {
      const itemDates = current.filter((event) => event.id === id).sort((a, b) => a.at.localeCompare(b.at));
      const rest = current.filter((event) => event.id !== id);
      return [...rest, { id, at: watchedTimestamp(date) }, ...itemDates.slice(1)];
    });
    recordActivity(id, "edited");
  }
  function addRewatch(id: string, date: string) {
    setCompleted((current) => new Set(current).add(id));
    setHistory((current) => [...current, { id, at: watchedTimestamp(date) }]);
    recordActivity(id, "edited");
    setToast({ message: "Rewatch added to viewing history", ids: [], wasComplete: true });
  }
  function undoToast() {
    if (!toast) return;
    setCompleted((current) => {
      const next = new Set(current);
      if (toast.previous) {
        toast.ids.forEach((id) => next.delete(id));
        toast.previous.forEach((id) => next.add(id));
      } else toast.ids.forEach((id) => toast.wasComplete ? next.add(id) : next.delete(id));
      return next;
    });
    setHistory((current) => {
      if (toast.previous) {
        const now = new Date().toISOString();
        return [...current.filter((event) => !toast.ids.includes(event.id)), ...toast.previous.map((id) => ({ id, at: now }))];
      }
      return toast.wasComplete ? [...current, ...toast.ids.map((id) => ({ id, at: new Date().toISOString() }))] : current.filter((event) => !toast.ids.includes(event.id));
    });
    setToast(undefined);
  }
  function exportProgress() {
    const currentProfiles = profiles.map((profile) => profile.id === activeProfileId ? { ...profile, order: watchOrder, scope, completed: [...completed], history, activity, theme, ratings, favorites: [...favorites], notes } : profile);
    const blob = new Blob([JSON.stringify({ version: 4, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), activeProfileId, profiles: currentProfiles, deletedProfiles, preferences: { hideSpoilers, hideWatched } }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "infinity-archive-progress.json"; link.click(); URL.revokeObjectURL(url);
  }
  async function importProgress(file?: File) {
    if (!file) return;
    try { const data = JSON.parse(await file.text()); if (Array.isArray(data.profiles) && data.profiles.length) { setProfiles(data.profiles); setDeletedProfiles(data.deletedProfiles || {}); if (data.preferences) { setHideSpoilers(data.preferences.hideSpoilers !== false); setHideWatched(data.preferences.hideWatched === true); } loadProfile(data.profiles.find((profile: Profile) => profile.id === data.activeProfileId) || data.profiles[0]); } else if (Array.isArray(data.completed)) setCompleted(new Set(data.completed)); else throw new Error(); } catch { alert("That file is not a valid Infinity Archive backup."); }
  }

  async function shareProgress() {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 630; const ctx = canvas.getContext("2d"); if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630); gradient.addColorStop(0, "#060a10"); gradient.addColorStop(1, "#182331"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 630);
    ctx.strokeStyle = "#c6a45e"; ctx.lineWidth = 3; ctx.strokeRect(32, 32, 1136, 566);
    try { const logo = new Image(); logo.src = "./infinity-archive-logo.png?v=2"; await new Promise<void>((resolve, reject) => { logo.onload = () => resolve(); logo.onerror = () => reject(); }); ctx.drawImage(logo, 76, 62, 430, 114); } catch { ctx.fillStyle = "#c6a45e"; ctx.font = "600 34px sans-serif"; ctx.fillText("THE INFINITY ARCHIVE", 80, 105); }
    ctx.fillStyle = "#c6a45e"; ctx.font = "600 18px sans-serif"; ctx.fillText("ARCHIVE PASSPORT", 84, 182); ctx.fillStyle = "#f3efe7"; ctx.font = "700 82px sans-serif"; ctx.fillText(`${Math.round(percentage)}% COMPLETE`, 80, 265); ctx.font = "500 31px sans-serif"; ctx.fillStyle = "#aeb7c4"; ctx.fillText(`${scopedComplete} of ${scopedEntries.length} entries · ${formatTime(watchedRuntime)} watched · ${rewatchCount} rewatches`, 84, 330);
    infinityStones.forEach((stone, index) => { const earned = phaseStats.find((phase) => phase.phase === stone.phase)?.percent === 100; const x = 110 + index * 118; const y = 418; ctx.beginPath(); for (let point = 0; point < 6; point++) { const angle = Math.PI / 3 * point - Math.PI / 2; const px = x + Math.cos(angle) * 35; const py = y + Math.sin(angle) * 35; if (point) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); ctx.fillStyle = earned ? stone.color : "#202a35"; ctx.globalAlpha = earned ? 1 : .55; ctx.fill(); ctx.strokeStyle = earned ? "#f4e3b2" : "#52606f"; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = earned ? "#d9dde3" : "#687483"; ctx.font = "500 14px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`P${index + 1}`, x, 475); }); ctx.textAlign = "left";
    ctx.fillStyle = "#c6a45e"; ctx.font = "600 24px sans-serif"; ctx.fillText(profiles.find((profile) => profile.id === activeProfileId)?.name.toUpperCase() || "MY WATCH-THROUGH", 84, 535); ctx.fillStyle = "#7e8997"; ctx.font = "20px sans-serif"; ctx.fillText(`${watchOrder === "release" ? "Release order" : "MCU timeline order"} · ${infinityStones.filter((stone) => phaseStats.find((phase) => phase.phase === stone.phase)?.percent === 100).length}/6 stones collected`, 84, 568);
    const link = document.createElement("a"); link.download = "infinity-archive-passport.png"; link.href = canvas.toDataURL("image/png"); link.click();
  }

  const phaseStats = ["Phase One", "Phase Two", "Phase Three", "Phase Four", "Phase Five", "Phase Six"].map((phase) => {
    const phaseEntries = scopedEntries.filter((e) => e.phase === phase); const done = phaseEntries.filter((e) => completed.has(e.id)).length;
    return { phase, total: phaseEntries.length, done, percent: phaseEntries.length ? done / phaseEntries.length * 100 : 0 };
  });
  const watchedRuntime = scopedEntries.filter((entry) => completed.has(entry.id)).reduce((sum, entry) => sum + entry.runtime, 0);
  const completedMovies = scopedEntries.filter((entry) => entry.kind === "movie" && completed.has(entry.id)).length;
  const completedEpisodes = scopedEntries.filter((entry) => entry.kind === "episode" && completed.has(entry.id)).length;
  const recentEntries = history.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((event) => ({ ...event, entry: entries.find((item) => item.id === event.id) })).filter((item) => item.entry);
  const activeDays = new Set(history.map((event) => event.at.slice(0, 10)));
  let streak = 0; const cursor = today ? new Date(today) : undefined;
  while (cursor && activeDays.has(localDateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  const estimatedFinish = today ? new Date(today.valueOf() + Math.ceil(remainingRuntime / 120) * 86400000) : undefined;
  const nextQueue = scopedEntries.filter((entry) => !completed.has(entry.id)).slice(0, 8);
  const franchises = [...new Set(entries.map(franchiseFor))].sort();
  const divisions = [...new Set(entries.map(divisionFor))].sort();
  const years = [...new Set(entries.map(yearFor))].sort((a, b) => a - b);
  const achievements = achievementData(scopedEntries, completed);
  const unlockedSignature = achievements.filter((item) => item.unlocked).map((item) => item.name).join("|");
  const rated = Object.entries(ratings).filter(([id, value]) => value > 0 && scopedEntries.some((entry) => entry.id === id));
  const averageRating = rated.length ? rated.reduce((sum, [, value]) => sum + value, 0) / rated.length : 0;
  const currentProfile = profiles.find((profile) => profile.id === activeProfileId);
  const historyByItem = new Map<string, Array<{ id: string; at: string }>>();
  history.slice().sort((a, b) => a.at.localeCompare(b.at)).forEach((event) => historyByItem.set(event.id, [...(historyByItem.get(event.id) || []), event]));
  const rewatchCount = [...historyByItem.values()].reduce((sum, events) => sum + Math.max(0, events.length - 1), 0);
  const recentActivity = activity.slice().sort((a, b) => b.at.localeCompare(a.at)).filter((event, index, all) => all.findIndex((other) => other.id === event.id && other.type === event.type) === index).slice(0, 20).map((event) => ({ ...event, entry: entries.find((item) => item.id === event.id) })).filter((event) => event.entry);
  const calendarMonth = today ? { year: today.getFullYear(), month: today.getMonth() } : undefined;
  const calendarDays = calendarMonth ? Array.from({ length: new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate() }, (_, index) => {
    const date = new Date(calendarMonth.year, calendarMonth.month, index + 1); const key = localDateKey(date); const events = history.filter((event) => event.at.slice(0, 10) === key);
    return { day: index + 1, key, events, offset: index === 0 ? date.getDay() : 0 };
  }) : [];
  const completedPhases = phaseStats.filter((stat) => stat.percent === 100);
  useEffect(() => {
    if (!hydrated || !activeProfileId) return;
    let seenByProfile: Record<string, string[]> = {}; try { seenByProfile = JSON.parse(localStorage.getItem(ACHIEVEMENTS_SEEN_KEY) || "{}"); } catch { /* start fresh */ }
    const unlocked = achievements.filter((item) => item.unlocked); const seen = seenByProfile[activeProfileId];
    if (!seen) { seenByProfile[activeProfileId] = unlocked.map((item) => item.name); localStorage.setItem(ACHIEVEMENTS_SEEN_KEY, JSON.stringify(seenByProfile)); return; }
    const newlyUnlocked = unlocked.find((item) => !seen.includes(item.name));
    if (newlyUnlocked) { seenByProfile[activeProfileId] = [...seen, newlyUnlocked.name]; localStorage.setItem(ACHIEVEMENTS_SEEN_KEY, JSON.stringify(seenByProfile)); queueMicrotask(() => setAchievementToast(newlyUnlocked)); }
  // The stable signature changes only when an achievement crosses its threshold.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, hydrated, unlockedSignature]);
  useEffect(() => { if (!achievementToast) return; const timer = window.setTimeout(() => setAchievementToast(undefined), 6000); return () => window.clearTimeout(timer); }, [achievementToast]);

  return <main>
    <header className="topbar">
      <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><Icon name="menu" /></button>
      <button className="brand" onClick={() => setView("archive")} aria-label="The Infinity Archive home"><img src="./infinity-archive-logo.png?v=2" alt="The Infinity Archive" /></button>
      <nav className={mobileNav ? "open" : ""}>
        <button className={view === "archive" ? "active" : ""} onClick={() => { setView("archive"); setMobileNav(false); }}>Archive</button>
        <button className={view === "timeline" ? "active" : ""} onClick={() => { setView("timeline"); setMobileNav(false); }}>Journey</button>
        <button className={view === "analytics" ? "active" : ""} onClick={() => { setView("analytics"); setMobileNav(false); }}>Analytics</button>
        <button className={view === "history" ? "active" : ""} onClick={() => { setView("history"); setMobileNav(false); }}>History</button>
        <button className={view === "settings" ? "active" : ""} onClick={() => { setView("settings"); setMobileNav(false); }}>Settings</button>
      </nav>
      <div className="header-tools">
        <select className="profile-picker" value={activeProfileId} onChange={(event) => { const profile = profiles.find((item) => item.id === event.target.value); if (profile) loadProfile(profile); }} aria-label="Watch-through profile">{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>
        {installPrompt && <button onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }} title="Install app"><Icon name="download" /><span>Install</span></button>}
        <button onClick={exportProgress} title="Export progress"><Icon name="download" /><span>Backup</span></button>
        <button onClick={() => importRef.current?.click()} title="Import progress"><Icon name="upload" /><span>Restore</span></button>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => importProgress(e.target.files?.[0])} />
      </div>
    </header>

    {view === "archive" && <>
      <section className="hero" style={posterStyle(nextEntry?.title || "Archive")}>
        {nextEntry && <PosterArt key={nextEntry.id} title={nextEntry.collection} hero />}
        <div className="hero-noise" />
        <div className="hero-content">
          <p className="eyebrow">Next in {watchOrder === "release" ? "release order" : "MCU timeline order"}</p>
          <h1>{nextEntry?.title}</h1>
          {nextDetails?.episodeTitle && <h2 className="episode-title">{heroConcealed ? "Episode title hidden" : `“${nextDetails.episodeTitle}”`}</h2>}
          <p className="hero-meta">{nextEntry?.detail} <i /> {nextDetails?.releaseDate ? displayDate(nextDetails.releaseDate) : nextEntry?.kind} <i /> {nextEntry?.runtime} min</p>
          {!!nextDetails?.genres?.length && <p className="genre-row">{nextDetails.genres.join(" · ")}</p>}
          <p className={`hero-copy ${heroExpanded ? "expanded" : ""} ${detailsLoading ? "loading-copy" : ""}`}>{detailsLoading ? "Retrieving archive details…" : heroConcealed ? "Episode description hidden until you complete it." : nextDetails?.description || "Detailed information is not available for this archive entry yet."}</p>
          {!detailsLoading && !heroConcealed && (nextDetails?.description?.length || 0) > 220 && <button className="read-more" onClick={() => setHeroExpanded(!heroExpanded)}>{heroExpanded ? "Show less" : "Read more"}</button>}
          {!!nextDetails?.cast?.length && !heroConcealed && <p className="cast-row"><span>Starring</span>{nextDetails.cast.join(" · ")}</p>}
          <div className="hero-actions">
            <button className="primary" onClick={() => nextEntry && toggleEntry(nextEntry.id, nextEntry.episode ? `${nextEntry.title} ${nextEntry.detail}` : nextEntry.title)}><span className="button-check"><Icon name="check" /></span>{nextEntry && completed.has(nextEntry.id) ? "Completed" : "Mark complete"}</button>
            <button className="secondary" onClick={() => openEntry(nextEntry)}>View details <Icon name="chevron" /></button>
            {nextEntry && <a className="trailer-action" href={trailerUrl(nextEntry.collection)} target="_blank" rel="noreferrer"><Icon name="play" />Official trailer</a>}
          </div>
        </div>
        <ProgressRing value={percentage} />
      </section>

      <section className="stat-strip">
        <article><span className="stat-icon"><Icon name="check" /></span><div><strong>{scopedComplete}</strong><small>Completed</small></div></article>
        <article><span className="stat-icon lines">≡</span><div><strong>{scopedEntries.length - scopedComplete}</strong><small>Remaining</small></div></article>
        <article><span className="stat-icon clock">◷</span><div><strong>{Math.round(remainingRuntime / 60)}h</strong><small>Estimated time</small></div></article>
        <article className="scope-stat"><div><strong>{sourceCount}</strong><small>Original listings</small></div><span>{entries.length} trackable items</span></article>
      </section>

      <section className="next-up-shell"><div className="section-title"><div><p className="eyebrow">Up next</p><h2>Your queue</h2></div><span>{currentProfile?.name} · {watchOrder === "release" ? "Release order" : "MCU timeline"}</span></div><div className="next-queue">{nextQueue.map((item, index) => <article key={item.id}><button className="queue-open" onClick={() => openEntry(item)}><span>{String(index + 1).padStart(2, "0")}</span><PosterArt title={item.collection} /><div><small>{item.detail}</small><strong>{item.title}</strong></div></button><button className="queue-check" onClick={() => toggleEntry(item.id, item.title)} aria-label={`Complete ${item.title}`}><Icon name="check" /></button></article>)}</div></section>

      <section className="upcoming-shell"><div className="section-title"><div><p className="eyebrow">On the horizon</p><h2>Upcoming releases</h2></div><span>Future titles stay separate until release</span></div><div className="upcoming-grid">{upcomingProjects.map((project) => { const days = today ? Math.ceil((new Date(`${project.date}T12:00:00`).valueOf() - today.valueOf()) / 86400000) : 0; return <article key={project.title}><button className="upcoming-main" onClick={() => setSelectedUpcoming(project)}><PosterArt title={project.title} /><span><small>{project.type} · {displayDate(project.date)}</small><strong>{project.title}</strong><em>{days > 0 ? `${days} days` : "Released — awaiting archive update"}</em><b>View details →</b></span></button><a href={project.trailer} target="_blank" rel="noreferrer" aria-label={`Watch the ${project.title} trailer`}><Icon name="play" />Trailer</a></article>; })}</div></section>

      <section className="archive-shell" id="watchlist">
        <div className="control-bar">
          <div className="order-toggle"><button className={watchOrder === "release" ? "active" : ""} onClick={() => setWatchOrder("release")}>Release order</button><button className={watchOrder === "chronological" ? "active" : ""} onClick={() => setWatchOrder("chronological")}>MCU timeline</button></div>
          <div className="scope-toggle"><button className={scope === "completionist" ? "active" : ""} onClick={() => setScope("completionist")}>Completionist</button><button className={scope === "official" ? "active" : ""} onClick={() => setScope("official")}>Official MCU</button></div>
          <div className="filter-tabs">
            {(["all", "remaining", "favorites", "movie", "episode", "special", "short"] as Filter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : item}</button>)}
          </div>
          <label className="search"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titles, cast, genres, notes…" /></label>
          <div className="archive-actions" aria-label="Archive display and selection controls">
            <label className="option-toggle"><input type="checkbox" checked={hideSpoilers} onChange={(event) => setHideSpoilers(event.target.checked)} /><span />Spoiler-safe mode</label>
            <label className="option-toggle"><input type="checkbox" checked={hideWatched} onChange={(event) => setHideWatched(event.target.checked)} /><span />Hide watched</label>
            <label className="bulk-date"><span>Bulk watched</span><input type="date" max={localDateKey()} value={bulkWatchDate} onChange={(event) => setBulkWatchDate(event.target.value)} /></label>
            <button type="button" onClick={() => setScopedCompletion(true, bulkWatchDate)}>Select all</button>
            <button type="button" onClick={() => setScopedCompletion(false)}>Deselect all</button>
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? "Hide filters" : "Advanced filters"}</button>
          </div>
          {showAdvanced && <div className="advanced-filters"><select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}><option value="">All phases</option>{["Phase One","Phase Two","Phase Three","Phase Four","Phase Five","Phase Six"].map((value) => <option key={value}>{value}</option>)}</select><select value={franchiseFilter} onChange={(e) => setFranchiseFilter(e.target.value)}><option value="">All franchises</option>{franchises.map((value) => <option key={value}>{value}</option>)}</select><select value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)}><option value="">All divisions</option>{divisions.map((value) => <option key={value}>{value}</option>)}</select><select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}><option value="">All eras</option>{years.map((value) => <option key={value} value={value}>{value} era</option>)}</select><select value={preset} onChange={(e) => setPreset(e.target.value)}><option value="">No preset</option><option value="infinity">Infinity Saga</option><option value="multiverse">Multiverse Saga</option><option value="defenders">Defenders Saga</option><option value="one-shots">One-Shots & shorts</option></select><button onClick={() => { setPhaseFilter(""); setFranchiseFilter(""); setDivisionFilter(""); setYearFilter(""); setPreset(""); }}>Clear</button></div>}
        </div>
        <div className="results-heading"><div><p className="eyebrow">{watchOrder === "release" ? "Release-order archive" : "MCU story timeline"}</p><h2>{collections.length} titles shown</h2></div><span>{filtered.length} trackable items</span></div>
        <div className="watchlist">
          {collections.map(([segmentKey, items]) => {
            const collection = items[0].collection; const segmentLabel = items[0].sourceTitle;
            const isSeries = items.some((i) => i.kind === "episode"); const open = openCollections.has(segmentKey) || query.length > 0;
            const done = items.filter((item) => completed.has(item.id)).length; const allDone = done === items.length;
            return <article className={`watch-card ${allDone ? "complete" : ""}`} key={segmentKey}>
              <button className="card-main" onClick={() => { if (isSeries) setOpenCollections((current) => { const next = new Set(current); if (next.has(segmentKey)) next.delete(segmentKey); else next.add(segmentKey); return next; }); else openEntry(items[0]); }}>
                <span className="sequence">{String(items[0].order).padStart(3, "0")}</span>
                <PosterArt title={collection} />
                <span className="card-copy"><small>{items[0].phase} · {isSeries ? segmentLabel.replace(`${collection}: `, "") : items[0].kind}</small><strong>{collection}</strong><span className="mini-progress"><i style={{ width: `${done / items.length * 100}%` }} /></span><em>{done} of {items.length} complete</em></span>
                {isSeries && <span className={`expand ${open ? "open" : ""}`}><Icon name="chevron" /></span>}
              </button>
              <a className="card-trailer" href={trailerUrl(collection)} target="_blank" rel="noreferrer" aria-label={`Find the official ${collection} trailer on YouTube`}><Icon name="play" /><span>Trailer</span></a>
              <button className={`complete-button ${allDone ? "done" : ""}`} onClick={() => completeCollection(items)} aria-label={allDone ? `Mark ${collection} incomplete` : `Complete ${collection}`}><Icon name="check" /></button>
              {isSeries && open && <div className="episodes">
                {items.map((item) => <EpisodeRow key={item.id} item={item} completed={completed.has(item.id)} onOpen={() => openEntry(item)} onToggle={() => toggleEntry(item.id, `${item.title} ${item.detail}`)} />)}
              </div>}
            </article>;
          })}
          {!collections.length && <div className="empty"><strong>No records found</strong><span>Try another filter or search term.</span></div>}
        </div>
      </section>
    </>}

    {view === "analytics" && <section className="inner-page analytics-page">
      <div className="page-heading"><p className="eyebrow">Mission intelligence</p><h1>Your journey, decoded.</h1><p>Live calculations based entirely on your saved archive progress.</p></div>
      <div className="analytics-grid">
        <article className="analytics-hero"><ProgressRing value={percentage} /><div><small>Archive completion</small><strong>{scopedComplete} / {scopedEntries.length}</strong><p>{formatTime(remainingRuntime)} remain across {scopedEntries.length - scopedComplete} trackable items.</p></div></article>
        <article className="metric"><small>Time watched</small><strong>{formatTime(watchedRuntime)}</strong><span>Of {formatTime(totalRuntime)} in the archive</span></article>
        <article className="metric"><small>Current streak</small><strong>{streak} day{streak === 1 ? "" : "s"}</strong><span>Complete at least one item daily</span></article>
        <article className="metric"><small>Movies completed</small><strong>{completedMovies}</strong><span>{completedEpisodes} individual episodes completed</span></article>
        <article className="metric"><small>Estimated finish</small><strong className="date-metric">{estimatedFinish ? estimatedFinish.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Calculating…"}</strong><span>At an average of two hours per day</span></article>
        <article className="phase-panel"><div className="panel-heading"><h2>Phase progress</h2><span>Completion by release era</span></div>{phaseStats.map((stat) => <div className="phase-row" key={stat.phase}><b>{stat.phase}</b><div><i style={{ width: `${stat.percent}%` }} /></div><span>{stat.done}/{stat.total}</span></div>)}</article>
        <article className="breakdown"><div className="panel-heading"><h2>Archive composition</h2><span>What the 625-item journey contains</span></div>{(["movie", "episode", "special", "short"] as const).map((kind) => { const count = scopedEntries.filter(e => e.kind === kind).length; return <div key={kind}><span>{kind}</span><strong>{count}</strong><i style={{ width: `${count / scopedEntries.length * 100}%` }} /></div>; })}</article>
        <article className="recent-panel"><div className="panel-heading"><h2>Recently completed</h2><span>Your latest archive activity</span></div>{recentEntries.length ? recentEntries.map((item, index) => <button key={`${item.id}-${item.at}-${index}`} onClick={() => openEntry(item.entry)}><span>{item.entry?.title}</span><small>{item.entry?.detail} · {displayWatchedDate(item.at)}</small></button>) : <p>Complete an item to begin your viewing history.</p>}</article>
        <article className="metric"><small>Average rating</small><strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong><span>{rated.length} rated · {favorites.size} favorites</span></article>
        <article className="stone-panel"><div className="panel-heading"><h2>The Infinity Collection</h2><span>{infinityStones.filter((stone) => phaseStats.find((phase) => phase.phase === stone.phase)?.percent === 100).length} of 6 stones collected</span></div><div className="stone-grid">{infinityStones.map((stone) => { const earned = phaseStats.find((phase) => phase.phase === stone.phase)?.percent === 100; return <div className={earned ? "stone earned" : "stone"} key={stone.name}><i style={{ "--stone": stone.color } as React.CSSProperties} /><strong>{stone.name}</strong><span>{stone.phase} · {earned ? "Collected" : "Locked"}</span></div>; })}</div></article>
        <article className="recap-panel"><div className="panel-heading"><h2>End-of-phase recaps</h2><span>{completedPhases.length} complete</span></div><div className="recap-grid">{phaseStats.map((stat) => { const phaseEntries = scopedEntries.filter((entry) => entry.phase === stat.phase); const dates = history.filter((event) => phaseEntries.some((entry) => entry.id === event.id)).map((event) => event.at).sort(); const favorite = phaseEntries.filter((entry) => ratings[entry.id]).sort((a, b) => (ratings[b.id] || 0) - (ratings[a.id] || 0))[0]; return <div className={stat.percent === 100 ? "phase-recap complete" : "phase-recap"} key={stat.phase}><small>{stat.percent === 100 ? "Recap unlocked" : `${Math.round(stat.percent)}% complete`}</small><strong>{stat.phase}</strong><span>{formatTime(phaseEntries.reduce((sum, entry) => sum + entry.runtime, 0))} · {stat.total} entries</span>{stat.percent === 100 && <><b>Top rated: {favorite?.collection || "Not rated yet"}</b><em>{dates.length ? `${displayWatchedDate(dates[0])} — ${displayWatchedDate(dates.at(-1)!)}` : "Watch dates unavailable"}</em></>}</div>; })}</div></article>
        <article className="achievement-panel"><div className="panel-heading"><h2>Milestones</h2><span>{achievements.filter((item) => item.unlocked).length} of {achievements.length} unlocked</span></div><div className="achievement-grid">{achievements.map((item) => <div className={item.unlocked ? "achievement unlocked" : "achievement"} key={item.name}><i>{item.icon}</i><div><strong>{item.name}</strong><span>{item.description}</span></div></div>)}</div></article>
      </div>
    </section>}

    {view === "history" && <section className="inner-page history-page">
      <div className="page-heading"><p className="eyebrow">Archive records</p><h1>Your viewing history.</h1><p>Recently opened and edited entries, every watch date, and rewatch activity for this profile.</p></div>
      <div className="history-metrics"><article><small>Total viewings</small><strong>{history.length}</strong></article><article><small>Rewatches</small><strong>{rewatchCount}</strong></article><article><small>Active days</small><strong>{activeDays.size}</strong></article></div>
      <div className="history-grid"><article className="calendar-panel"><div className="panel-heading"><h2>{today?.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><span>Viewing calendar</span></div><div className="calendar-weekdays">{["S","M","T","W","T","F","S"].map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}</div><div className="calendar-grid">{calendarDays[0] && Array.from({ length: calendarDays[0].offset }).map((_, index) => <i key={`blank-${index}`} />)}{calendarDays.map((day) => <button key={day.key} className={day.events.length ? "active" : ""} title={day.events.map((event) => entries.find((entry) => entry.id === event.id)?.title).filter(Boolean).join(", ")}><span>{day.day}</span>{day.events.length > 0 && <small>{day.events.length}</small>}</button>)}</div></article><article className="activity-panel"><div className="panel-heading"><h2>Recent activity</h2><span>Viewed and edited</span></div>{recentActivity.length ? recentActivity.map((event, index) => <button key={`${event.id}-${event.type}-${index}`} onClick={() => openEntry(event.entry)}><span><b>{event.entry?.title}</b><small>{event.type === "viewed" ? "Opened details" : "Updated personal record"}</small></span><time>{new Date(event.at).toLocaleDateString()}</time></button>) : <p>Open or edit an entry to build this list.</p>}</article></div>
      <article className="rewatch-panel"><div className="panel-heading"><h2>Rewatch history</h2><span>Items viewed more than once</span></div>{[...historyByItem.entries()].filter(([, events]) => events.length > 1).sort((a, b) => b[1].length - a[1].length).map(([id, events]) => { const entry = entries.find((item) => item.id === id); return <button key={id} onClick={() => openEntry(entry)}><strong>{entry?.title}</strong><span>{events.length} viewings</span><small>{events.map((event) => displayWatchedDate(event.at)).join(" · ")}</small></button>; })}{rewatchCount === 0 && <p>No rewatches recorded yet. Use <b>Watch again</b> in any completed entry.</p>}</article>
    </section>}

    {view === "timeline" && <section className="inner-page timeline-page">
      <div className="page-heading"><p className="eyebrow">Release-order journey</p><h1>Six phases. One continuous archive.</h1><p>A high-level map of your progress without losing the precise release sequence.</p></div>
      <div className="timeline-track">{phaseStats.map((stat, index) => <article key={stat.phase}><div className="timeline-node"><span>{index + 1}</span></div><div><small>Era {String(index + 1).padStart(2, "0")}</small><h2>{stat.phase}</h2><p>{stat.total} items · {Math.round(stat.percent)}% complete</p><div className="phase-line"><i style={{ width: `${stat.percent}%` }} /></div></div></article>)}</div>
    </section>}
    {view === "settings" && <section className="inner-page settings-page">
      <div className="page-heading"><p className="eyebrow">Archive control center</p><h1>Your archive, everywhere.</h1><p>Keep using the archive locally, or connect Google to securely sync your profiles between devices.</p></div>
      <div className="settings-grid">
        <article className="cloud-sync-card">
          <div className="panel-heading"><h2>Google profile sync</h2><span className={`sync-badge ${syncStatus}`}>{syncStatus === "local" ? "Local only" : syncStatus}</span></div>
          {user ? <>
            <div className="google-account">{user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}<span><strong>{user.displayName || "Google account"}</strong><small>{user.email}</small></span></div>
            <p>Your profiles save locally first and sync automatically. Watched dates are merged safely when devices reconnect.</p>
            {lastSyncedAt && <p className="last-sync">Last synced {new Date(lastSyncedAt).toLocaleString()}</p>}
            <div className="settings-actions"><button onClick={syncNow}>Sync now</button><button onClick={() => signOutGoogle()}>Sign out</button><button className="danger" onClick={removeCloudArchive}>Delete cloud archive</button></div>
          </> : <>
            <p>Google sign-in is optional. Connecting uploads your current local profiles and makes them available on your other signed-in devices.</p>
            <button className="google-signin" onClick={connectGoogle}>Continue with Google</button>
          </>}
        </article>
        <article><div className="panel-heading"><h2>Watch-through profiles</h2><button onClick={createProfile}>New profile</button></div><p>Run a fresh chronological rewatch without erasing your original release-order journey.</p>{profiles.map((profile) => <div className={`profile-row ${profile.id === activeProfileId ? "active" : ""}`} key={profile.id}><button onClick={() => loadProfile(profile)}><strong>{profile.name}</strong><span>{profile.completed.length} completed · {profile.order === "release" ? "Release order" : "MCU timeline"}</span></button><button onClick={() => deleteProfile(profile.id)} aria-label={`Delete ${profile.name}`}>×</button></div>)}</article>
        <article><div className="panel-heading"><h2>Data management</h2></div><p>Backup every profile, viewing date, rating, favorite, note, theme, and activity record.</p><div className="settings-actions"><button onClick={exportProgress}>Export full backup</button><button onClick={() => importRef.current?.click()}>Restore backup</button><button onClick={shareProgress}>Download Archive Passport</button><button className="danger" onClick={() => { if (confirm("Reset only this profile?")) { setCompleted(new Set()); setHistory([]); setActivity([]); setRatings({}); setFavorites(new Set()); setNotes({}); } }}>Reset active profile</button></div></article>
        <article><div className="panel-heading"><h2>Visual theme</h2></div><p>Choose a profile-specific title-page treatment.</p><div className="theme-grid">{themes.map((option) => <button key={option.id} className={theme === option.id ? `theme-${option.id} active` : `theme-${option.id}`} onClick={() => setTheme(option.id)}><i />{option.name}</button>)}</div></article>
        <article><div className="panel-heading"><h2>Catalog update center</h2><span>Current</span></div><dl><div><dt>App version</dt><dd>{APP_VERSION}</dd></div><div><dt>Metadata version</dt><dd>{METADATA_VERSION}</dd></div><div><dt>Items indexed</dt><dd>{entries.length}</dd></div><div><dt>Upcoming monitored</dt><dd>{upcomingProjects.length}</dd></div></dl><p className="update-note"><strong>Latest catalog release</strong> No unresolved catalog migrations. Upcoming projects remain staged separately until their release date and a reviewed catalog update.</p></article>
        <article className="whats-new"><div className="panel-heading"><h2>What’s new in v14.2</h2></div><p>Optional Google sign-in, local-first cross-device profile sync, safe first-login migration choices, automatic conflict merging, live sync status, manual sync, and cloud-data controls.</p><p>MCU On This Day facts remain reserved for the research-backed fact catalog update.</p></article>
      </div>
    </section>}
    <DetailDrawer key={selectedEntry?.id || "closed"} entry={selectedEntry} completed={!!selectedEntry && completed.has(selectedEntry.id)} hideSpoilers={hideSpoilers} rating={selectedEntry ? ratings[selectedEntry.id] || 0 : 0} favorite={!!selectedEntry && favorites.has(selectedEntry.id)} note={selectedEntry ? notes[selectedEntry.id] || "" : ""} watchDates={selectedEntry ? (historyByItem.get(selectedEntry.id) || []).map((event) => event.at) : []} onClose={closeDetails} onToggle={() => selectedEntry && toggleEntry(selectedEntry.id, selectedEntry.episode ? `${selectedEntry.title} ${selectedEntry.detail}` : selectedEntry.title)} onRating={(value) => selectedEntry && (setRatings((current) => { const next = { ...current }; if (value) next[selectedEntry.id] = value; else delete next[selectedEntry.id]; return next; }), recordActivity(selectedEntry.id, "edited"))} onFavorite={() => selectedEntry && (setFavorites((current) => { const next = new Set(current); if (next.has(selectedEntry.id)) next.delete(selectedEntry.id); else next.add(selectedEntry.id); return next; }), recordActivity(selectedEntry.id, "edited"))} onNote={(value) => selectedEntry && (setNotes((current) => ({ ...current, [selectedEntry.id]: value })), recordActivity(selectedEntry.id, "edited"))} onWatchedDate={(value) => selectedEntry && setEntryWatchedDate(selectedEntry.id, value)} onRewatch={(value) => selectedEntry && addRewatch(selectedEntry.id, value)} />
    <UpcomingDrawer key={selectedUpcoming?.title || "upcoming-closed"} project={selectedUpcoming} onClose={() => setSelectedUpcoming(undefined)} />
    {achievementToast && <div className="achievement-splash" role="status"><button onClick={() => setAchievementToast(undefined)} aria-label="Dismiss achievement">×</button><div className="achievement-badge"><span>{achievementToast.icon}</span></div><p>Achievement unlocked</p><h2>{achievementToast.name}</h2><div>{achievementToast.description}</div></div>}
    {toast && <div className="undo-toast" role="status"><span>{toast.message}</span><button onClick={undoToast}>Undo</button></div>}
    <footer><strong>THE INFINITY ARCHIVE</strong><span>Unofficial fan-made tracker. Poster imagery is retrieved from Wikipedia/Wikimedia. Trailer buttons open YouTube; no movies or episodes are hosted or streamed here.</span><button onClick={exportProgress}>Export your progress</button></footer>
  </main>;
}
