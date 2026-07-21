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

// Search credits must be available before a detail drawer is opened. Film
// metadata is enriched on demand, so relying on that cache made actor searches
// work mostly for episodes. These durable associations keep the archive search
// useful on a fresh install and also include common character-name queries.
const creditRules: Array<[RegExp, string]> = [
  [/^(Iron Man|Iron Man 2|Iron Man 3|The Incredible Hulk|The Avengers|Avengers: Age of Ultron|Captain America: Civil War|Spider-Man: Homecoming|Avengers: Infinity War|Avengers: Endgame)$/, "Robert Downey Jr Tony Stark Iron Man"],
  [/^(Captain America: The First Avenger|The Avengers|Captain America: The Winter Soldier|Avengers: Age of Ultron|Captain America: Civil War|Avengers: Infinity War|Avengers: Endgame)$/, "Chris Evans Steve Rogers Captain America"],
  [/^(Thor|The Avengers|Thor: The Dark World|Avengers: Age of Ultron|Thor: Ragnarok|Avengers: Infinity War|Avengers: Endgame|Thor: Love and Thunder)$/, "Chris Hemsworth Thor"],
  [/^(The Avengers|Captain America: The Winter Soldier|Avengers: Age of Ultron|Captain America: Civil War|Black Widow|Avengers: Infinity War|Avengers: Endgame)$/, "Scarlett Johansson Natasha Romanoff Black Widow"],
  [/^(The Avengers|Avengers: Age of Ultron|Captain America: Civil War|Thor: Ragnarok|Avengers: Infinity War|Avengers: Endgame|Hawkeye)$/, "Mark Ruffalo Bruce Banner Hulk Jeremy Renner Clint Barton Hawkeye"],
  [/^(Guardians of the Galaxy|Guardians of the Galaxy, Vol. 2|Avengers: Infinity War|Avengers: Endgame|Thor: Love and Thunder|The Guardians of the Galaxy Holiday Special|Guardians of the Galaxy, Vol. 3)$/, "Chris Pratt Peter Quill Star-Lord Zoe Saldana Gamora Dave Bautista Drax Bradley Cooper Rocket Vin Diesel Groot"],
  [/^(Ant-Man|Captain America: Civil War|Ant-Man & the Wasp|Avengers: Endgame|Ant-Man & the Wasp: Quantumania)$/, "Paul Rudd Scott Lang Ant-Man Evangeline Lilly Hope van Dyne Wasp"],
  [/^(Doctor Strange|Thor: Ragnarok|Avengers: Infinity War|Avengers: Endgame|Spider-Man: No Way Home|Doctor Strange in the Multiverse of Madness)$/, "Benedict Cumberbatch Stephen Strange Doctor Strange Benedict Wong Wong"],
  [/^(Black Panther|Captain America: Civil War|Avengers: Infinity War|Avengers: Endgame|Black Panther: Wakanda Forever)$/, "Chadwick Boseman T'Challa Black Panther Letitia Wright Shuri"],
  [/^(Captain Marvel|Avengers: Endgame|Shang-Chi and the Legend of the Ten Rings|Ms. Marvel|The Marvels)$/, "Brie Larson Carol Danvers Captain Marvel"],
  [/^(Spider-Man: Homecoming|Avengers: Infinity War|Avengers: Endgame|Peter's To-Do List|Spider-Man: Far From Home|Spider-Man: No Way Home)$/, "Tom Holland Peter Parker Spider-Man Zendaya MJ"],
  [/^(WandaVision|Avengers: Age of Ultron|Captain America: Civil War|Avengers: Infinity War|Avengers: Endgame|Doctor Strange in the Multiverse of Madness)$/, "Elizabeth Olsen Wanda Maximoff Scarlet Witch Paul Bettany Vision"],
  [/^(Loki|Thor|The Avengers|Thor: The Dark World|Thor: Ragnarok|Avengers: Infinity War|Avengers: Endgame)$/, "Tom Hiddleston Loki"],
  [/^Shang-Chi and the Legend of the Ten Rings$/, "Simu Liu Shang-Chi Awkwafina Katy Tony Leung Wenwu Destin Daniel Cretton"],
  [/^Eternals$/, "Gemma Chan Sersi Richard Madden Ikaris Angelina Jolie Thena Chloe Zhao"],
  [/^Black Widow$/, "Florence Pugh Yelena Belova David Harbour Alexei Shostakov Red Guardian Cate Shortland"],
  [/^Deadpool & Wolverine$/, "Ryan Reynolds Wade Wilson Deadpool Hugh Jackman Logan Wolverine Shawn Levy"],
  [/^The Fantastic Four: First Steps$/, "Pedro Pascal Reed Richards Mister Fantastic Vanessa Kirby Sue Storm Joseph Quinn Johnny Storm Ebon Moss-Bachrach Ben Grimm Matt Shakman"],
  [/^Captain America: Brave New World$/, "Anthony Mackie Sam Wilson Captain America Harrison Ford Thaddeus Ross Red Hulk Julius Onah"],
  [/^Thunderbolts\*$/, "Florence Pugh Yelena Belova Sebastian Stan Bucky Barnes Winter Soldier David Harbour Red Guardian Jake Schreier"],
  [/^Iron Man$/, "Jon Favreau director Gwyneth Paltrow Pepper Potts Jeff Bridges Obadiah Stane"],
  [/^Iron Man 2$/, "Jon Favreau director Gwyneth Paltrow Pepper Potts Don Cheadle James Rhodes War Machine Mickey Rourke Ivan Vanko"],
  [/^Iron Man 3$/, "Shane Black director Gwyneth Paltrow Pepper Potts Don Cheadle James Rhodes War Machine Guy Pearce Aldrich Killian"],
];

export function searchCreditsFor(entry: WatchEntry) {
  return creditRules.filter(([rule]) => rule.test(entry.collection)).map(([, terms]) => terms).join(" ");
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
