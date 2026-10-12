export type Faction = "LEAF" | "SAND" | "MIST" | "CLOUD" | "SOUND" | "AKATSUKI" | "OTSUTSUKI";

export type Character = {
  id: string;
  name: string;
  image: string;
  /** Backdrop wash so official artwork with transparent margins still reads as a card. */
  tint: string;
  faction: Faction;
};

const WIKI = "https://static.wikia.nocookie.net/naruto/images";

/**
 * Every face is an actual Naruto character. Nine are painted key-art portraits
 * generated for this game; the rest are official Narutopedia character renders.
 * One character = exactly one pair, so no board ever shows a quad.
 */
export const CHARACTERS: Character[] = [
  { id: "naruto", name: "Naruto", image: "/images/naruto.jpg", tint: "#c8721f", faction: "LEAF" },
  { id: "sasuke", name: "Sasuke", image: "/images/sasuke.jpg", tint: "#2c3c68", faction: "LEAF" },
  { id: "sakura", name: "Sakura", image: "/images/sakura.jpg", tint: "#b84a62", faction: "LEAF" },
  { id: "kakashi", name: "Kakashi", image: "/images/kakashi.jpg", tint: "#3d5560", faction: "LEAF" },
  { id: "hinata", name: "Hinata", image: "/images/hinata.jpg", tint: "#63548f", faction: "LEAF" },
  { id: "rocklee", name: "Rock Lee", image: "/images/rocklee.jpg", tint: "#2c7440", faction: "LEAF" },
  { id: "jiraiya", name: "Jiraiya", image: "/images/jiraiya.jpg", tint: "#47744a", faction: "LEAF" },
  { id: "gaara", name: "Gaara", image: "/images/gaara.jpg", tint: "#93382c", faction: "SAND" },
  { id: "itachi", name: "Itachi", image: "/images/itachi.jpg", tint: "#75232e", faction: "AKATSUKI" },

  { id: "minato", name: "Minato", image: `${WIKI}/7/71/Minato_Namikaze.png/revision/latest/scale-to-width-down/480?cb=20160125175116`, tint: "#4a7fb5", faction: "LEAF" },
  { id: "kushina", name: "Kushina", image: `${WIKI}/d/db/Kushina.png/revision/latest/scale-to-width-down/480?cb=20150719165408`, tint: "#a83a30", faction: "LEAF" },
  { id: "tsunade", name: "Tsunade", image: `${WIKI}/b/b3/Tsunade_infobox2.png/revision/latest/scale-to-width-down/480?cb=20230315211457`, tint: "#4a8a5a", faction: "LEAF" },
  { id: "neji", name: "Neji", image: `${WIKI}/7/7e/Neji_Part_I.png/revision/latest/scale-to-width-down/480?cb=20160118081119`, tint: "#4d4d6e", faction: "LEAF" },
  { id: "shikamaru", name: "Shikamaru", image: `${WIKI}/4/44/Shikamaru_Part_I.png/revision/latest/scale-to-width-down/480?cb=20170419112314`, tint: "#3c5c3c", faction: "LEAF" },
  { id: "ino", name: "Ino", image: `${WIKI}/d/dd/Ino.png/revision/latest/scale-to-width-down/480?cb=20170622102745`, tint: "#6a4a8a", faction: "LEAF" },
  { id: "choji", name: "Choji", image: `${WIKI}/7/7d/Ch%C5%8Dji_Akimichi.png/revision/latest/scale-to-width-down/480?cb=20200426204415`, tint: "#a8402e", faction: "LEAF" },
  { id: "kiba", name: "Kiba", image: `${WIKI}/0/03/Kiba.png/revision/latest/scale-to-width-down/480?cb=20180124105049`, tint: "#6a5a4a", faction: "LEAF" },
  { id: "shino", name: "Shino", image: `${WIKI}/9/9c/Shino.png/revision/latest/scale-to-width-down/480?cb=20160924021327`, tint: "#3a4a52", faction: "LEAF" },
  { id: "guy", name: "Might Guy", image: `${WIKI}/3/31/Might_Guy.png/revision/latest/scale-to-width-down/480?cb=20150401084456`, tint: "#2a7a44", faction: "LEAF" },
  { id: "tenten", name: "Tenten", image: `${WIKI}/d/da/Tenten_Part_1.png/revision/latest/scale-to-width-down/480?cb=20180510203032`, tint: "#8a4a5a", faction: "LEAF" },
  { id: "sai", name: "Sai", image: `${WIKI}/0/07/Sai_Infobox.png/revision/latest/scale-to-width-down/480?cb=20180314110836`, tint: "#6a6a74", faction: "LEAF" },
  { id: "yamato", name: "Yamato", image: `${WIKI}/f/f7/Yamato_newshot.png/revision/latest/scale-to-width-down/480?cb=20180920062234`, tint: "#3a5a5a", faction: "LEAF" },
  { id: "iruka", name: "Iruka", image: `${WIKI}/b/bc/Iruka.png/revision/latest/scale-to-width-down/480?cb=20161013212102`, tint: "#6a4a3a", faction: "LEAF" },
  { id: "asuma", name: "Asuma", image: `${WIKI}/7/7c/Asuma.png/revision/latest/scale-to-width-down/480?cb=20150822043018`, tint: "#4a5a3a", faction: "LEAF" },
  { id: "anko", name: "Anko", image: `${WIKI}/b/bd/Anko_Part_I.png/revision/latest/scale-to-width-down/480?cb=20170412103610`, tint: "#7a5a3a", faction: "LEAF" },
  { id: "shizune", name: "Shizune", image: `${WIKI}/0/0a/Shizune_Infobox.png/revision/latest/scale-to-width-down/480?cb=20170726101304`, tint: "#5a4a6a", faction: "LEAF" },
  { id: "hiruzen", name: "Hiruzen", image: `${WIKI}/e/e8/Young_Hiruzen_Mobile.png/revision/latest/scale-to-width-down/448?cb=20210422155026`, tint: "#7a5a4a", faction: "LEAF" },

  { id: "temari", name: "Temari", image: `${WIKI}/b/bb/Temari_newshot.png/revision/latest/scale-to-width-down/480?cb=20180131102406`, tint: "#8a6a2a", faction: "SAND" },

  { id: "zabuza", name: "Zabuza", image: `${WIKI}/a/a6/Zabuza_OL.png/revision/latest/scale-to-width-down/240?cb=20210426223426`, tint: "#4a5a5a", faction: "MIST" },
  { id: "haku", name: "Haku", image: `${WIKI}/3/35/Haku%27s_shinobi_attire.png/revision/latest/scale-to-width-down/251?cb=20160610212143`, tint: "#6a8a9a", faction: "MIST" },

  { id: "killerb", name: "Killer B", image: `${WIKI}/6/63/Killer_B.png/revision/latest/scale-to-width-down/480?cb=20180425141557`, tint: "#8a7a3a", faction: "CLOUD" },

  { id: "orochimaru", name: "Orochimaru", image: `${WIKI}/1/14/Orochimaru_Infobox.png/revision/latest/scale-to-width-down/480?cb=20150925223113`, tint: "#5a4a6a", faction: "SOUND" },
  { id: "kabuto", name: "Kabuto", image: `${WIKI}/c/c9/Kabuto_Part_1.png/revision/latest/scale-to-width-down/480?cb=20170906101523`, tint: "#5a4a7a", faction: "SOUND" },

  { id: "deidara", name: "Deidara", image: `${WIKI}/f/f5/NUNSRDeidara.png/revision/latest/scale-to-width-down/240?cb=20160623115341`, tint: "#b09a4a", faction: "AKATSUKI" },
  { id: "sasori", name: "Sasori", image: `${WIKI}/1/12/Sasori_UNSR.png/revision/latest/scale-to-width-down/240?cb=20160426003634`, tint: "#a8442e", faction: "AKATSUKI" },
  { id: "hidan", name: "Hidan", image: `${WIKI}/f/ff/NSUNRHidan.png/revision/latest/scale-to-width-down/324?cb=20160623115835`, tint: "#8a5a3a", faction: "AKATSUKI" },
  { id: "kakuzu", name: "Kakuzu", image: `${WIKI}/1/1a/Kakuzu_UNSR.png/revision/latest?cb=20170529102009`, tint: "#3a5a4a", faction: "AKATSUKI" },
  { id: "kisame", name: "Kisame", image: `${WIKI}/f/f7/Kisame_Hoshigaki_full.png/revision/latest/scale-to-width-down/280?cb=20160304061903`, tint: "#3a6a8a", faction: "AKATSUKI" },
  { id: "nagato", name: "Nagato", image: `${WIKI}/0/06/Nagato_Early_Akatsuki.png/revision/latest?cb=20210226002003`, tint: "#8a3a3a", faction: "AKATSUKI" },
  { id: "konan", name: "Konan", image: `${WIKI}/3/36/Young_Konan_OL.png/revision/latest?cb=20210414203307`, tint: "#4a5a9a", faction: "AKATSUKI" },
  { id: "obito", name: "Obito", image: `${WIKI}/4/4a/Obito_Uchiha.png/revision/latest/scale-to-width-down/480?cb=20220223045744`, tint: "#6a3a2a", faction: "AKATSUKI" },
  { id: "madara", name: "Madara", image: `${WIKI}/f/fd/Madara.png/revision/latest/scale-to-width-down/480?cb=20160115141947`, tint: "#6a2a3a", faction: "AKATSUKI" },

  { id: "kaguya", name: "Kaguya", image: `${WIKI}/6/6c/Kaguya_%C5%8Ctsutsuki.png/revision/latest/scale-to-width-down/480?cb=20180824113908`, tint: "#7a8aa8", faction: "OTSUTSUKI" },
];

export const FACTIONS: { id: Faction | "ALL"; label: string }[] = [
  { id: "ALL", label: "ALL" },
  { id: "LEAF", label: "LEAF" },
  { id: "SAND", label: "SAND" },
  { id: "MIST", label: "MIST" },
  { id: "CLOUD", label: "CLOUD" },
  { id: "SOUND", label: "SOUND" },
  { id: "AKATSUKI", label: "AKATSUKI" },
  { id: "OTSUTSUKI", label: "OTSUTSUKI" },
];

export const ROSTER_SIZE = CHARACTERS.length;
