import type { WatchEntry } from "./data";

export type WatchOrder = "release" | "chronological";
export type Profile = {
  id: string; name: string; order: WatchOrder; scope: "completionist" | "official";
  completed: string[]; history: Array<{ id: string; at: string }>;
  ratings: Record<string, number>; favorites: string[]; notes: Record<string, string>;
  activity?: Array<{ id: string; at: string; type: "viewed" | "edited" }>;
  theme?: "infinity" | "tva" | "wakanda" | "stark" | "scarlet";
  createdAt: string; updatedAt: string;
};

// Marvel Studios' Disney+ timeline is the spine. Legacy, promotional, and
// alternate-universe material is placed at its closest story-era context.
const chronology = `Eyes of Wakanda
Captain America: The First Avenger
Marvel One-Shot: Agent Carter
Agent Carter
Captain Marvel
Iron Man
Iron Man 2
The Incredible Hulk
A Funny Thing Happened on the Way to Thor's Hammer
Thor
The Consultant
The Avengers
Item 47
Agents of S.H.I.E.L.D.
Thor: The Dark World
Iron Man 3
All Hail the King
Captain America: The Winter Soldier
Guardians of the Galaxy
Guardians of the Galaxy, Vol. 2
I Am Groot
Daredevil
Jessica Jones
Avengers: Age of Ultron
Ant-Man
Luke Cage
Iron Fist
The Defenders
Captain America: Civil War
Black Widow
Black Panther
Spider-Man: Homecoming
The Punisher
Doctor Strange
Thor: Ragnarok
Runaways
Cloak & Dagger
Inhumans
Ant-Man & the Wasp
Avengers: Infinity War
Avengers: Endgame
Loki
What If...?
WandaVision
The Falcon and the Winter Soldier
Shang-Chi and the Legend of the Ten Rings
Eternals
Spider-Man: Far From Home
The Daily Bugle
Spider-Man: No Way Home
Doctor Strange in the Multiverse of Madness
Hawkeye
Moon Knight
Black Panther: Wakanda Forever
Echo
She-Hulk
Ms. Marvel
Thor: Love and Thunder
Werewolf by Night
The Guardians of the Galaxy Holiday Special
Ant-Man & the Wasp: Quantumania
Guardians of the Galaxy, Vol. 3
Secret Invasion
The Marvels
Deadpool & Wolverine
Agatha All Along
Daredevil: Born Again
Captain America: Brave New World
Thunderbolts*
Ironheart
The Fantastic Four: First Steps
Marvel Zombies
Wonder Man
The Punisher: One Last Kill`.split("\n");

const rank = new Map(chronology.map((title, index) => [title, index]));
export function chronologicalRank(entry: WatchEntry) {
  return rank.get(entry.collection) ?? (1000 + entry.order);
}
export function orderEntries(items: WatchEntry[], order: WatchOrder) {
  if (order === "release") return [...items].sort((a, b) => a.order - b.order);
  return [...items].sort((a, b) => chronologicalRank(a) - chronologicalRank(b) || (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0) || a.order - b.order);
}

const franchiseRules: Array<[RegExp, string]> = [
  [/Iron Man|WHiH/, "Iron Man"], [/Captain America|Falcon and the Winter Soldier/, "Captain America"],
  [/Thor|Loki/, "Thor & Asgard"], [/Avengers|Ultron|Infinity War|Endgame/, "Avengers"],
  [/Guardians|I Am Groot/, "Guardians"], [/Spider-Man|Daily Bugle|Peter's To-Do/, "Spider-Man"],
  [/Daredevil|Defenders|Jessica Jones|Luke Cage|Iron Fist|Punisher|Echo|Born Again/, "Defenders Saga"],
  [/S\.H\.I\.E\.L\.D\.|Agent Carter/, "S.H.I.E.L.D."], [/WandaVision|Agatha/, "WandaVision"],
  [/Black Panther|Wakanda/, "Wakanda"], [/Doctor Strange/, "Doctor Strange"],
  [/Captain Marvel|Ms\. Marvel|The Marvels/, "Marvels"], [/Ant-Man/, "Ant-Man"],
];
export function franchiseFor(entry: WatchEntry) { return franchiseRules.find(([rule]) => rule.test(entry.collection))?.[1] || "Other MCU"; }
export function divisionFor(entry: WatchEntry) {
  if (entry.scope === "promotional") return "Marvel promotional";
  if (entry.scope === "adjacent") return /Daredevil|Jessica Jones|Luke Cage|Iron Fist|Defenders|Punisher/.test(entry.collection) ? "Marvel Television / Netflix" : "Marvel Television";
  return entry.kind === "episode" ? "Marvel Studios Television" : "Marvel Studios";
}
export function yearFor(entry: WatchEntry) {
  const phaseYear: Record<string, number> = { "Phase One": 2008, "Phase Two": 2013, "Phase Three": 2016, "Phase Four": 2021, "Phase Five": 2023, "Phase Six": 2025 };
  return phaseYear[entry.phase] || 2008;
}
export function presetMatches(entry: WatchEntry, preset: string) {
  if (!preset) return true;
  if (preset === "infinity") return ["Phase One", "Phase Two", "Phase Three"].includes(entry.phase);
  if (preset === "multiverse") return ["Phase Four", "Phase Five", "Phase Six"].includes(entry.phase);
  if (preset === "defenders") return franchiseFor(entry) === "Defenders Saga";
  if (preset === "one-shots") return entry.kind === "short";
  return true;
}

export type UpcomingProject = { title: string; date: string; type: string; runtime?: number; genres: string[]; cast: string[]; description: string; trailer: string };
export const upcomingProjects: UpcomingProject[] = [
  { title: "Spider-Man: Brand New Day", date: "2026-07-31", type: "Movie", genres: ["Superhero", "Action", "Adventure"], cast: ["Tom Holland", "Zendaya", "Jon Bernthal"], description: "Alone in a New York City that no longer remembers Peter Parker, Peter has devoted himself to being a full-time Spider-Man. As the pressure intensifies, a surprising physical evolution threatens his existence and forces him into an uneasy alliance with the Punisher.", trailer: "https://www.youtube.com/watch?v=aBlsrtxuwss" },
  { title: "Avengers: Doomsday", date: "2026-12-18", type: "Movie", genres: ["Superhero", "Action", "Science fiction"], cast: ["Robert Downey Jr.", "Chris Hemsworth", "Pedro Pascal"], description: "Heroes from three distinct universes are set on a deadly collision course as an existential multiversal threat emerges. The Avengers, Wakandans, Fantastic Four, New Avengers, and X-Men must confront Victor von Doom before their worlds are destroyed.", trailer: "https://www.youtube.com/watch?v=irVNGjRFZGk" },
];

export const infinityStones = [
  { phase: "Phase One", name: "Space Stone", color: "#3a8cff" },
  { phase: "Phase Two", name: "Mind Stone", color: "#f4cf42" },
  { phase: "Phase Three", name: "Reality Stone", color: "#e34452" },
  { phase: "Phase Four", name: "Power Stone", color: "#9e58db" },
  { phase: "Phase Five", name: "Time Stone", color: "#49c77a" },
  { phase: "Phase Six", name: "Soul Stone", color: "#ef8a38" },
];

export function achievementData(items: WatchEntry[], completed: Set<string>) {
  const done = items.filter((item) => completed.has(item.id));
  const award = (name: string, description: string, unlocked: boolean, icon: string) => ({ name, description, unlocked, icon });
  return [
    award("Archive Initiate", "Complete your first entry", done.length >= 1, "I"),
    award("Ten Rings", "Complete 10 entries", done.length >= 10, "X"),
    award("Century Club", "Complete 100 entries", done.length >= 100, "100"),
    award("Binge Protocol", "Complete 100 episodes", done.filter((e) => e.kind === "episode").length >= 100, "TV"),
    award("Infinity Saga", "Complete every Phase One–Three entry", items.filter((e) => ["Phase One", "Phase Two", "Phase Three"].includes(e.phase)).every((e) => completed.has(e.id)), "∞"),
    award("Defender", "Complete the Defenders Saga", items.filter((e) => franchiseFor(e) === "Defenders Saga").every((e) => completed.has(e.id)), "D"),
    award("One-Shot", "Complete every short", items.filter((e) => e.kind === "short").every((e) => completed.has(e.id)), "1"),
    award("Archive Complete", "Complete the entire archive", items.every((e) => completed.has(e.id)), "A"),
  ];
}
