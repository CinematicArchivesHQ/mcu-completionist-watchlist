export type MetadataOverride = {
  title?: string;
  releaseDate?: string;
  genres?: string[];
  cast?: string[];
  description?: string;
  trailer?: string;
};

export function metadataKey(collection: string, season?: number, episode?: number) {
  return season && episode ? `${collection}|S${season}E${episode}` : collection;
}

// Hand-corrected records take precedence over public metadata. Add entries here
// whenever a source returns the wrong adaptation, artwork-era, cast order, or trailer.
export const metadataOverrides: Record<string, MetadataOverride> = {
  "Iron Man": {
    trailer: "https://www.youtube.com/watch?v=8ugaeA-nMTc",
    description: "After billionaire weapons manufacturer Tony Stark is captured by terrorists, he builds a powered suit to escape. Returning home, he perfects the armor, confronts the damage caused by his company’s weapons, and faces a trusted associate determined to seize his technology.",
  },
  "The Incredible Hulk": { trailer: "https://www.youtube.com/watch?v=xbqNb2PFKKA", description: "Living in hiding while searching for a cure, Bruce Banner is forced back into the open when General Ross resumes his hunt. After soldier Emil Blonsky becomes the monstrous Abomination, Banner must embrace the Hulk to stop him." },
  "Iron Man 2": { trailer: "https://www.youtube.com/watch?v=wKtcmiifycU", description: "With the world aware that he is Iron Man, Tony Stark faces government pressure to surrender his technology, a dangerous illness caused by his arc reactor, and Ivan Vanko, who builds weapons to avenge his family." },
  "Thor": { trailer: "https://www.youtube.com/watch?v=JOddp-nlNvQ", description: "After his arrogance reignites an ancient conflict, Thor is stripped of his power and banished from Asgard to Earth. As Loki schemes for the throne, Thor must learn humility and prove himself worthy of Mjolnir." },
  "The Consultant": { description: "Agents Coulson and Sitwell devise a plan to keep Emil Blonsky out of the Avengers Initiative by sending Tony Stark to sabotage General Ross's meeting with an intentionally abrasive consultation." },
  "Captain America: The First Avenger": { trailer: "https://www.youtube.com/watch?v=JerVrbLldXw", description: "Rejected by the army but determined to serve, Steve Rogers volunteers for an experiment that transforms him into a super-soldier. He leads the fight against HYDRA and the Red Skull's plans to weaponize the Tesseract." },
  "A Funny Thing Happened on the Way to Thor's Hammer": { description: "On his way to investigate Thor's hammer in New Mexico, Agent Phil Coulson stops at a gas station and calmly foils an armed robbery, revealing how capable he is away from his desk." },
  "The Avengers": { trailer: "https://www.youtube.com/watch?v=eOrNdBpGMv8", description: "When Loki steals the Tesseract and opens Earth to a Chitauri invasion, Nick Fury assembles Iron Man, Captain America, Thor, Hulk, Black Widow, and Hawkeye. The divided heroes must become a team to save New York." },
  "Item 47": { description: "After the Battle of New York, a struggling couple finds a discarded Chitauri weapon and uses it to rob banks. S.H.I.E.L.D. agents Sitwell and Blake are sent to recover the alien artifact and contain the fallout." },
  "Iron Man 3": { description: "Haunted by the Battle of New York, Tony Stark confronts a terrorist called the Mandarin and scientist Aldrich Killian. Stripped of his armor and resources, Tony must rely on ingenuity to rescue Pepper and uncover the deception." },
  "Marvel One-Shot: Agent Carter": { description: "A year after Captain America's disappearance, Peggy Carter is sidelined by the sexist bureaucracy of the SSR. Defying orders, she takes a dangerous solo mission to recover the mysterious Zodiac serum." },
  "Thor: The Dark World": { description: "When Jane Foster becomes host to the reality-warping Aether, Thor must protect her from Malekith and the Dark Elves. With the Convergence threatening the Nine Realms, Thor reluctantly turns to Loki for help." },
  "All Hail the King": { description: "Imprisoned actor Trevor Slattery believes a documentary crew has come to profile his notorious Mandarin performance. Instead, the interview reveals that the real Ten Rings organization is furious that he stole its leader's name." },
  "Captain America: The Winter Soldier": { description: "Steve Rogers uncovers a conspiracy inside S.H.I.E.L.D. and goes on the run with Natasha Romanoff and Sam Wilson. Their pursuit leads to a ghost from Steve's past: the brainwashed assassin known as the Winter Soldier." },
  "Guardians of the Galaxy": { trailer: "https://www.youtube.com/watch?v=d96cjJhvlMA", description: "After stealing a mysterious orb, Peter Quill is hunted by Ronan the Accuser and forced into an alliance with Gamora, Drax, Rocket, and Groot. The misfits must protect Xandar from the orb's devastating power." },
  "Avengers: Age of Ultron": { trailer: "https://www.youtube.com/watch?v=tmeOjFno6Do", description: "Tony Stark and Bruce Banner's peacekeeping experiment creates Ultron, an artificial intelligence determined to eradicate humanity. The Avengers face their own fractures while trying to stop Ultron and his enhanced allies." },
  "Ant-Man": { description: "Recently released thief Scott Lang is recruited by Hank Pym to wear a suit that can shrink its user while increasing strength. Scott must master the technology and stop Darren Cross from weaponizing Pym's work." },
  "Captain America: Civil War": { trailer: "https://www.youtube.com/watch?v=dKrVegVI0Us", description: "Government oversight divides the Avengers, with Tony Stark supporting the Sokovia Accords and Steve Rogers resisting them. The conflict becomes personal when Bucky Barnes is framed for an attack and a hidden enemy exploits the team's grief." },
  "Team Thor, Part I": { description: "While the Avengers feud, Thor takes a break in Australia and moves in with office worker Darryl. Thor documents domestic life, investigates Infinity Stones on a classroom board, and tries to contact his teammates." },
  "Doctor Strange": { description: "After a car crash ends his surgical career, Stephen Strange travels to Kamar-Taj seeking a cure. Under the Ancient One, he learns the mystic arts and must stop Kaecilius from delivering Earth to Dormammu's Dark Dimension." },
  "Team Thor, Part II": { description: "Thor and Darryl continue their awkward life as roommates. Thor struggles to pay rent with Asgardian currency, dictates emails to Captain America and Iron Man, and attempts to find a servant of his own." },
  "Guardians of the Galaxy, Vol. 2": { description: "The Guardians are hired to protect valuable batteries before Rocket's theft puts them on the run. Peter Quill meets his celestial father Ego, whose warm welcome conceals a plan that threatens life across the galaxy." },
  "Spider-Man: Homecoming": { description: "Eager to prove himself after fighting alongside the Avengers, Peter Parker balances high school with neighborhood heroics. His pursuit of weapons dealer Adrian Toomes forces him to learn what being Spider-Man truly demands." },
  "Thor: Ragnarok": { description: "Thor is imprisoned on Sakaar and forced into a gladiator contest against the Hulk while Hela seizes Asgard. To save his people, he assembles an unlikely team and confronts the prophecy of Ragnarok." },
  "Team Darryl": { description: "After Thor leaves, Darryl becomes the roommate of the newly arrived Grandmaster. Darryl tries to teach the deposed Sakaar ruler how to live on Earth while surviving his plans for domination." },
  "Black Panther": { description: "Newly crowned T'Challa returns to Wakanda, where outsider Erik Killmonger challenges him for the throne. Their conflict forces Wakanda to reckon with its isolation and decide what responsibility it owes the wider world." },
  "Avengers: Infinity War": { trailer: "https://www.youtube.com/watch?v=6ZfuNTqbHE8", description: "Thanos begins collecting all six Infinity Stones to erase half of all life. The Avengers, Guardians, Wakandans, and their allies fight across Earth and space to stop him before he completes the Infinity Gauntlet." },
  "Ant-Man & the Wasp": { description: "While under house arrest, Scott Lang is drawn into Hank Pym and Hope van Dyne's mission to rescue Janet from the Quantum Realm. They are pursued by the unstable Ghost and black-market dealer Sonny Burch." },
  "Captain Marvel": { description: "Vers, a Kree warrior with no memory of her past, crashes on Earth in 1995 and teams with Nick Fury. Discovering that her identity and the Kree-Skrull war are not what she was told, she unlocks her full cosmic power." },
  "Avengers: Endgame": { trailer: "https://www.youtube.com/watch?v=TcMBFSGVi1c", description: "Five years after Thanos's victory, the surviving Avengers discover a chance to reverse the devastation. Their time-heist through pivotal moments of the past leads to a final battle for the fate of the universe." },
  "Peter's To-Do List": { description: "Before leaving for Europe, Peter Parker races through a list of errands: obtaining travel supplies, selling his toys, confronting criminals, and securing a gift for MJ." },
  "Spider-Man: Far From Home": { description: "Peter Parker hopes for a normal European school trip after Tony Stark's death, but Nick Fury recruits him to face elemental threats beside the heroic Mysterio. Peter soon learns that appearances—and inherited power—can be dangerously misleading." },
  "Black Widow": { description: "Natasha Romanoff reunites with her estranged spy family after a conspiracy tied to the Red Room resurfaces. Together they confront Dreykov, the assassin Taskmaster, and the system that turned young women into controlled Widows." },
  "Shang-Chi and the Legend of the Ten Rings": { description: "Shang-Chi's quiet life in San Francisco ends when the Ten Rings organization attacks him. Returning to his family, he must confront his immortal father Wenwu and a supernatural threat hidden beyond the village of Ta Lo." },
  "Eternals": { description: "A race of immortal beings who have secretly protected humanity for millennia reunites after the Blip. As Deviants return, the Eternals discover the true purpose of their mission and face a choice over Earth's survival." },
  "Spider-Man: No Way Home": { description: "When a spell meant to restore Peter Parker's secret identity fractures the multiverse, villains from other realities enter his world. Peter must choose between an easy solution and giving each enemy a chance at redemption." },
  "Doctor Strange in the Multiverse of Madness": { description: "Doctor Strange protects America Chavez, a teenager able to travel between universes, from a relentless pursuer. Their flight through the multiverse brings Strange face-to-face with alternate selves and Wanda Maximoff's grief-fueled power." },
  "Thor: Love and Thunder": { description: "Thor's search for peace ends when Gorr the God Butcher begins killing deities. Joined by Valkyrie, Korg, and Jane Foster—now wielding Mjolnir as the Mighty Thor—he sets out to stop Gorr's crusade." },
  "Werewolf by Night": { description: "After the death of monster hunter Ulysses Bloodstone, rival hunters gather for a deadly ceremonial hunt. Jack Russell and Elsa Bloodstone uncover the ritual's secrets while trying to save its hunted creature." },
  "Black Panther: Wakanda Forever": { description: "As Wakanda mourns King T'Challa, Queen Ramonda, Shuri, M'Baku, Okoye, and the Dora Milaje defend the nation from outside pressure and a new threat led by Namor of Talokan." },
  "The Guardians of the Galaxy Holiday Special": { description: "Determined to cheer up Peter Quill for Christmas, Mantis and Drax travel to Earth to find the perfect gift: actor Kevin Bacon. Their well-meant kidnapping turns into an unexpectedly heartfelt holiday celebration." },
  "Ant-Man & the Wasp: Quantumania": { description: "Scott Lang and his family are pulled into the Quantum Realm, where they encounter strange civilizations and the exiled conqueror Kang. Escaping requires confronting bargains, rebellion, and a threat capable of reshaping time." },
  "Guardians of the Galaxy, Vol. 3": { description: "When Rocket is critically injured, the Guardians race to uncover his origin and override a deadly implant. Their mission brings them against the High Evolutionary, whose cruel experiments created Rocket." },
  "The Marvels": { description: "Carol Danvers, Monica Rambeau, and Kamala Khan begin swapping places whenever they use their powers. To stop Kree leader Dar-Benn from tearing holes in space, the three must learn to work as a team." },
  "Deadpool & Wolverine": { description: "Wade Wilson is pulled into the Time Variance Authority and learns that his universe is dying. He recruits a reluctant Wolverine for a violent, irreverent journey through the Void to save their worlds." },
  "Captain America: Brave New World": { description: "Sam Wilson becomes entangled in an international conspiracy after meeting President Thaddeus Ross. As hidden forces trigger global conflict, the new Captain America must expose the plot before Ross's rage transforms the crisis." },
  "Thunderbolts*": { description: "A group of damaged antiheroes—including Yelena Belova, Bucky Barnes, Red Guardian, Ghost, Taskmaster, and U.S. Agent—is trapped in a deadly setup. Their survival depends on confronting both Valentina's agenda and the darkness consuming Bob." },
  "The Fantastic Four: First Steps": { description: "On a retro-futuristic world, Reed Richards, Sue Storm, Johnny Storm, and Ben Grimm balance family life with their role as celebrated heroes. Their world is threatened when the Silver Surfer heralds the arrival of Galactus." },
  "The Punisher: One Last Kill": { description: "Frank Castle returns for one final, brutal mission as the Punisher, confronting a threat that forces him to decide what remains after a life defined by vengeance." },
};

// Episode-level corrections cover records whose public feed has no synopsis or
// only a promotional tagline. Keys deliberately match the tracker coordinates.
export const episodeMetadataOverrides: Record<string, MetadataOverride> = {
  "WHiH Newsfront|S1E1": { description: "Christine Everhart introduces WHIH Newsfront's rolling coverage of the changing world after the Battle of Sokovia and previews the network's reports leading into Ant-Man." },
  "WHiH Newsfront|S1E2": { description: "WHIH reviews its top stories, including the aftermath of the Avengers' battle in Sokovia and growing public concern over enhanced individuals." },
  "WHiH Newsfront|S1E3": { description: "WHIH airs exclusive VistaCorp security footage showing cyber-criminal Scott Lang's 2012 break-in, establishing the history behind the future Ant-Man." },
  "WHiH Newsfront|S1E4": { description: "A WIRED Insider segment profiles Pym Technologies CEO Darren Cross and his ambitious attempt to commercialize revolutionary shrinking technology." },
  "Agents of S.H.I.E.L.D.: Slingshot|S1E4": { description: "May confronts Yo-Yo after discovering that she stole Director Mace's credentials to continue her unauthorized hunt for Victor Ramon." },
  "Agents of S.H.I.E.L.D.: Slingshot|S1E5": { description: "Yo-Yo closes in on Victor Ramon and receives unexpected help, forcing her to reconsider how far she will go to settle the score." },
  "The Daily Bugle|S2E1": { description: "Betty Brant welcomes viewers as The Daily Bugle launches its TikTok operation and expands J. Jonah Jameson's campaign against Spider-Man." },
  "The Daily Bugle|S2E2": { description: "Betty invites viewers to explain that they hate Spider-Man without saying it directly as Jameson's anti-Spider-Man message moves onto social media." },
  "The Daily Bugle|S2E3": { description: "The Daily Bugle recruits unpaid interns, inviting viewers to join its newsroom and help investigate the Spider-Man story." },
  "The Daily Bugle|S2E4": { description: "The Bugle reports bizarre lightning and sand storms in New York City and speculates about the super-powered forces behind them." },
  "The Daily Bugle|S2E5": { description: "Prospective Bugle reporters face a teleprompter challenge designed to test whether they can deliver breaking news under pressure." },
  "The Daily Bugle|S2E6": { description: "Betty Brant questions Coach Wilson about Peter Parker and the controversy surrounding Spider-Man in a school-focused edition of Burning Questions." },
  "The Daily Bugle|S2E7": { description: "Flash Thompson joins Betty Brant to promote his book and claim credit for creating the name Spider-Man." },
  "The Daily Bugle|S2E8": { description: "Betty interviews Peter Parker's best friend Ned Leeds about Peter, Spider-Man, and the upheaval surrounding their classmates." },
  "The Daily Bugle|S2E9": { description: "Betty leads a Daily Bugle edition of the social-media game Put a Finger Down, centered on Spider-Man and the newsroom's reporting." },
  "The Daily Bugle|S2E10": { description: "The Bugle delivers breaking news that Peter Parker, publicly identified as Spider-Man, has been released after questioning." },
  "The Daily Bugle|S2E11": { description: "Peter Parker sits down with Betty Brant for a tense Bugle interview after the world learns that he is Spider-Man." },
  "The Daily Bugle|S2E12": { description: "Betty Brant wonders whether the Bugle hired her for her reporting ability or simply because of her personal connection to Peter Parker." },
  "The Daily Bugle|S2E13": { description: "The newsroom pauses its Spider-Man coverage for a tongue-in-cheek advertisement promoting Daily Bugle nutritional supplements." },
  "The Daily Bugle|S2E14": { title: "Spider-Man's Web of Lies", description: "J. Jonah Jameson presents an exclusive report portraying Peter Parker's public statements as a web of lies and renews his case against Spider-Man." },
  "The Daily Bugle|S2E15": { title: "Spider Sycophant Revealed", description: "The Bugle targets one of Spider-Man's supporters, framing the ally as a sycophant aiding the masked menace." },
  "The Daily Bugle|S2E16": { title: "Sticky Street Job", description: "Jameson's newsroom investigates a suspicious street incident and attributes the sticky evidence to Spider-Man." },
  "The Daily Bugle|S2E17": { title: "Spider-Menace Tip Line", description: "The Daily Bugle opens a public tip line and asks New Yorkers to report sightings and evidence connected to Spider-Man." },
  "The Daily Bugle|S2E18": { title: "Savies! A New Menace Emerges", description: "The Bugle reports on the dangerous new selfie trend called 'Savies' and links the public craze to Spider-Man's influence." },
  "The Daily Bugle|S2E19": { title: "The Spider-Menace Strikes Again", description: "J. Jonah Jameson returns with another exclusive accusing Spider-Man of causing chaos and endangering New York." },
  "WandaVision|S1E9": { description: "Wanda confronts Agatha while Vision battles his rebuilt counterpart. As the Hex collapses, Wanda must choose between the family she created and freeing the people of Westview." },
  "What If...?|S3E8": { description: "The Watcher and his allies face the consequences of his interventions as realities converge, bringing the season's multiversal stories together for a final reckoning." },
  "Secret Invasion|S1E2": { description: "Fury confronts the consequences of promises made to the Skrulls, while Gravik strengthens his rebellion and world leaders respond to the Moscow attack." },
  "Secret Invasion|S1E3": { description: "Fury and Talos race to stop a rebel Skrull strike as mistrust grows between them and Gravik's infiltration reaches deeper into the British government." },
  "Secret Invasion|S1E4": { description: "Fury reels from a devastating betrayal and joins Talos in a desperate effort to save President Ritson from Gravik's ambush." },
  "Secret Invasion|S1E6": { description: "Fury confronts Gravik at New Skrullos while G'iah risks everything to stop him, and the exposure of the invasion unleashes new violence against Skrulls on Earth." },
  "Agatha All Along|S1E8": { description: "Agatha's past with her son Nicholas is revealed as Billy reaches the end of the Witches' Road and discovers the truth about the trials they survived." },
  "Daredevil: Born Again|S2E3": { description: "Matt Murdock and Karen Page seek new allies as the struggle against Fisk intensifies and the balance between justice and vengeance grows harder to maintain." },
  "Marvel Zombies|S1E2": { description: "The survivors take to the open road through a world ruled by the undead, where every stop risks drawing another ravenous horde." },
  "Marvel Zombies|S1E3": { description: "With the infected closing in, the remaining heroes confront fear, dwindling trust, and the horrifying cost of staying alive." },
  "Marvel Zombies|S1E4": { description: "The survivors make their final stand against the zombie plague in a bloody confrontation that decides who—if anyone—escapes." },
  "Wonder Man|S1E1": { description: "Struggling actor Simon Williams loses a role and his relationship before meeting Trevor Slattery at a revival screening. An audition for a Wonder Man remake offers Simon a new chance while Damage Control secretly investigates his unstable powers." },
  "Wonder Man|S1E3": { description: "Trevor joins Simon at his mother's birthday in Pacoima to gather evidence for Damage Control. Family tension triggers Simon's powers, but Trevor destroys the recording and encourages his new friend to keep acting." },
  "Wonder Man|S1E4": { description: "The story of actor DeMarr Davis reveals how his phasing powers made him the celebrity Doorman—and how an on-set tragedy led Hollywood to bar super-powered performers." },
  "Wonder Man|S1E5": { description: "After Simon uses his powers against men threatening Trevor, a witness records the incident and blackmails them into retrieving a stolen motorcycle before their crucial auditions." },
  "Wonder Man|S1E6": { description: "Simon and Trevor attend callbacks at director Von Kovak's home. Simon's fear nearly ruins the audition, but Trevor helps him give an honest performance that wins them both roles." },
  "Wonder Man|S1E7": { description: "As production begins, a New York Times profile threatens to expose Simon's secret. Trevor admits that Damage Control recruited him to spy, and a devastated Simon loses control on the film set." },
  "Wonder Man|S1E8": { description: "Trevor takes the blame for the destroyed set, allowing Simon to finish the hit film. Simon later infiltrates Damage Control's Yucca Valley prison and uses his ionic powers to free his friend." },
};

const genreAliases: Record<string, string> = {
  "action film": "Action", "adventure film": "Adventure", "science fiction film": "Science Fiction",
  "superhero film": "Superhero", "comedy film": "Comedy", "fantasy film": "Fantasy",
  "thriller film": "Thriller", "drama film": "Drama", "horror film": "Horror",
  "television series": "Television", "animated series": "Animation",
};

export function normalizeGenres(genres?: string[]) {
  return [...new Set((genres || []).map((genre) => genreAliases[genre.toLowerCase()] || genre.replace(/ film$/i, "")).map((genre) => genre.replace(/\b\w/g, (letter) => letter.toUpperCase())))].slice(0, 3);
}
