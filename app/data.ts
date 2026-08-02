import catalogData from "./catalog-data.json";

export type WatchEntry = {
  id: string;
  order: number;
  title: string;
  kind: "movie" | "episode" | "special" | "short";
  detail: string;
  phase: string;
  collection: string;
  sourceTitle: string;
  episode?: number;
  season?: number;
  runtime: number;
  scope: "official" | "adjacent" | "promotional";
  releaseDate?: string;
  genres?: string[];
  cast?: string[];
  description?: string;
  trailer?: string;
};

const rawTitles = `Iron Man
The Incredible Hulk
Iron Man 2
Thor
The Consultant
Captain America: The First Avenger
A Funny Thing Happened on the Way to Thor's Hammer
The Avengers
Item 47
Iron Man 3
Marvel One-Shot: Agent Carter
Agents of S.H.I.E.L.D.: Season 1, episodes 1-7
Thor: The Dark World
All Hail the King
Agents of S.H.I.E.L.D.: Season 1, episodes 8-16
Captain America: The Winter Soldier
Agents of S.H.I.E.L.D.: Season 1, episodes 17-22
Guardians of the Galaxy
Agent Carter: Season 1
Daredevil: Season 1
Agents of S.H.I.E.L.D.: Season 2, episodes 1-19
Avengers: Age of Ultron
Agents of S.H.I.E.L.D.: Season 2, episodes 20-22
WHiH Newsfront: Season 1
Ant-Man
Jessica Jones: Season 1
Agent Carter: Season 2
Daredevil: Season 2
Agents of S.H.I.E.L.D.: Season 3, episodes 1-19
WHiH Newsfront: Season 2
Captain America: Civil War
Team Thor, Part I
Agents of S.H.I.E.L.D.: Season 3, episodes 20-22
Luke Cage: Season 1
Doctor Strange
Team Thor, Part II
Agents of S.H.I.E.L.D.: Season 4, episodes 1-8
Agents of S.H.I.E.L.D.: Slingshot
Agents of S.H.I.E.L.D.: Season 4, episodes 9-22
Iron Fist: Season 1
Guardians of the Galaxy, Vol. 2
Spider-Man: Homecoming
The Defenders
Inhumans
Thor: Ragnarok
Team Darryl
The Punisher: Season 1
Runaways: Season 1
Black Panther
Jessica Jones: Season 2
Agents of S.H.I.E.L.D.: Season 5, episodes 1-18
Avengers: Infinity War
Agents of S.H.I.E.L.D.: Season 5, episodes 19-22
Cloak & Dagger: Season 1
Luke Cage: Season 2
Ant-Man & the Wasp
Iron Fist: Season 2
Daredevil: Season 3
Runaways: Season 2
The Punisher: Season 2
Captain Marvel
Avengers: Endgame
Cloak & Dagger: Season 2
Agents of S.H.I.E.L.D.: Season 6
Jessica Jones: Season 3
Peter's To-Do List
Spider-Man: Far From Home
The Daily Bugle: Season 1
Runaways: Season 3
Agents of S.H.I.E.L.D.: Season 7
Helstrom
WandaVision
The Falcon and the Winter Soldier
Loki: Season 1
Black Widow
What If...?: Season 1
Shang-Chi and the Legend of the Ten Rings
Eternals
Hawkeye
The Daily Bugle: Season 2
Spider-Man: No Way Home
Moon Knight
Doctor Strange in the Multiverse of Madness
Ms. Marvel
Thor: Love and Thunder
I Am Groot: Season 1
She-Hulk
Werewolf by Night
Black Panther: Wakanda Forever
The Guardians of the Galaxy Holiday Special
Ant-Man & the Wasp: Quantumania
Guardians of the Galaxy, Vol. 3
Secret Invasion
I Am Groot: Season 2
Loki: Season 2
The Marvels
What If...?: Season 2
Echo
Deadpool & Wolverine
Agatha All Along
What If...?: Season 3
Captain America: Brave New World
Daredevil: Born Again: Season 1
Thunderbolts*
Ironheart
The Fantastic Four: First Steps
Eyes of Wakanda
Marvel Zombies: Season 1
Wonder Man: Season 1
Daredevil: Born Again: Season 2
The Punisher: One Last Kill`;

const seasonCounts: Record<string, Record<number, number>> = {
  "Agents of S.H.I.E.L.D.": { 1: 22, 2: 22, 3: 22, 4: 22, 5: 22, 6: 13, 7: 13 },
  "Agent Carter": { 1: 8, 2: 10 }, "Daredevil": { 1: 13, 2: 13, 3: 13 },
  "Jessica Jones": { 1: 13, 2: 13, 3: 13 }, "Luke Cage": { 1: 13, 2: 13 },
  "Iron Fist": { 1: 13, 2: 10 }, "The Punisher": { 1: 13, 2: 13 },
  "Runaways": { 1: 10, 2: 13, 3: 10 }, "Cloak & Dagger": { 1: 10, 2: 10 },
  "WHiH Newsfront": { 1: 5, 2: 5 }, "The Daily Bugle": { 1: 6, 2: 19 },
  "Loki": { 1: 6, 2: 6 }, "What If...?": { 1: 9, 2: 9, 3: 8 },
  "I Am Groot": { 1: 5, 2: 5 }, "Daredevil: Born Again": { 1: 9, 2: 8 }
};

const limitedCounts: Record<string, number> = {
  "The Defenders": 8, Inhumans: 8, Helstrom: 10, WandaVision: 9,
  "The Falcon and the Winter Soldier": 6, Hawkeye: 6, "Moon Knight": 6,
  "Ms. Marvel": 6, "She-Hulk": 9, "Secret Invasion": 6, Echo: 5,
  "Agatha All Along": 9, Ironheart: 6, "Eyes of Wakanda": 4,
  "Marvel Zombies: Season 1": 4, "Wonder Man: Season 1": 8
};

const adjacent = /Agents of S\.H\.I\.E\.L\.D|Agent Carter|Daredevil|Jessica Jones|Luke Cage|Iron Fist|Defenders|Punisher|Runaways|Cloak & Dagger|Inhumans|Helstrom/;
const promotional = /WHiH|Daily Bugle|Team Thor|Team Darryl/;
const shortPattern = /One-Shot|Consultant|Funny Thing|Item 47|All Hail|Team Thor|Team Darryl|Peter's To-Do/;
const specialPattern = /Holiday Special|Werewolf by Night|One Last Kill/;

function phaseFor(index: number) {
  if (index < 11) return "Phase One";
  if (index < 31) return "Phase Two";
  if (index < 69) return "Phase Three";
  if (index < 96) return "Phase Four";
  if (index < 109) return "Phase Five";
  return "Phase Six";
}

function runtimeFor(kind: WatchEntry["kind"], title: string) {
  if (kind === "movie") return 126;
  if (kind === "episode") return /WHiH|Daily Bugle|Slingshot|I Am Groot/.test(title) ? 6 : 47;
  return kind === "short" ? 8 : 48;
}

type Expanded = { title: string; detail: string; sourceTitle: string; season?: number; episode?: number };

function expand(title: string): Expanded[] {
  const range = title.match(/^(.*?): Season (\d+), episodes (\d+)-(\d+)$/i);
  if (range) {
    const [, series, season, start, end] = range;
    return Array.from({ length: +end - +start + 1 }, (_, i) => ({ title: series, sourceTitle: title, season: +season, episode: +start + i, detail: `Season ${season} · Episode ${+start + i}` }));
  }
  const season = title.match(/^(.*?): Season (\d+)$/i);
  if (season && seasonCounts[season[1]]?.[+season[2]]) {
    return Array.from({ length: seasonCounts[season[1]][+season[2]] }, (_, i) => ({ title: season[1], sourceTitle: title, season: +season[2], episode: i + 1, detail: `Season ${season[2]} · Episode ${i + 1}` }));
  }
  if (title === "Agents of S.H.I.E.L.D.: Slingshot") return Array.from({ length: 6 }, (_, i) => ({ title, sourceTitle: title, season: 1, episode: i + 1, detail: `Episode ${i + 1}` }));
  if (limitedCounts[title]) return Array.from({ length: limitedCounts[title] }, (_, i) => ({ title: title.replace(/: Season 1$/, ""), sourceTitle: title, season: 1, episode: i + 1, detail: `Season 1 · Episode ${i + 1}` }));
  return [{ title, sourceTitle: title, detail: "Standalone" }];
}

const sourceTitles = rawTitles.trim().split(/\n/).map((title) => title.trim()).filter(Boolean);
let order = 0;
const baseEntries: WatchEntry[] = sourceTitles.flatMap((sourceTitle, sourceIndex) => expand(sourceTitle).map((item) => {
  const kind: WatchEntry["kind"] = item.episode ? "episode" : specialPattern.test(item.title) ? "special" : shortPattern.test(item.title) ? "short" : "movie";
  const scope: WatchEntry["scope"] = promotional.test(item.title) ? "promotional" : adjacent.test(item.title) ? "adjacent" : "official";
  order += 1;
  return { id: `entry-${order}`, order, title: item.title, kind, detail: item.detail, phase: phaseFor(sourceIndex), collection: item.title, sourceTitle: item.sourceTitle, season: item.season, episode: item.episode, runtime: runtimeFor(kind, item.title), scope };
}));

const existingCollections = new Set(baseEntries.map((entry) => entry.collection));
const releasedManagedEntries: WatchEntry[] = catalogData.projects
  .filter((project) => project.status === "released" && !existingCollections.has(project.title))
  .map((project, index) => ({
    id: project.archiveId,
    order: baseEntries.length + index + 1,
    title: project.title,
    kind: project.mediaType === "movie" ? "movie" : "special",
    detail: "Standalone",
    phase: project.phase,
    collection: project.title,
    sourceTitle: project.title,
    runtime: project.runtime || 126,
    scope: project.scope as WatchEntry["scope"],
    releaseDate: project.releaseDate,
    genres: project.genres,
    cast: project.cast,
    description: project.description,
    trailer: project.trailer,
  }));

export const entries: WatchEntry[] = [...baseEntries, ...releasedManagedEntries];

export const sourceCount = sourceTitles.length + releasedManagedEntries.length;
export const totalRuntime = entries.reduce((sum, entry) => sum + entry.runtime, 0);
