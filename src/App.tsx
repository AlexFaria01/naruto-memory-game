import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { audio } from "./audio";
import { CharacterArt, preloadRoster } from "./components/CharacterArt";
import { CHARACTERS, FACTIONS, ROSTER_SIZE, type Character, type Faction } from "./game/roster";

type Phase = "start" | "playing" | "paused" | "won" | "lost";
type Mode = "timed" | "cpu" | "local";
type DifficultyId = "genin" | "chunin" | "jonin" | "hokage" | "anbu" | "sannin" | "sixpaths";
type Modal = "help" | "leaderboard" | "collection" | "settings" | "badges" | null;
type Source = "human" | "cpu";
type Tone = "p1" | "p2";

type Card = { key: string; character: Character };
type PlayerStat = { pairs: number; score: number; combo: number; best: number };
type Difficulty = {
  id: DifficultyId; name: string; rank: string; pairs: number;
  cols: number; aspect: number; mCols: number; mAspect: number;
  time: number; mult: number; cpuSkill: number; previewMs: number;
  shuffleEvery: number | null; blurb: string; note: string;
};
type ModeInfo = { id: Mode; name: string; tag: string; blurb: string; headline: string; subhead: string };
type ScoreEntry = { id: string; name: string; score: number; date: number; won: boolean; tag: string };
type Particle = { id: number; x: number; y: number; dx: number; dy: number; size: number; delay: number; color: string };
type FloatingText = { id: number; x: number; y: number; text: string; miss: boolean; tone: Tone };
type Banner = { id: number; label: string; tone: Tone };
type ShinobiStats = {
  games: number; wins: number; bestScore: number; bestStreak: number;
  totalPairs: number; perfects: number; discoveries: string[];
};
type AchievementId = "first-pair" | "sage" | "streak5" | "flawless" | "lightning" | "hokage" | "kage-slayer" | "centurion" | "sixpaths";
type Achievement = { id: AchievementId; mark: string; name: string; hint: string };
type MissionGrade = { letter: string; label: string; accuracy: number; quality: number };

/** Faces shown as floating chips on the start screen. */
const HERO_ROSTER = ["naruto", "madara", "sasuke", "minato", "sakura", "itachi", "kushina"];

const DIFFICULTIES: Difficulty[] = [
  { id: "genin", name: "GENIN", rank: "01", pairs: 6, cols: 4, aspect: 1.05, mCols: 4, mAspect: 1.05, time: 60, mult: 1, cpuSkill: 0.34, previewMs: 2600, shuffleEvery: null, blurb: "12 CARDS", note: "A warm-up. Six pairs, one minute on the clock." },
  { id: "chunin", name: "CHUNIN", rank: "02", pairs: 8, cols: 4, aspect: 0.84, mCols: 4, mAspect: 0.84, time: 90, mult: 1.25, cpuSkill: 0.52, previewMs: 2600, shuffleEvery: null, blurb: "16 CARDS", note: "Sixteen cards, richer payouts, less room to guess." },
  { id: "jonin", name: "JONIN", rank: "03", pairs: 9, cols: 6, aspect: 0.83, mCols: 4, mAspect: 1.1, time: 115, mult: 1.6, cpuSkill: 0.68, previewMs: 2400, shuffleEvery: null, blurb: "18 CARDS", note: "A wide board of eighteen. Real focus required." },
  { id: "hokage", name: "HOKAGE", rank: "04", pairs: 9, cols: 6, aspect: 0.83, mCols: 4, mAspect: 1.1, time: 100, mult: 2, cpuSkill: 0.86, previewMs: 2400, shuffleEvery: 3, blurb: "18 + SHUFFLE", note: "Every third match the leftover cards change places." },
  { id: "anbu", name: "ANBU", rank: "05", pairs: 12, cols: 6, aspect: 0.9, mCols: 6, mAspect: 1.05, time: 145, mult: 2.4, cpuSkill: 0.74, previewMs: 2900, shuffleEvery: 4, blurb: "24 CARDS", note: "Twenty-four cards, plus a shuffle every fourth match." },
  { id: "sannin", name: "SANNIN", rank: "06", pairs: 15, cols: 6, aspect: 0.8, mCols: 6, mAspect: 1.1, time: 175, mult: 3, cpuSkill: 0.82, previewMs: 3400, shuffleEvery: 4, blurb: "30 CARDS", note: "Thirty cards, five rows deep. Memorise in zones." },
  { id: "sixpaths", name: "SIX PATHS", rank: "07", pairs: 18, cols: 9, aspect: 0.72, mCols: 6, mAspect: 1.15, time: 210, mult: 3.6, cpuSkill: 0.9, previewMs: 4000, shuffleEvery: 3, blurb: "36 CARDS", note: "The full trial. Thirty-six cards, reshuffled every third match." },
];

const MODES: ModeInfo[] = [
  { id: "timed", name: "TIME TRIAL", tag: "SOLO", blurb: "Clear the whole board before the clock burns out.", headline: "Trust your", subhead: "instincts." },
  { id: "cpu", name: "VS KAGE AI", tag: "DUEL", blurb: "Trade turns with a machine that remembers every card it sees.", headline: "Out-think", subhead: "the machine." },
  { id: "local", name: "VS FRIEND", tag: "HOTSEAT", blurb: "Two shinobi, one board, one device. No mercy.", headline: "Two shinobi.", subhead: "one scroll." },
];

const CPU_NAME = "KAGE AI";
const STORAGE_KEY = "naruto-memory-scores-v2";
const STATS_KEY = "naruto-memory-stats-v1";
const BADGES_KEY = "naruto-memory-badges-v1";
const SAGE_NEED = 4;
const SAGE_DURATION = 12;
const PEEK_MS = 1500;

const TITLES = [
  { wins: 0, title: "ACADEMY STUDENT" },
  { wins: 1, title: "GENIN" },
  { wins: 3, title: "CHUNIN" },
  { wins: 7, title: "JONIN" },
  { wins: 12, title: "HOKAGE" },
];

const ACHIEVEMENTS: Achievement[] = [
  { id: "first-pair", mark: "01", name: "FIRST BLOOD", hint: "Find your first pair." },
  { id: "sage", mark: "SAGE", name: "SAGE AWAKENING", hint: "Trigger Sage Mode." },
  { id: "streak5", mark: "5X", name: "UNBROKEN", hint: "Reach a 5x match streak." },
  { id: "flawless", mark: "0X", name: "PERFECT MEMORY", hint: "Clear a timed board without a miss." },
  { id: "lightning", mark: "25S", name: "LIGHTNING BLADE", hint: "Win with 25 seconds or more." },
  { id: "hokage", mark: "K", name: "WILL OF FIRE", hint: "Clear a Hokage-rank board." },
  { id: "kage-slayer", mark: "AI", name: "MACHINE BREAKER", hint: "Defeat the Kage AI." },
  { id: "centurion", mark: "100", name: "HUNDRED BONDS", hint: "Clear 100 pairs in total." },
  { id: "sixpaths", mark: "36", name: "SIX PATHS MIND", hint: "Clear a board of thirty-six cards." },
];

const emptyPlayer = (): PlayerStat => ({ pairs: 0, score: 0, combo: 0, best: 0 });
const emptyStats = (): ShinobiStats => ({ games: 0, wins: 0, bestScore: 0, bestStreak: 0, totalPairs: 0, perfects: 0, discoveries: [] });

function shuffleInPlace<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function createDeck(pairs: number): Card[] {
  const chosen = shuffleInPlace([...CHARACTERS]).slice(0, Math.min(pairs, CHARACTERS.length));
  return shuffleInPlace(
    chosen.flatMap((character) => [
      { key: `${character.id}-a`, character },
      { key: `${character.id}-b`, character },
    ]),
  );
}

function findDifficulty(id: DifficultyId): Difficulty {
  return DIFFICULTIES.find((entry) => entry.id === id) ?? DIFFICULTIES[0];
}

function boardRows(d: Difficulty, cols = d.cols) {
  return (d.pairs * 2) / cols;
}

/** Board width as a multiple of the available height, so every rank fits the viewport. */
function boardRatio(d: Difficulty, cols = d.cols, aspect = d.aspect) {
  return (cols * aspect) / boardRows(d, cols);
}

function cardDensity(d: Difficulty) {
  if (d.cols >= 9) return "ultra";
  if (d.cols >= 6) return boardRows(d) >= 4 ? "compact" : "wide";
  return "roomy";
}

/** Bigger boards reward more looking time and more jutsu charges. */
function peekStartFor(mode: Mode, pairs: number) {
  const base = pairs <= 8 ? 2 : pairs <= 12 ? 3 : pairs <= 15 ? 4 : 5;
  return mode === "timed" ? base : Math.max(1, base - 1);
}

function rasenganStartFor(pairs: number) {
  return pairs >= 15 ? 2 : 1;
}

function readScores(): ScoreEntry[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(
        (entry): entry is ScoreEntry =>
          typeof entry?.id === "string" &&
          typeof entry?.name === "string" &&
          typeof entry?.score === "number" &&
          Number.isFinite(entry.score) &&
          typeof entry?.date === "number" &&
          typeof entry?.won === "boolean" &&
          typeof entry?.tag === "string",
      )
      .sort((a, b) => b.score - a.score || a.date - b.date)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function storeScores(scores: ScoreEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch { /* private mode */ }
}

function readStats(): ShinobiStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<ShinobiStats>;
    return {
      games: typeof parsed.games === "number" ? parsed.games : 0,
      wins: typeof parsed.wins === "number" ? parsed.wins : 0,
      bestScore: typeof parsed.bestScore === "number" ? parsed.bestScore : 0,
      bestStreak: typeof parsed.bestStreak === "number" ? parsed.bestStreak : 0,
      totalPairs: typeof parsed.totalPairs === "number" ? parsed.totalPairs : 0,
      perfects: typeof parsed.perfects === "number" ? parsed.perfects : 0,
      discoveries: Array.isArray(parsed.discoveries) ? parsed.discoveries.filter((d): d is string => typeof d === "string") : [],
    };
  } catch {
    return emptyStats();
  }
}

function storeStats(stats: ShinobiStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* private mode */ }
}

function readAchievements(): AchievementId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(BADGES_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((id): id is AchievementId => ACHIEVEMENTS.some((achievement) => achievement.id === id))
      : [];
  } catch {
    return [];
  }
}

function storeAchievements(ids: AchievementId[]) {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify(ids));
  } catch { /* private mode */ }
}

function titleForWins(wins: number): { title: string; nextAt: number | null } {
  let title = TITLES[0].title;
  let nextAt: number | null = null;
  for (let i = 0; i < TITLES.length; i += 1) {
    if (wins >= TITLES[i].wins) title = TITLES[i].title;
    else {
      nextAt = TITLES[i].wins;
      break;
    }
  }
  return { title, nextAt };
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatScore(score: number) {
  return String(Math.max(0, Math.round(score))).padStart(5, "0");
}

/* ---------------------------------------------------------------- icons */
function LeafIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M51.8 16.8c-5 2.4-9.4 2.2-13.4.1C28 11.5 16 17 12.7 27.1c-2.7 8.4 2.9 16.9 11.1 18.4 7.9 1.5 15.7-3.3 15.7-10.4 0-5.5-5.6-8.4-10-6.1-3 1.6-3.7 5.6-1.3 7.7" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.3 29.6C9.1 42.9 19.8 52.2 32.2 51.1c10.1-.9 17.4-7 21.2-15.4M48.6 40.6l10.1 3.6-7.6 7.7" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h10v5c0 4-2 6.5-5 6.5S7 12 7 8V3ZM7 5H4v2c0 2.5 1.3 4 3.6 4.5M17 5h3v2c0 2.5-1.3 4-3.6 4.5M12 14.5V19m-4 2h8m-6-2h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 2.8 2.3 1.5 2.8-.1 1 2.6 2.3 1.7-.8 2.7.8 2.7-2.3 1.7-1 2.6-2.8-.1L12 19.6l-2.3 1.5-2.8-.1-1-2.6-2.3-1.7.8-2.7-.8-2.7 2.3-1.7 1-2.6 2.8.1L12 2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m8.6 12.1 2.1 2.1 4.8-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9v4l3 2m-2-11h-2m6 0-1.4 2.2M8 4l1.4 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CpuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="9.6" y="9.6" width="4.8" height="4.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.6v3.2m4-3.2v3.2M10 18.2v3.2m4-3.2v3.2M2.6 10h3.2m-3.2 4h3.2m12.6-4h3.2m-3.2 4h3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function DuelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="7.6" cy="7.4" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.4" cy="7.4" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M2.6 20c.6-3.4 2.5-5.2 5-5.2s4.4 1.8 5 5.2m-.4-6.6c.7-2.6 2.4-4 4.4-4 2.1 0 3.8 1.5 4.4 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function ModeIcon({ mode }: { mode: Mode }) {
  if (mode === "timed") return <ClockIcon />;
  if (mode === "cpu") return <CpuIcon />;
  return <DuelIcon />;
}
function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      {muted ? (
        <path d="m17 9 4 6m0-6-4 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <path d="M17 8a6 6 0 0 1 0 8m2.5-11a10 10 0 0 1 0 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}
function PauseIcon({ paused = false }: { paused?: boolean }) {
  return paused ? (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m8 5 11 7-11 7V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 5v14m8-14v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 8a8 8 0 1 0 1 5M20 3v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4.5 12.5 5 5 10-11" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.6c.9 5.3 3.5 7.9 8.8 8.8-5.3.9-7.9 3.5-8.8 8.8-.9-5.3-3.5-7.9-8.8-8.8 5.3-.9 7.9-3.5 8.8-8.8Z" fill="currentColor" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <path d="m19.6 14-.9-.6a6.9 6.9 0 0 0 0-2.8l.9-.6-1.9-3.3-1 .4a6.9 6.9 0 0 0-2.4-1.4L13.1 4h-3.8l-.2 1.1a6.9 6.9 0 0 0-2.4 1.4l-1-.4-1.9 3.3.9.6a6.9 6.9 0 0 0 0 2.8l-.9.6 1.9 3.3 1-.4a6.9 6.9 0 0 0 2.4 1.4l.2 1.1h3.8l.2-1.1a6.9 6.9 0 0 0 2.4-1.4l1 .4 1.9-3.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}
function SpiralIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5c4.8 0 8.5 3.6 8.5 8.2 0 5-4 8.8-8.8 8.8-3.9 0-7.2-2.8-7.2-6.4 0-3 2.3-5.3 5.2-5.3 2.4 0 4.3 1.8 4.3 4 0 1.8-1.4 3.1-3.1 3.1-1.3 0-2.3-1-2.3-2.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}
function SageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5c.8 4.2 3.6 6.3 6.4 8.2 2 1.4 3.1 3.2 3.1 5.3a9.5 9.5 0 0 1-19 0c0-3.4 2.4-5.7 4.6-7.6.4 1.7 1.3 3 2.8 3.8C9.5 9.4 10.4 6 12 2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V5.5 18Zm0 0a2.8 2.8 0 1 0-.1 0Zm0 0h.1m10-2.5V4L9 5.5M19 15.5a2.8 2.8 0 1 0-.1 0Zm0 0h.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EqBars({ on }: { on: boolean }) {
  return (
    <span className={`eq ${on ? "is-live" : ""}`} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

/* ------------------------------------------------------- leaf storm */
function LeafStorm({ show, variant = "win", count = 34 }: { show: boolean; variant?: "win" | "sage"; count?: number }) {
  const leaves = useMemo(() => {
    let seed = variant === "win" ? 7 : 99;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rand() * 100,
      delay: rand() * 5,
      dur: 3.4 + rand() * 4.2,
      size: 8 + rand() * 10,
      drift: (rand() - 0.5) * 220,
      spin: 260 + rand() * 720,
      warm: rand() > 0.42,
    }));
  }, [count, variant]);
  if (!show) return null;
  return (
    <div className={`leaf-storm ${variant}`} aria-hidden="true">
      {leaves.map((leaf) => (
        <span
          key={leaf.id}
          className={`storm-leaf ${leaf.warm ? "warm" : "cool"}`}
          style={{
            left: `${leaf.left}%`,
            width: leaf.size,
            height: leaf.size,
            animationDelay: `${leaf.delay}s`,
            animationDuration: `${leaf.dur}s`,
            "--drift": `${leaf.drift}px`,
            "--spin": `${leaf.spin}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

const PARTICLE_COLORS: Record<Tone, string[]> = {
  p1: ["#fff1c3", "#ffb44f", "#f36c3d"],
  p2: ["#dffaf3", "#7fd6c6", "#3d9c93"],
};
const SAGE_COLORS = ["#fff7d6", "#ffe27a", "#8fe2d3", "#f6ac4b"];

/* ================================================================ app */
export default function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [modal, setModal] = useState<Modal>(null);
  const [mode, setMode] = useState<Mode>("timed");
  const [difficultyId, setDifficultyId] = useState<DifficultyId>("genin");
  const [cards, setCards] = useState<Card[]>(() => createDeck(DIFFICULTIES[0].pairs));
  const [openIndices, setOpenIndices] = useState<number[]>([]);
  const [matchedIdx, setMatchedIdx] = useState<number[]>([]);
  const [players, setPlayers] = useState<PlayerStat[]>([emptyPlayer()]);
  const [turn, setTurn] = useState(0);
  const [cpuStep, setCpuStep] = useState(0);
  const [cpuThinking, setCpuThinking] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [scorePulse, setScorePulse] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DIFFICULTIES[0].time);
  const [timeBonus, setTimeBonus] = useState(0);
  const [perfectBonus, setPerfectBonus] = useState(0);
  const [grade, setGrade] = useState<MissionGrade | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingText, setFloatingText] = useState<FloatingText | null>(null);
  // audio + settings
  const [musicOn, setMusicOn] = useState(audio.musicOn);
  const [sfxOn, setSfxOn] = useState(audio.sfxOn);
  const [musicVol, setMusicVol] = useState(audio.musicVol);
  const [sfxVol, setSfxVol] = useState(audio.sfxVol);
  const [hapticsOn, setHapticsOn] = useState(() => {
    try {
      return (localStorage.getItem("nmq-haptics") ?? "1") === "1";
    } catch {
      return true;
    }
  });
  const [shakeOn, setShakeOn] = useState(() => {
    try {
      return (localStorage.getItem("nmq-shake") ?? "1") === "1";
    } catch {
      return true;
    }
  });
  // jutsu + sage + preview
  const [peeks, setPeeks] = useState<number[]>([2]);
  const [rasengans, setRasengans] = useState<number[]>([1]);
  const [peeking, setPeeking] = useState(false);
  const [sageCharge, setSageCharge] = useState<number[]>([0]);
  const [sageLeft, setSageLeft] = useState<number[]>([0]);
  const [previewing, setPreviewing] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);
  // records
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>(readScores);
  const [stats, setStats] = useState<ShinobiStats>(readStats);
  const [achievements, setAchievements] = useState<AchievementId[]>(readAchievements);
  const [badgeToast, setBadgeToast] = useState<{ id: number; badge: Achievement } | null>(null);
  const [resultEntryId, setResultEntryId] = useState<string | null>(null);
  const [resultName, setResultName] = useState("SHINOBI");
  const [nameSaved, setNameSaved] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [titleUp, setTitleUp] = useState<string | null>(null);
  const [p1Name, setP1Name] = useState("SHINOBI");
  const [p2Name, setP2Name] = useState("PLAYER TWO");
  const [scrollFilter, setScrollFilter] = useState<Faction | "ALL">("ALL");

  const phaseRef = useRef<Phase>("start");
  const modeRef = useRef<Mode>("timed");
  const diffRef = useRef<Difficulty>(DIFFICULTIES[0]);
  const deckRef = useRef<Card[]>(cards);
  const openRef = useRef<number[]>([]);
  const matchedRef = useRef<Set<number>>(new Set());
  const memoryRef = useRef<Map<string, string>>(new Map());
  const busyRef = useRef(false);
  const turnRef = useRef(0);
  const playersRef = useRef<PlayerStat[]>([emptyPlayer()]);
  const matchesRef = useRef(0);
  const missesRef = useRef(0);
  const timeLeftRef = useRef(DIFFICULTIES[0].time);
  const hapticsRef = useRef(true);
  const shakeRef = useRef(shakeOn);
  const keyboardModeRef = useRef(false);
  const leaderboardRef = useRef(leaderboard);
  const statsRef = useRef(stats);
  const achievementsRef = useRef<AchievementId[]>(achievements);
  const peeksRef = useRef<number[]>([2]);
  const rasRef = useRef<number[]>([1]);
  const sageChargeRef = useRef<number[]>([0]);
  const sageLeftRef = useRef<number[]>([0]);
  const previewRef = useRef(false);
  const peekRef = useRef(false);
  const narrowRef = useRef(typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  const timeoutsRef = useRef<number[]>([]);
  const effectIdRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const difficulty = findDifficulty(difficultyId);
  const activeDifficulty = phase === "start" ? difficulty : findDifficulty(diffRef.current.id);
  const versus = mode !== "timed";
  const playerNames: [string, string] = [
    p1Name.trim().toUpperCase() || "SHINOBI",
    mode === "cpu" ? CPU_NAME : p2Name.trim().toUpperCase() || "PLAYER TWO",
  ];
  const me = players[0] ?? emptyPlayer();
  const boardLocked =
    phase !== "playing" || previewing || peeking || openIndices.length === 2 || (mode === "cpu" && turn === 1);
  const sageActive = (sageLeft[turn] ?? 0) > 0;
  const myPeeks = peeks[turn] ?? 0;
  const myRas = rasengans[turn] ?? 0;
  const powersLocked = phase !== "playing" || previewing || peeking || busyRef.current || (mode === "cpu" && turn === 1);
  const { title: shinobiTitle, nextAt } = titleForWins(stats.wins);
  const winsToNext = nextAt === null ? null : nextAt - stats.wins;

  /* ---------------------------------------------------------- helpers */
  const queueTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = window.setTimeout(callback, delay);
    timeoutsRef.current.push(timeout);
    return timeout;
  }, []);

  const clearQueuedTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(window.clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      if (hapticsRef.current && "vibrate" in navigator) navigator.vibrate(pattern);
    } catch { /* noop */ }
  }, []);

  const flashNotice = useCallback(
    (text: string) => {
      const id = ++effectIdRef.current;
      setNotice({ id, text });
      queueTimeout(() => setNotice((current) => (current?.id === id ? null : current)), 1300);
    },
    [queueTimeout],
  );

  const spawnEffects = useCallback(
    (indices: number[], text: string, tone: Tone = "p1", miss = false, sage = false) => {
      const board = boardRef.current?.getBoundingClientRect();
      if (!board) return;
      const centers = indices
        .map((index) => cardRefs.current[index]?.getBoundingClientRect())
        .filter((rect): rect is DOMRect => Boolean(rect))
        .map((rect) => ({ x: rect.left + rect.width / 2 - board.left, y: rect.top + rect.height / 2 - board.top }));
      if (!centers.length) return;
      const floatingId = ++effectIdRef.current;
      setFloatingText({
        id: floatingId,
        x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
        y: centers.reduce((sum, c) => sum + c.y, 0) / centers.length,
        text,
        miss,
        tone,
      });
      queueTimeout(() => setFloatingText((current) => (current?.id === floatingId ? null : current)), 950);
      if (miss) return;
      const palette = sage ? SAGE_COLORS : PARTICLE_COLORS[tone];
      const per = sage ? 20 : 13;
      const burst = centers.flatMap((center) =>
        Array.from({ length: per }, (_, index) => {
          const angle = (Math.PI * 2 * index) / per + Math.random() * 0.38;
          const distance = (sage ? 70 : 48) + Math.random() * (sage ? 120 : 88);
          return {
            id: ++effectIdRef.current,
            x: center.x,
            y: center.y,
            dx: Math.cos(angle) * distance,
            dy: Math.sin(angle) * distance - 17,
            size: 3 + Math.random() * (sage ? 6 : 5),
            delay: Math.random() * 95,
            color: palette[index % palette.length],
          };
        }),
      );
      setParticles((current) => [...current, ...burst].slice(-220));
      const burstIds = new Set(burst.map((p) => p.id));
      queueTimeout(() => setParticles((current) => current.filter((p) => !burstIds.has(p.id))), 950);
    },
    [queueTimeout],
  );

  const spawnCelebration = useCallback(() => {
    const board = boardRef.current?.getBoundingClientRect();
    if (!board) return;
    const cx = board.width / 2;
    const cy = board.height / 2;
    const burst = Array.from({ length: 70 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 70 + Math.random() * 0.3;
      const distance = 90 + Math.random() * Math.max(board.width, 260) * 0.5;
      return {
        id: ++effectIdRef.current,
        x: cx,
        y: cy,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 40,
        size: 3 + Math.random() * 6,
        delay: Math.random() * 260,
        color: SAGE_COLORS[index % SAGE_COLORS.length],
      };
    });
    setParticles((current) => [...current, ...burst].slice(-260));
    const ids = new Set(burst.map((p) => p.id));
    queueTimeout(() => setParticles((current) => current.filter((p) => !ids.has(p.id))), 1400);
  }, [queueTimeout]);

  const showTurnBanner = useCallback(
    (nextTurn: number) => {
      const currentMode = modeRef.current;
      if (currentMode === "timed") return;
      const id = ++effectIdRef.current;
      const label =
        currentMode === "cpu"
          ? nextTurn === 1
            ? "KAGE AI TAKES THE BOARD"
            : "YOUR TURN"
          : `${nextTurn === 0 ? p1Name.trim().toUpperCase() || "PLAYER ONE" : p2Name.trim().toUpperCase() || "PLAYER TWO"} — YOUR TURN`;
      setBanner({ id, label, tone: nextTurn === 0 ? "p1" : "p2" });
      queueTimeout(() => setBanner((current) => (current?.id === id ? null : current)), 1150);
      audio.play("turn");
    },
    [p1Name, p2Name, queueTimeout],
  );

  const unlockAchievement = useCallback(
    (id: AchievementId) => {
      if (achievementsRef.current.includes(id)) return;
      const badge = ACHIEVEMENTS.find((entry) => entry.id === id);
      if (!badge) return;
      const next = [...achievementsRef.current, id];
      achievementsRef.current = next;
      setAchievements(next);
      storeAchievements(next);
      const toastId = ++effectIdRef.current;
      setBadgeToast({ id: toastId, badge });
      audio.play("unlock");
      vibrate([18, 35, 18]);
      queueTimeout(() => setBadgeToast((current) => (current?.id === toastId ? null : current)), 3200);
    },
    [queueTimeout, vibrate],
  );

  /* ---------------------------------------------------------- game flow */
  const finishGame = useCallback(
    (outcome: "won" | "lost") => {
      if (phaseRef.current !== "playing" && phaseRef.current !== "paused") return;
      phaseRef.current = outcome;
      setPhase(outcome);
      setCpuThinking(false);
      setBanner(null);
      setPreviewing(false);
      previewRef.current = false;
      setPeeking(false);
      peekRef.current = false;

      const diff = diffRef.current;
      const currentMode = modeRef.current;
      const list = playersRef.current;
      let finalPlayers = list;
      let bonus = 0;
      let perfect = 0;

      if (currentMode === "timed" && outcome === "won") {
        bonus = Math.round(timeLeftRef.current * 10 * diff.mult);
        if (missesRef.current === 0) {
          perfect = Math.round(500 * diff.mult);
          audio.play("perfect");
        }
        finalPlayers = [{ ...list[0], score: list[0].score + bonus + perfect }];
        playersRef.current = finalPlayers;
        setPlayers(finalPlayers);
        if (bonus > 0) flashNotice(`TIME BONUS +${bonus}`);
      }
      setTimeBonus(bonus);
      setPerfectBonus(perfect);
      setScorePulse((value) => value + 1);

      let champ: number | null = null;
      if (currentMode !== "timed") {
        const [one, two] = finalPlayers;
        if (one.pairs !== two.pairs) champ = one.pairs > two.pairs ? 0 : 1;
        else if (one.score !== two.score) champ = one.score > two.score ? 0 : 1;
      }
      setWinner(champ);

      const lostToCpu = currentMode === "cpu" && champ === 1;
      const humanWon = currentMode === "timed" ? outcome === "won" : currentMode === "cpu" ? champ === 0 : champ !== null;
      const totalAttempts = matchesRef.current + missesRef.current;
      const accuracyRate = totalAttempts > 0 ? matchesRef.current / totalAttempts : 1;
      const completionRate = matchedRef.current.size / (diff.pairs * 2);
      const speedRate = currentMode === "timed"
        ? Math.max(0, timeLeftRef.current / diff.time)
        : currentMode === "local"
          ? champ === null ? 0.7 : 1
          : champ === 0 ? 1 : 0.45;
      const quality = Math.max(0, Math.min(1, accuracyRate * 0.55 + completionRate * 0.35 + speedRate * 0.1));
      const letter = quality >= 0.96 ? "S" : quality >= 0.86 ? "A" : quality >= 0.74 ? "B" : quality >= 0.58 ? "C" : "D";
      const label = letter === "S" ? "LEGENDARY" : letter === "A" ? "ELITE" : letter === "B" ? "SOLID" : letter === "C" ? "STANDARD" : "ROUGH";
      setGrade({ letter, label, accuracy: Math.round(accuracyRate * 100), quality: Math.round(quality * 100) });
      audio.play(currentMode === "timed" ? (outcome === "won" ? "win" : "lose") : lostToCpu ? "lose" : "win");
      if (currentMode === "timed" && outcome === "won" && missesRef.current === 0) unlockAchievement("flawless");
      if (currentMode === "timed" && outcome === "won" && timeLeftRef.current >= 25) unlockAchievement("lightning");
      if (outcome === "won" && diff.id === "hokage") unlockAchievement("hokage");
      if (currentMode === "cpu" && champ === 0) unlockAchievement("kage-slayer");
      if (outcome === "won" && diff.pairs >= 18) unlockAchievement("sixpaths");
      if (humanWon) {
        vibrate([60, 60, 120]);
        spawnCelebration();
      } else {
        vibrate([80, 60, 80]);
      }

      const champName =
        currentMode === "timed"
          ? p1Name.trim().toUpperCase() || "SHINOBI"
          : champ === null
            ? "DRAW"
            : champ === 0
              ? p1Name.trim().toUpperCase() || "SHINOBI"
              : currentMode === "cpu"
                ? CPU_NAME
                : p2Name.trim().toUpperCase() || "PLAYER TWO";

      const entryScore =
        currentMode === "timed"
          ? finalPlayers[0].score
          : champ === null
            ? Math.max(finalPlayers[0].score, finalPlayers[1].score)
            : finalPlayers[champ].score;

      const modeTag = MODES.find((entry) => entry.id === currentMode)?.tag ?? "SOLO";
      const prevTop = leaderboardRef.current[0]?.score ?? 0;
      setIsNewBest(entryScore > 0 && (leaderboardRef.current.length === 0 || entryScore > prevTop));

      if (entryScore > 0) {
        const entry: ScoreEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: champName,
          score: entryScore,
          date: Date.now(),
          won: outcome === "won" && !lostToCpu,
          tag: `${modeTag} · ${diff.name}`,
        };
        const updated = [...leaderboardRef.current, entry]
          .sort((a, b) => b.score - a.score || a.date - b.date)
          .slice(0, 6);
        leaderboardRef.current = updated;
        setLeaderboard(updated);
        storeScores(updated);
        setResultEntryId(updated.some((item) => item.id === entry.id) ? entry.id : null);
        setResultName(entry.name);
      } else {
        setResultEntryId(null);
        setResultName(champName);
      }
      setNameSaved(false);

      // Persistent shinobi record
      const before = statsRef.current;
      const prevTitle = titleForWins(before.wins).title;
      const foundNow = Array.from(matchedRef.current).map((index) => deckRef.current[index]?.character.id).filter(Boolean) as string[];
      const discoveries = Array.from(new Set([...before.discoveries, ...foundNow]));
      const bestStreak = Math.max(before.bestStreak, ...finalPlayers.map((p) => p.best));
      const next: ShinobiStats = {
        games: before.games + 1,
        wins: before.wins + (humanWon ? 1 : 0),
        bestScore: Math.max(before.bestScore, currentMode === "timed" ? finalPlayers[0].score : Math.max(finalPlayers[0].score, finalPlayers[1]?.score ?? 0)),
        bestStreak,
        totalPairs: before.totalPairs + matchedRef.current.size / 2,
        perfects: before.perfects + (perfect > 0 ? 1 : 0),
        discoveries,
      };
      statsRef.current = next;
      setStats(next);
      storeStats(next);
      if (next.totalPairs >= 100) unlockAchievement("centurion");
      const newTitle = titleForWins(next.wins).title;
      setTitleUp(newTitle !== prevTitle ? newTitle : null);
    },
    [flashNotice, p1Name, p2Name, spawnCelebration, unlockAchievement, vibrate],
  );

  const reshuffleBoard = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const deck = deckRef.current;
    const matched = matchedRef.current;
    const slots = deck.map((_, index) => index).filter((index) => !matched.has(index));
    if (slots.length < 4) return;
    const moving = shuffleInPlace(slots.map((slot) => deck[slot]));
    const next = [...deck];
    slots.forEach((slot, position) => {
      next[slot] = moving[position];
    });
    deckRef.current = next;
    setCards(next);
    // Cards changed places, so every recollection of "what sat where" is void — for the AI too.
    memoryRef.current = new Map();
    setShuffling(true);
    flashNotice("DECK RESHUFFLED");
    audio.play("shuffle");
    vibrate(25);
    queueTimeout(() => setShuffling(false), 540);
  }, [flashNotice, queueTimeout, vibrate]);

  const advanceSelection = useCallback(() => {
    const next = deckRef.current.findIndex((_card, index) => !matchedRef.current.has(index));
    if (next === -1) return;
    setSelectedIndex(next);
    if (keyboardModeRef.current) {
      queueTimeout(() => cardRefs.current[next]?.focus({ preventScroll: true }), 70);
    }
  }, [queueTimeout]);

  /** Shared scoring for a found pair (normal flips + Rasengan). */
  const awardMatch = useCallback(
    (playerIndex: number, indices: number[]) => {
      if (phaseRef.current !== "playing") return;
      const diff = diffRef.current;
      const tone: Tone = playerIndex === 1 ? "p2" : "p1";
      // Sage charge
      const charges = [...sageChargeRef.current];
      const lefts = [...sageLeftRef.current];
      while (charges.length <= playerIndex) charges.push(0);
      while (lefts.length <= playerIndex) lefts.push(0);
      charges[playerIndex] = Math.min(SAGE_NEED, (charges[playerIndex] ?? 0) + 1);
      let justAwakened = false;
      if (charges[playerIndex] >= SAGE_NEED && lefts[playerIndex] <= 0) {
        lefts[playerIndex] = SAGE_DURATION;
        justAwakened = true;
      }
      sageChargeRef.current = charges;
      sageLeftRef.current = lefts;
      setSageCharge(charges);
      setSageLeft(lefts);
      const saged = lefts[playerIndex] > 0;

      const list = playersRef.current;
      const current = list[playerIndex] ?? emptyPlayer();
      const nextCombo = current.combo + 1;
      const humanPlayer = modeRef.current !== "cpu" || playerIndex === 0;
      const points = Math.round((100 + (nextCombo - 1) * 50) * diff.mult * (saged ? 2 : 1));
      const updated = list.map((player, index) =>
        index === playerIndex
          ? { pairs: player.pairs + 1, score: player.score + points, combo: nextCombo, best: Math.max(player.best, nextCombo) }
          : player,
      );
      playersRef.current = updated;
      setPlayers(updated);
      setScorePulse((value) => value + 1);

      if (indices.length) {
        const nextMatched = new Set(matchedRef.current);
        indices.forEach((index) => nextMatched.add(index));
        matchedRef.current = nextMatched;
        setMatchedIdx([...nextMatched]);
      }
      openRef.current = [];
      setOpenIndices([]);
      busyRef.current = false;
      matchesRef.current += 1;
      advanceSelection();
      if (humanPlayer) {
        unlockAchievement("first-pair");
        if (nextCombo >= 5) unlockAchievement("streak5");
        if (justAwakened) unlockAchievement("sage");
      }

      let timeRestored = 0;
      if (modeRef.current === "timed" && timeLeftRef.current < diff.time) {
        const before = timeLeftRef.current;
        timeLeftRef.current = Math.min(diff.time, before + 2);
        timeRestored = timeLeftRef.current - before;
        setTimeLeft(timeLeftRef.current);
        if (timeRestored > 0) audio.play("bonus");
      }

      const effectText = `${saged ? `+${points} x2` : `+${points}`}${timeRestored ? ` · +${timeRestored}s` : ""}`;
      spawnEffects(indices, effectText, tone, false, saged);
      audio.play("match");
      vibrate(18);

      if (justAwakened) {
        const who = modeRef.current === "timed" ? "SAGE MODE" : `${playerIndex === 0 ? p1Name.trim().toUpperCase() || "PLAYER ONE" : modeRef.current === "cpu" ? CPU_NAME : p2Name.trim().toUpperCase() || "PLAYER TWO"} · SAGE MODE`;
        flashNotice(`${who} · 2X POINTS`);
        audio.play("sage");
        vibrate([50, 40, 70]);
      }

      if (matchedRef.current.size / 2 >= diff.pairs) {
        queueTimeout(() => finishGame("won"), 900);
        return;
      }
      const cpuPlays = modeRef.current === "cpu" && turnRef.current === 1;
      if (diff.shuffleEvery && matchesRef.current % diff.shuffleEvery === 0) {
        queueTimeout(() => reshuffleBoard(), 420);
        if (cpuPlays) queueTimeout(() => setCpuStep((value) => value + 1), 1250);
        return;
      }
      if (cpuPlays) setCpuStep((value) => value + 1);
    },
    [advanceSelection, finishGame, flashNotice, p1Name, p2Name, queueTimeout, reshuffleBoard, spawnEffects, unlockAchievement, vibrate],
  );

  const resolvePair = useCallback(
    (source: Source) => {
      if (phaseRef.current !== "playing" && phaseRef.current !== "paused") return;
      const deck = deckRef.current;
      const [first, second] = openRef.current;
      const cardA = deck[first];
      const cardB = deck[second];
      const playerIndex = turnRef.current;
      const tone: Tone = playerIndex === 1 ? "p2" : "p1";
      setCpuThinking(false);

      if (!cardA || !cardB) {
        openRef.current = [];
        setOpenIndices([]);
        busyRef.current = false;
        return;
      }

      if (cardA.character.id === cardB.character.id) {
        awardMatch(playerIndex, [first, second]);
        return;
      }

      // Miss: combo + sage charge reset (unless mid-sage), turn passes in duels
      const saged = (sageLeftRef.current[playerIndex] ?? 0) > 0;
      if (!saged) {
        const charges = [...sageChargeRef.current];
        charges[playerIndex] = 0;
        sageChargeRef.current = charges;
        setSageCharge(charges);
      }
      const updated = playersRef.current.map((player, index) => (index === playerIndex ? { ...player, combo: 0 } : player));
      playersRef.current = updated;
      setPlayers(updated);
      missesRef.current += 1;
      if (shakeRef.current) setShaking(true);
      spawnEffects([first, second], "NO MATCH", tone, true);
      audio.play("miss");
      vibrate([30, 40, 30]);
      queueTimeout(() => setShaking(false), 380);
      queueTimeout(() => {
        openRef.current = [];
        setOpenIndices([]);
        busyRef.current = false;
        if (modeRef.current === "timed") return;
        const next = turnRef.current === 0 ? 1 : 0;
        turnRef.current = next;
        setTurn(next);
        showTurnBanner(next);
      }, 640);
      if (source === "cpu" && modeRef.current === "cpu") {
        const skill = diffRef.current.cpuSkill;
        if (Math.random() > skill) {
          // The machine loses its place when it whiffs, keeping lower ranks beatable.
          memoryRef.current.delete(`slot-${first}`);
          memoryRef.current.delete(`slot-${second}`);
        }
      }
    },
    [awardMatch, queueTimeout, showTurnBanner, spawnEffects, vibrate],
  );

  const commitFlip = useCallback(
    (index: number, source: Source) => {
      const deck = deckRef.current;
      const card = deck[index];
      if (phaseRef.current !== "playing" || previewRef.current || peekRef.current || !card) return false;
      if (openRef.current.includes(index) || matchedRef.current.has(index)) return false;
      memoryRef.current.set(`slot-${index}`, card.character.id);
      const nextOpen = [...openRef.current, index];
      openRef.current = nextOpen;
      setOpenIndices(nextOpen);
      audio.play("flip");
      if (nextOpen.length === 2) {
        busyRef.current = true;
        setAttempts((current) => current + 1);
        queueTimeout(() => resolvePair(source), 470);
      }
      return true;
    },
    [queueTimeout, resolvePair],
  );

  const runCpuTurn = useCallback(() => {
    if (phaseRef.current !== "playing" || modeRef.current !== "cpu" || turnRef.current !== 1 || busyRef.current) return;
    if (previewRef.current || peekRef.current) return;
    const deck = deckRef.current;
    const matched = matchedRef.current;
    const memory = memoryRef.current;
    const skill = diffRef.current.cpuSkill;
    const live = deck.map((_, index) => index).filter((index) => !matched.has(index));
    if (live.length < 2) return;
    const pick = (pool: number[]) => pool[Math.floor(Math.random() * pool.length)];
    let first = -1;
    let second = -1;
    let rememberedPair: number[] | null = null;
    for (let a = 0; a < live.length && !rememberedPair; a += 1) {
      for (let b = a + 1; b < live.length; b += 1) {
        const knownA = memory.get(`slot-${live[a]}`);
        const knownB = memory.get(`slot-${live[b]}`);
        if (knownA && knownA === knownB) {
          rememberedPair = [live[a], live[b]];
          break;
        }
      }
    }
    if (rememberedPair && Math.random() < skill) {
      [first, second] = rememberedPair;
    } else {
      const unseen = live.filter((index) => !memory.has(`slot-${index}`));
      first = unseen.length ? pick(unseen) : pick(live);
      const target = deck[first].character.id;
      const rest = live.filter((index) => index !== first);
      const match = rest.filter((index) => memory.get(`slot-${index}`) === target);
      if (match.length && Math.random() < skill) second = pick(match);
      else {
        const blind = rest.filter((index) => !memory.has(deck[index].key));
        second = blind.length ? pick(blind) : pick(rest);
      }
    }
    if (first < 0 || second < 0 || first === second) return;
    busyRef.current = true;
    setCpuThinking(true);
    queueTimeout(() => {
      if (phaseRef.current !== "playing") return;
      const handBack = () => {
        openRef.current = [];
        setOpenIndices([]);
        busyRef.current = false;
        turnRef.current = 0;
        setCpuThinking(false);
        setTurn(0);
      };
      if (!commitFlip(first, "cpu")) {
        handBack();
        return;
      }
      queueTimeout(() => {
        if (phaseRef.current !== "playing") return;
        if (!commitFlip(second, "cpu")) handBack();
      }, 720);
    }, 540);
  }, [commitFlip, queueTimeout]);

  const flipCard = useCallback(
    (index: number) => {
      if (phaseRef.current !== "playing" || busyRef.current || previewRef.current || peekRef.current) return;
      if (modeRef.current === "cpu" && turnRef.current !== 0) return;
      commitFlip(index, "human");
    },
    [commitFlip],
  );

  /* ---------------------------------------------------------- jutsu */
  const usePeek = useCallback(() => {
    const player = turnRef.current;
    if (phaseRef.current !== "playing" || previewRef.current || peekRef.current || busyRef.current) return;
    if (openRef.current.length > 0) return;
    if (modeRef.current === "cpu" && player !== 0) return;
    if ((peeksRef.current[player] ?? 0) <= 0) return;
    const next = [...peeksRef.current];
    next[player] -= 1;
    peeksRef.current = next;
    setPeeks(next);
    peekRef.current = true;
    setPeeking(true);
    flashNotice("SHARINGAN — ALL CARDS REVEALED");
    audio.play("peek");
    vibrate(22);
    queueTimeout(() => {
      peekRef.current = false;
      setPeeking(false);
    }, PEEK_MS);
  }, [flashNotice, queueTimeout, vibrate]);

  const useRasengan = useCallback(() => {
    const player = turnRef.current;
    if (phaseRef.current !== "playing" || previewRef.current || peekRef.current || busyRef.current) return;
    if (openRef.current.length > 0) return;
    if (modeRef.current === "cpu" && player !== 0) return;
    if ((rasRef.current[player] ?? 0) <= 0) return;
    const deck = deckRef.current;
    const matched = matchedRef.current;
    const liveIndices = deck.map((_card, i) => i).filter((i) => !matched.has(i));
    if (liveIndices.length < 2) return;
    // Claim any two cards that share a face.
    const byCharacter = new Map<string, number[]>();
    liveIndices.forEach((i) => {
      const bucket = byCharacter.get(deck[i].character.id) ?? [];
      bucket.push(i);
      byCharacter.set(deck[i].character.id, bucket);
    });
    const ready = Array.from(byCharacter.values()).filter((bucket) => bucket.length >= 2);
    if (!ready.length) return;
    const indices = (ready[Math.floor(Math.random() * ready.length)] ?? []).slice(0, 2);
    if (indices.length < 2) return;
    const next = [...rasRef.current];
    next[player] -= 1;
    rasRef.current = next;
    setRasengans(next);
    flashNotice("RASENGAN STRIKE!");
    audio.play("rasengan");
    vibrate([30, 30, 60]);
    busyRef.current = true;
    openRef.current = indices;
    setOpenIndices(indices);
    // Watch the swirl land, then claim the pair (keeps your turn)
    queueTimeout(() => awardMatch(player, indices), 620);
  }, [awardMatch, flashNotice, queueTimeout, vibrate]);

  /* ---------------------------------------------------------- flow */
  const endPreview = useCallback(() => {
    if (!previewRef.current) return;
    previewRef.current = false;
    setPreviewing(false);
    audio.play("count");
  }, []);

  const skipPreview = useCallback(() => {
    if (!previewRef.current) return;
    clearQueuedTimeouts();
    setParticles([]);
    setFloatingText(null);
    endPreview();
  }, [clearQueuedTimeouts, endPreview]);

  const startGame = useCallback(
    (nextMode: Mode = modeRef.current, nextDifficulty: DifficultyId = diffRef.current.id) => {
      audio.unlock();
      clearQueuedTimeouts();
      const diff = findDifficulty(nextDifficulty);
      const deck = createDeck(diff.pairs);
      deckRef.current = deck;
      // Warm only the faces on this board, so the memorize window is never blank.
      preloadRoster(Array.from(new Map(deck.map((card) => [card.character.id, card.character])).values()));
      openRef.current = [];
      matchedRef.current = new Set();
      memoryRef.current = new Map();
      busyRef.current = false;
      matchesRef.current = 0;
      missesRef.current = 0;
      turnRef.current = 0;
      playersRef.current = nextMode === "timed" ? [emptyPlayer()] : [emptyPlayer(), emptyPlayer()];
      timeLeftRef.current = diff.time;
      modeRef.current = nextMode;
      diffRef.current = diff;
      phaseRef.current = "playing";
      keyboardModeRef.current = false;
      cardRefs.current = [];
      const peekStart = peekStartFor(nextMode, diff.pairs);
      peeksRef.current = nextMode === "timed" ? [peekStart] : [peekStart, peekStart];
      const rasenganStart = rasenganStartFor(diff.pairs);
      rasRef.current = nextMode === "timed" ? [rasenganStart] : [rasenganStart, rasenganStart];
      sageChargeRef.current = nextMode === "timed" ? [0] : [0, 0];
      sageLeftRef.current = nextMode === "timed" ? [0] : [0, 0];
      peekRef.current = false;

      setMode(nextMode);
      setDifficultyId(diff.id);
      setCards(deck);
      setOpenIndices([]);
      setMatchedIdx([]);
      setPlayers(playersRef.current);
      setTurn(0);
      setCpuStep(0);
      setCpuThinking(false);
      setBanner(null);
      setShuffling(false);
      setNotice(null);
      setWinner(null);
      setSelectedIndex(0);
      setKeyboardMode(false);
      setScorePulse(0);
      setAttempts(0);
      setTimeLeft(diff.time);
      setTimeBonus(0);
      setPerfectBonus(0);
      setGrade(null);
      setCopied(false);
      setShaking(false);
      setParticles([]);
      setFloatingText(null);
      setResultEntryId(null);
      setIsNewBest(false);
      setTitleUp(null);
      setNameSaved(false);
      setBadgeToast(null);
      setPeeks(peeksRef.current);
      setRasengans(rasRef.current);
      setSageCharge(sageChargeRef.current);
      setSageLeft(sageLeftRef.current);
      setPeeking(false);
      setModal(null);
      setPhase("playing");
      audio.play("start");
      vibrate(15);

      // Memorize preview: whole board face-up, timer frozen, skippable
      const ms = diff.previewMs;
      previewRef.current = true;
      setPreviewing(true);
      setPreviewTick(0);
      const ticks = Math.max(1, Math.round(ms / 1000) - 1);
      for (let i = 1; i <= ticks; i += 1) {
        queueTimeout(() => {
          setPreviewTick(i);
          audio.play("count");
        }, (ms / (ticks + 1)) * i);
      }
      queueTimeout(() => endPreview(), ms);
    },
    [clearQueuedTimeouts, endPreview, queueTimeout, vibrate],
  );

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    phaseRef.current = "paused";
    setPhase("paused");
    clearQueuedTimeouts();
    openRef.current = [];
    setOpenIndices([]);
    busyRef.current = false;
    previewRef.current = false;
    setPreviewing(false);
    peekRef.current = false;
    setPeeking(false);
    setCpuThinking(false);
    setShaking(false);
    setShuffling(false);
    setBanner(null);
    setNotice(null);
    setParticles([]);
    setFloatingText(null);
  }, [clearQueuedTimeouts]);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    audio.unlock();
    phaseRef.current = "playing";
    setPhase("playing");
    audio.play("click");
    if (matchedRef.current.size / 2 >= diffRef.current.pairs) {
      queueTimeout(() => finishGame("won"), 420);
      return;
    }
    if (modeRef.current === "cpu" && turnRef.current === 1) setCpuStep((value) => value + 1);
  }, [finishGame, queueTimeout]);

  const goToSetup = useCallback(() => {
    clearQueuedTimeouts();
    phaseRef.current = "start";
    busyRef.current = false;
    previewRef.current = false;
    peekRef.current = false;
    setPhase("start");
    setModal(null);
    setBanner(null);
    setCpuThinking(false);
    setNotice(null);
    setShaking(false);
    setPreviewing(false);
    setPeeking(false);
    audio.play("click");
  }, [clearQueuedTimeouts]);

  const openModal = useCallback(
    (nextModal: Exclude<Modal, null>) => {
      audio.unlock();
      audio.play("click");
      if (phaseRef.current === "playing") pauseGame();
      setModal(nextModal);
    },
    [pauseGame],
  );

  /* ---------------------------------------------------------- effects */
  useEffect(() => {
    hapticsRef.current = (() => {
      try {
        return (localStorage.getItem("nmq-haptics") ?? "1") === "1";
      } catch {
        return true;
      }
    })();
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      clearQueuedTimeouts();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [clearQueuedTimeouts]);

  // Dynamic music: calm menu theme, taiko battle groove, urgent finale
  useEffect(() => {
    if (phase !== "playing" || previewing) {
      audio.setMode("menu");
    } else if (mode === "timed" && timeLeft <= 15) {
      audio.setMode("urgent");
    } else {
      audio.setMode("battle");
    }
  }, [mode, phase, previewing, timeLeft]);

  useEffect(() => {
    if (phase !== "playing" || mode !== "timed" || previewing) return;
    const interval = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [mode, phase, previewing]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
    if (phase === "playing" && mode === "timed" && timeLeft === 0) {
      finishGame("lost");
    }
  }, [finishGame, mode, phase, timeLeft]);

  // Low-time heartbeat ticks
  useEffect(() => {
    if (phase === "playing" && mode === "timed" && !previewing && timeLeft <= 10 && timeLeft > 0) {
      audio.play("tick");
      vibrate(10);
    }
  }, [phase, mode, previewing, timeLeft, vibrate]);

  // Sage countdown
  useEffect(() => {
    if (phase !== "playing" || previewing) return;
    if (!sageLeft.some((v) => v > 0)) return;
    const interval = window.setInterval(() => {
      const next = sageLeftRef.current.map((v) => Math.max(0, v - 1));
      sageLeftRef.current = next;
      setSageLeft(next);
      const charges = [...sageChargeRef.current];
      let changed = false;
      next.forEach((v, i) => {
        if (v === 0 && charges[i] >= SAGE_NEED) {
          charges[i] = 0;
          changed = true;
        }
      });
      if (changed) {
        sageChargeRef.current = charges;
        setSageCharge(charges);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase, previewing, sageLeft]);

  useEffect(() => {
    if (phase !== "playing" || mode !== "cpu" || turn !== 1 || busyRef.current || previewing || peeking) return;
    const timeout = window.setTimeout(() => runCpuTurn(), 820);
    return () => window.clearTimeout(timeout);
  }, [cpuStep, mode, phase, peeking, previewing, runCpuTurn, turn]);

  // Phones reflow big boards to fewer columns, so grid stepping must follow the rendered layout.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const onChange = () => { narrowRef.current = mq.matches; };
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) pauseGame();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pauseGame]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement;

      if (modal) {
        if (key === "escape") {
          event.preventDefault();
          setModal(null);
        }
        return;
      }

      if (phase === "start" && key === "enter" && target.closest(".hero-console input")) {
        event.preventDefault();
        startGame(mode, difficultyId);
        return;
      }
      if (target.closest("input, textarea")) return;

      if (phase === "start") {
        if ((key === "enter" || key === " ") && !target.closest("button")) {
          event.preventDefault();
          startGame(mode, difficultyId);
        }
        if (key === "m" && !event.repeat) {
          const next = !musicOn;
          audio.setMusicOn(next);
          setMusicOn(next);
        }
        return;
      }

      if (key === "r" && !event.repeat) {
        event.preventDefault();
        startGame();
        return;
      }
      if (key === "m" && !event.repeat) {
        event.preventDefault();
        const next = !musicOn;
        audio.setMusicOn(next);
        setMusicOn(next);
        return;
      }
      if (key === "escape" || key === "p") {
        event.preventDefault();
        if (phase === "playing") pauseGame();
        else if (phase === "paused") resumeGame();
        return;
      }
      if (phase !== "playing") return;

      if (previewing && (key === "enter" || key === " ")) {
        event.preventDefault();
        skipPreview();
        return;
      }
      if ((key === "1" || key === "2") && !event.repeat) {
        event.preventDefault();
        if (key === "1") usePeek();
        else useRasengan();
        return;
      }
      if (previewing || peeking) return;
      if (modeRef.current === "cpu" && turnRef.current === 1) return;

      const diffNow = diffRef.current;
      const columns = narrowRef.current ? diffNow.mCols : diffNow.cols;
      const directions: Record<string, number> = {
        arrowleft: -1, a: -1, arrowright: 1, d: 1,
        arrowup: -columns, w: -columns, arrowdown: columns, s: columns,
      };
      const deck = deckRef.current;

      if (key in directions) {
        event.preventDefault();
        let next = selectedIndex;
        for (let step = 0; step < deck.length; step += 1) {
          next = (next + directions[key] + deck.length) % deck.length;
          if (!matchedRef.current.has(next)) break;
        }
        if (matchedRef.current.has(next)) {
          next = deck.findIndex((_card, i) => !matchedRef.current.has(i));
        }
        if (next < 0) return;
        setSelectedIndex(next);
        setKeyboardMode(true);
        keyboardModeRef.current = true;
        cardRefs.current[next]?.focus({ preventScroll: true });
        return;
      }

      if ((key === "enter" || key === " ") && !target.closest("button:not(.memory-card)")) {
        event.preventDefault();
        if (event.repeat) return;
        setKeyboardMode(true);
        keyboardModeRef.current = true;
        flipCard(selectedIndex);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [difficultyId, flipCard, mode, modal, musicOn, pauseGame, peeking, phase, previewing, resumeGame, selectedIndex, skipPreview, startGame, usePeek, useRasengan]);

  /* ---------------------------------------------------------- settings */
  const saveName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resultEntryId) return;
    const name = resultName.trim().toUpperCase().slice(0, 12) || "SHINOBI";
    const updated = leaderboardRef.current.map((entry) => (entry.id === resultEntryId ? { ...entry, name } : entry));
    leaderboardRef.current = updated;
    setLeaderboard(updated);
    storeScores(updated);
    setResultName(name);
    setNameSaved(true);
    audio.play("click");
  };

  const toggleMusic = () => {
    audio.unlock();
    const next = !musicOn;
    audio.setMusicOn(next);
    setMusicOn(next);
  };
  const toggleSfx = () => {
    const next = !sfxOn;
    audio.setSfxOn(next);
    setSfxOn(next);
    if (next) audio.play("click");
  };
  const toggleHaptics = () => {
    const next = !hapticsOn;
    hapticsRef.current = next;
    setHapticsOn(next);
    try {
      localStorage.setItem("nmq-haptics", next ? "1" : "0");
    } catch { /* noop */ }
    if (next) vibrate(20);
  };
  const toggleShake = () => {
    const next = !shakeOn;
    shakeRef.current = next;
    setShakeOn(next);
    if (!next) setShaking(false);
    try {
      localStorage.setItem("nmq-shake", next ? "1" : "0");
    } catch { /* noop */ }
    audio.play("click");
  };
  const changeMusicVol = (v: number) => {
    setMusicVol(v);
    audio.setMusicVolume(v);
  };
  const changeSfxVol = (v: number) => {
    setSfxVol(v);
    audio.setSfxVolume(v);
  };
  const resetRecords = () => {
    leaderboardRef.current = [];
    setLeaderboard([]);
    storeScores([]);
    const fresh = emptyStats();
    statsRef.current = fresh;
    setStats(fresh);
    storeStats(fresh);
    achievementsRef.current = [];
    setAchievements([]);
    storeAchievements([]);
    setBadgeToast(null);
    setResultEntryId(null);
    audio.play("click");
  };

  const shareResult = useCallback(async () => {
    const summary = mode === "timed"
      ? `${formatScore(me.score)} points on ${activeDifficulty.name} rank`
      : winner === null
        ? `a draw on ${activeDifficulty.name} rank`
        : `${playerNames[winner]} won on ${activeDifficulty.name} rank`;
    const message = `NARUTO MEMORY QUEST | ${summary} | Grade ${grade?.letter ?? "-"} | ${matchedIdx.length / 2}/${activeDifficulty.pairs} pairs`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Naruto Memory Quest", text: message });
        setCopied(true);
        queueTimeout(() => setCopied(false), 2000);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const field = document.createElement("textarea");
        field.value = message;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const succeeded = document.execCommand("copy");
        document.body.removeChild(field);
        if (!succeeded) throw new Error("Clipboard unavailable");
      }
      setCopied(true);
      queueTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [activeDifficulty.name, activeDifficulty.pairs, grade?.letter, matchedIdx.length, me.score, mode, playerNames, queueTimeout, winner]);

  /* ---------------------------------------------------------- derived UI */
  const canEditResultName = Boolean(resultEntryId) && !(mode === "cpu" && winner === 1);
  const progress = (timeLeft / activeDifficulty.time) * 100;
  const matchCount = matchedIdx.length / 2;
  const totalPairs = activeDifficulty.pairs;
  const turnTone: Tone = turn === 1 ? "p2" : "p1";
  const mySageCharge = sageCharge[turn] ?? 0;
  const mySageLeft = sageLeft[turn] ?? 0;
  const accuracy = attempts > 0 ? Math.round((matchCount / attempts) * 100) : 100;

  const footerMessage =
    previewing ? "MEMORIZE THE BOARD — TAP TO SKIP"
    : peeking ? "SHARINGAN SEES ALL"
    : mode === "cpu"
      ? turn === 1
        ? "KAGE AI IS STUDYING THE BOARD"
        : me.combo > 1
          ? `${me.combo}X STREAK. KEEP IT GOING!`
          : "YOUR TURN — FLIP TWO CARDS"
      : mode === "local"
        ? `${playerNames[turn]}'S TURN${players[turn] && players[turn].combo > 1 ? ` · ${players[turn].combo}X STREAK` : ""}`
        : me.combo > 1
          ? `${me.combo}X STREAK. KEEP IT GOING!`
          : matchCount === 0
            ? "FLIP TWO CARDS TO FIND A MATCH"
            : "FOLLOW YOUR INSTINCTS";

  const resultHeadline = (() => {
    if (mode === "timed") {
      return phase === "won"
        ? { eyebrow: "THE VILLAGE IS PROUD", title: <>Mission <em>complete.</em></>, copy: "Every face remembered. That is true shinobi focus." }
        : { eyebrow: "THE CLOCK WON THIS ROUND", title: <>Time&apos;s <em>up.</em></>, copy: "Even the greatest shinobi train again. Run it back?" };
    }
    if (winner === null) {
      return { eyebrow: "NEITHER SIDE BLINKED", title: <>Dead <em>heat.</em></>, copy: "Same pairs, same points. The scroll calls it a draw." };
    }
    if (mode === "cpu") {
      return winner === 0
        ? { eyebrow: "YOU OUTSMARTED THE MACHINE", title: <>Total <em>victory.</em></>, copy: "The Kage AI never saw that last pair coming." }
        : { eyebrow: "THE KAGE AI TAKES THE BOARD", title: <>Out<em>thought.</em></>, copy: "It remembered one card too many. Raise the difficulty and try again." };
    }
    return {
      eyebrow: "HOTSEAT DUEL COMPLETE",
      title: <>{playerNames[winner]} <em>wins.</em></>,
      copy: "The board is cleared and the bragging rights are official.",
    };
  })();

  const resultIsVictory =
    (mode === "timed" && phase === "won") || (mode === "cpu" && winner === 0) || (mode === "local" && winner !== null);

  const peekMax = peekStartFor(mode, activeDifficulty.pairs);
  const rasMax = rasenganStartFor(activeDifficulty.pairs);

  return (
    <div className={`app-shell phase-${phase}`}>
      <LeafStorm show={phase === "won"} variant="win" count={36} />
      <LeafStorm show={phase === "playing" && sageActive && !previewing} variant="sage" count={14} />

      <header className="site-header">
        {phase === "start" ? (
          <div className="brand" aria-label="Naruto Memory Quest">
            <span className="brand-symbol"><LeafIcon /></span>
            <span className="brand-copy"><strong>NARUTO</strong><small>MEMORY QUEST</small></span>
          </div>
        ) : (
          <button className="brand brand-home" onClick={goToSetup} aria-label="Back to the main menu" title="Back to the main menu">
            <span className="brand-symbol"><LeafIcon /></span>
            <span className="brand-copy"><strong>NARUTO</strong><small>MEMORY QUEST</small></span>
            <span className="brand-return" aria-hidden="true"><ArrowIcon /><b>MAIN MENU</b></span>
          </button>
        )}

        <nav className="header-actions" aria-label="Game controls">
          <button className="header-link" onClick={() => openModal("help")} aria-label="How to play">
            <span className="header-help-icon">?</span><span className="header-link-text">HOW TO PLAY</span>
          </button>
          <button className="header-link" onClick={() => openModal("leaderboard")} aria-label="Leaderboard">
            <TrophyIcon /><span className="header-link-text">LEADERBOARD</span>
          </button>
          <button className="header-link" onClick={() => openModal("collection")} aria-label="Ninja collection">
            <GridIcon /><span className="header-link-text">SCROLL · {stats.discoveries.length}/{CHARACTERS.length}</span>
          </button>
          <button className="header-link badges-link" onClick={() => openModal("badges")} aria-label="Achievements">
            <BadgeIcon /><span className="header-link-text">BADGES · {achievements.length}/{ACHIEVEMENTS.length}</span>
          </button>
          <span className="header-separator" />
          <button
            className={`music-control ${musicOn ? "is-on" : "is-off"}`}
            onClick={toggleMusic}
            aria-label={musicOn ? "Mute Konoha theme" : "Play Konoha theme"}
            title={musicOn ? "Mute Konoha theme (M)" : "Play Konoha theme (M)"}
            aria-pressed={musicOn}
          >
            <EqBars on={musicOn} />
            <span className="music-label">KONOHA FM</span>
          </button>
          <button className="icon-control sfx-control" onClick={toggleSfx} aria-label={sfxOn ? "Mute sound effects" : "Turn sound effects on"} title={sfxOn ? "Mute SFX" : "Unmute SFX"}>
            <SoundIcon muted={!sfxOn} />
          </button>
          <button className="icon-control" onClick={() => openModal("settings")} aria-label="Settings" title="Settings">
            <GearIcon />
          </button>
          {(phase === "playing" || phase === "paused") && (
            <button className="pause-control" onClick={phase === "playing" ? pauseGame : resumeGame} aria-label={phase === "playing" ? "Pause game" : "Resume game"}>
              <PauseIcon paused={phase === "paused"} /><span>{phase === "playing" ? "PAUSE" : "RESUME"}</span>
            </button>
          )}
        </nav>
      </header>

      {phase === "start" ? (
        <main className="hero-screen">
          <div className="hero-image" aria-hidden="true" />
          <div className="hero-embers" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className="hero-content">
            <div className="hero-copy">
              <div className="hero-eyebrow"><span className="eyebrow-line" /> THE HIDDEN LEAF MEMORY CHALLENGE</div>
              <h1 className="hero-title"><span>NARUTO</span><strong>MEMORY QUEST<span className="title-period">.</span></strong></h1>
              <p className="hero-description">A shinobi never forgets. Pick your battle, pick your rank, then match every face before the board beats you.</p>
              <div className="hero-roster" aria-hidden="true">
                {HERO_ROSTER.map((id, index) => {
                  const character = CHARACTERS.find((entry) => entry.id === id);
                  if (!character) return null;
                  return (
                    <span key={character.id} className="roster-chip" style={{ animationDelay: `${700 + index * 90}ms` }}>
                      <CharacterArt character={character} />
                    </span>
                  );
                })}
                <span className="roster-more">+{CHARACTERS.length - HERO_ROSTER.length} MORE · {CHARACTERS.length} UNIQUE PAIRS</span>
              </div>
              <div className="hero-stats">
                <div><span>RANK</span><strong>{shinobiTitle}</strong></div>
                <div><span>WINS</span><strong>{String(stats.wins).padStart(2, "0")}</strong></div>
                <div><span>BEST</span><strong>{formatScore(stats.bestScore)}</strong></div>
                <div><span>SCROLL</span><strong>{stats.discoveries.length}/{CHARACTERS.length}</strong></div>
              </div>
            </div>

            <div className="hero-console">
              <div className="console-head">
                <span><i className="console-dot" />MISSION SETUP</span>
                <span className="console-head-note">
                  CONFIG / 01 · {difficulty.pairs * 2} CARDS{winsToNext !== null && stats.games > 0 ? ` · ${winsToNext} WIN${winsToNext === 1 ? "" : "S"} TO RANK UP` : ""}
                </span>
              </div>

              <div className="console-body">
                <div className="console-col modes-col">
                  <span className="console-label">CHOOSE YOUR BATTLE</span>
                  <div className="mode-strip" role="radiogroup" aria-label="Game mode">
                    {MODES.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="radio"
                        aria-checked={mode === entry.id}
                        className={`mode-option ${mode === entry.id ? "is-active" : ""}`}
                        onClick={() => { setMode(entry.id); audio.play("click"); }}
                      >
                        <span className="mode-icon"><ModeIcon mode={entry.id} /></span>
                        <span className="mode-copy">
                          <strong>{entry.name}<small>{entry.tag}</small></strong>
                          <span>{entry.blurb}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="console-col rank-col">
                  <span className="console-label">RANK / BOARD SIZE</span>
                  <div className="diff-grid" role="radiogroup" aria-label="Difficulty">
                    {DIFFICULTIES.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="radio"
                        aria-checked={difficultyId === entry.id}
                        className={`diff-chip ${difficultyId === entry.id ? "is-active" : ""}`}
                        data-rank={entry.rank}
                        onClick={() => { setDifficultyId(entry.id); audio.play("click"); }}
                      >
                        <strong>{entry.name}</strong>
                        <span>{entry.blurb}</span>
                      </button>
                    ))}
                  </div>
                  <p className="console-note">
                    {difficulty.note} {mode === "timed" ? `${difficulty.time}s on the clock.` : "No clock — most pairs takes the win."} One unique shinobi per pair.
                  </p>
                  <p className="arts-line">
                    <EyeIcon /><span>PEEK ×{peekStartFor(mode, difficulty.pairs)}</span>
                    <SpiralIcon /><span>RASENGAN ×{rasenganStartFor(difficulty.pairs)}</span>
                    <SageIcon /><span>SAGE ×2</span>
                  </p>
                </div>

                <div className="console-col name-col">
                  <span className="console-label">{mode === "local" ? "DUELIST NAMES" : "YOUR CALLSIGN"}</span>
                  <div className={`name-grid ${mode === "local" ? "is-duo" : ""}`}>
                    <label className="name-field">
                      <span>{mode === "local" ? "PLAYER ONE" : "PLAYER"}</span>
                      <input value={p1Name} onChange={(event) => setP1Name(event.target.value)} maxLength={12} autoComplete="off" spellCheck={false} aria-label="Player one name" />
                    </label>
                    {mode === "local" && (
                      <label className="name-field tone-p2">
                        <span>PLAYER TWO</span>
                        <input value={p2Name} onChange={(event) => setP2Name(event.target.value)} maxLength={12} autoComplete="off" spellCheck={false} aria-label="Player two name" />
                      </label>
                    )}
                    {mode === "cpu" && (
                      <div className="name-field is-locked">
                        <span>OPPONENT</span>
                        <strong>{CPU_NAME}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="console-go">
                  <button className="primary-button console-button" onClick={() => startGame(mode, difficultyId)}>
                    <span>START MISSION</span><span className="button-arrow"><ArrowIcon /></span>
                  </button>
                  <span className="enter-hint console-hint">PRESS <kbd>ENTER</kbd> TO BEGIN</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main
          className={`game-scene ${shaking ? "is-shaking" : ""} ${sageActive && !previewing ? "is-sage" : ""}`}
          style={
            {
              "--board-cols": activeDifficulty.cols,
              "--board-ratio": boardRatio(activeDifficulty),
              "--card-aspect": activeDifficulty.aspect,
              "--board-mcols": activeDifficulty.mCols,
              "--board-maspect": activeDifficulty.mAspect,
              "--board-mratio": boardRatio(activeDifficulty, activeDifficulty.mCols, activeDifficulty.mAspect),
            } as CSSProperties
          }
        >
          <div className="scene-glow" aria-hidden="true" />
          <div className="scene-watermark" aria-hidden="true"><LeafIcon /></div>
          <div className="scene-ambient" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <div className="arena-layout">
            <aside className="arena-sidebar">
              <div className="sidebar-intro">
                <div className="section-eyebrow">
                  <span className="small-diamond" /> {MODES.find((entry) => entry.id === mode)?.tag ?? "SOLO"} / {activeDifficulty.name} RANK
                </div>
                <h1>{MODES.find((entry) => entry.id === mode)?.headline ?? "Trust your"}<br /><em>{MODES.find((entry) => entry.id === mode)?.subhead ?? "instincts."}</em></h1>
                <p>{MODES.find((entry) => entry.id === mode)?.blurb ?? ""}</p>
              </div>

              {versus ? (
                <div className="score-stack versus-stack">
                  <div className={`turn-block tone-${turnTone} ${cpuThinking ? "is-thinking" : ""}`}>
                    <span className="metric-label">CURRENT TURN</span>
                    <strong>{playerNames[turn]}</strong>
                    <span className="turn-sub">
                      {cpuThinking ? "READING THE BOARD" : `MATCH ${String(matchCount).padStart(2, "0")} / ${String(totalPairs).padStart(2, "0")}`}
                    </span>
                  </div>
                  <div className="duel-list">
                    {[0, 1].map((index) => {
                      const player = players[index] ?? emptyPlayer();
                      const isActive = turn === index && phase === "playing";
                      const charge = sageCharge[index] ?? 0;
                      const left = sageLeft[index] ?? 0;
                      return (
                        <div key={index} className={`player-card tone-${index === 0 ? "p1" : "p2"} ${isActive ? "is-active" : ""} ${left > 0 ? "is-saged" : ""}`}>
                          <span className="player-index">{index === 0 ? "01" : "02"}</span>
                          <div className="player-meta">
                            <strong>{playerNames[index]}</strong>
                            <span className="metric-label">{mode === "cpu" && index === 1 ? "OPPONENT" : `STREAK x${player.combo}`}</span>
                            <span className="sage-dots" aria-label={left > 0 ? "Sage mode active" : `${charge} of ${SAGE_NEED} sage charge`}>
                              {Array.from({ length: SAGE_NEED }, (_, i) => (
                                <i key={i} className={i < charge || left > 0 ? "on" : ""} />
                              ))}
                              {left > 0 && <b>SAGE {left}s</b>}
                            </span>
                          </div>
                          <div className="player-numbers">
                            <b key={`pairs-${player.pairs}`}>{String(player.pairs).padStart(2, "0")}</b>
                            <span className="metric-label">PAIRS</span>
                            <i key={`pts-${player.score}`}>{formatScore(player.score)}</i>
                            <span className="metric-label">PTS</span>
                          </div>
                          {isActive && <span className="player-turn-pill">TURN</span>}
                        </div>
                      );
                    })}
                    <span className="duel-divider" aria-hidden="true"><b>VS</b></span>
                  </div>
                </div>
              ) : (
                <div className="score-stack">
                  <div className={`time-block ${timeLeft <= 15 ? "is-urgent" : ""}`}>
                    <span className="metric-label">TIME REMAINING</span>
                    <strong>{formatTime(timeLeft)}</strong>
                    <div className="timer-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
                  </div>
                  <div className="score-block">
                    <span className="metric-label">YOUR SCORE</span>
                    <strong key={scorePulse} className="score-number">{formatScore(me.score)}</strong>
                  </div>
                  <div className="mini-metrics">
                    <div><span className="metric-label">PAIRS FOUND</span><strong>{String(matchCount).padStart(2, "0")}<small> / {String(totalPairs).padStart(2, "0")}</small></strong></div>
                    <div className="combo-metric"><span className="metric-label">STREAK</span><strong className={me.combo > 1 ? "hot-streak" : ""}>x{me.combo}</strong></div>
                  </div>
                </div>
              )}

              <div className="jutsu-panel">
                <span className="jutsu-title"><SageIcon /> CHAKRA ARTS · {versus ? playerNames[turn] : "SOLO"}</span>
                <div className="jutsu-row">
                  <button
                    className="jutsu-button"
                    onClick={usePeek}
                    disabled={powersLocked || myPeeks <= 0}
                    aria-label={`Sharingan peek, ${myPeeks} charges left`}
                    title="Reveal every card briefly (1)"
                  >
                    <EyeIcon />
                    <span className="jutsu-copy"><strong>PEEK</strong><span className="jutsu-pips">{Array.from({ length: peekMax }, (_, i) => (<i key={i} className={i < myPeeks ? "on" : ""} />))}</span></span>
                    <kbd>1</kbd>
                  </button>
                  <button
                    className="jutsu-button"
                    onClick={useRasengan}
                    disabled={powersLocked || myRas <= 0}
                    aria-label={`Rasengan strike, ${myRas} of ${rasMax} charges left`}
                    title="Instantly claim one matching pair (2)"
                  >
                    <SpiralIcon />
                    <span className="jutsu-copy"><strong>RASENGAN</strong><span className="jutsu-pips">{Array.from({ length: rasMax }, (_, i) => (<i key={i} className={i < myRas ? "on" : ""} />))}</span></span>
                    <kbd>2</kbd>
                  </button>
                </div>
                <div className={`sage-meter ${mySageLeft > 0 ? "is-active" : ""}`}>
                  <div className="sage-meter-head">
                    <span className="metric-label">{mySageLeft > 0 ? `SAGE MODE · ${mySageLeft}s · 2X` : "SAGE METER"}</span>
                    <span className="sage-count">{mySageLeft > 0 ? "ACTIVE" : `${Math.min(mySageCharge, SAGE_NEED)}/${SAGE_NEED}`}</span>
                  </div>
                  <div className="sage-track" aria-hidden="true">
                    {Array.from({ length: SAGE_NEED }, (_, i) => (
                      <i key={i} className={i < mySageCharge || mySageLeft > 0 ? "on" : ""} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="sidebar-controls">
                <span>THE CONTROLS</span>
                <div><span className="keycap-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>or arrow keys to move</span></div>
                <div><kbd>ENTER</kbd><span>flip a card</span></div>
                <div><span className="keycap-group"><kbd>1</kbd><kbd>2</kbd></span><span>chakra arts</span></div>
                <div><span className="keycap-group"><kbd>P</kbd><kbd>M</kbd></span><span>pause · music</span></div>
              </div>
            </aside>

            <section className="arena-main" aria-label="Memory game board">
              <div className="board-topline">
                <span className={versus ? `tone-${turnTone}` : ""}>
                  <i className="live-dot" /> {previewing ? "MEMORIZE THE BOARD" : versus ? `${playerNames[turn]}'S TURN` : "MISSION IN PROGRESS"}
                </span>
                <span>{String(matchCount).padStart(2, "0")} MATCHED <b>/</b> {activeDifficulty.pairs * 2} CARDS</span>
              </div>

              <div className={`board-frame ${mode === "cpu" && turn === 1 && phase === "playing" ? "is-cpu-turn" : ""} ${sageActive && !previewing ? "is-sage" : ""}`} ref={boardRef}>
                <div className={`board-grid ${shuffling ? "is-shuffling" : ""}`} data-diff={activeDifficulty.id} data-density={cardDensity(activeDifficulty)}>
                  {cards.map((card, index) => {
                    const isMatched = matchedIdx.includes(index);
                    const isFaceUp = isMatched || openIndices.includes(index) || previewing || peeking;
                    return (
                      <button
                        key={card.key}
                        ref={(element) => { cardRefs.current[index] = element; }}
                        className={`memory-card ${isFaceUp ? "is-flipped" : ""} ${isMatched ? "is-matched" : ""} ${keyboardMode && selectedIndex === index ? "is-selected" : ""} ${previewing ? "is-preview" : ""}`}
                        onClick={() => {
                          if (previewing) {
                            skipPreview();
                            return;
                          }
                          setSelectedIndex(index);
                          setKeyboardMode(false);
                          keyboardModeRef.current = false;
                          flipCard(index);
                        }}
                        onFocus={() => { setSelectedIndex(index); setKeyboardMode(true); keyboardModeRef.current = true; }}
                        disabled={isMatched || boardLocked}
                        tabIndex={selectedIndex === index ? 0 : -1}
                        aria-label={isMatched ? `${card.character.name}, matched` : isFaceUp ? `${card.character.name}, revealed` : `Hidden card ${index + 1}`}
                        aria-pressed={isFaceUp}
                      >
                        <span className="card-inner">
                          <span className="card-face card-back">
                            <span className="back-outline" />
                            <span className="back-emblem"><LeafIcon /></span>
                            <span className="back-wordmark">HIDDEN LEAF</span>
                          </span>
                          <span className="card-face card-front">
                            <CharacterArt character={card.character} eager />
                            <span className="front-shade" />
                            <span className="front-name">{card.character.name}</span>
                            {isMatched && <span className="matched-mark" aria-hidden="true"><CheckIcon /></span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="effects-layer" aria-hidden="true">
                  {particles.map((particle) => (
                    <span
                      key={particle.id}
                      className="particle"
                      style={{
                        left: particle.x,
                        top: particle.y,
                        width: particle.size,
                        height: particle.size,
                        backgroundColor: particle.color,
                        "--dx": `${particle.dx}px`,
                        "--dy": `${particle.dy}px`,
                        "--delay": `${particle.delay}ms`,
                      } as CSSProperties}
                    />
                  ))}
                  {floatingText && (
                    <span
                      key={floatingText.id}
                      className={`floating-text ${floatingText.miss ? "is-miss" : ""} tone-${floatingText.tone}`}
                      style={{ left: floatingText.x, top: floatingText.y }}
                    >
                      {floatingText.text}
                    </span>
                  )}
                </div>

                {notice && <div className="board-notice" key={notice.id}>{notice.text}</div>}

                {previewing && (
                  <button className="preview-veil" onClick={skipPreview} aria-label="Skip memorize preview and start">
                    <strong key={previewTick}>MEMORIZE!</strong>
                    <span className="preview-bar" aria-hidden="true">
                      <i style={{ animationDuration: `${activeDifficulty.previewMs}ms` }} />
                    </span>
                    <span className="preview-skip">TAP OR PRESS ENTER TO BEGIN</span>
                  </button>
                )}
                {peeking && !previewing && (
                  <div className="peek-veil" aria-hidden="true"><EyeIcon /><span>SHARINGAN ACTIVE</span></div>
                )}
              </div>

              <div className="board-footer">
                <span className={me.combo > 1 || (versus && (players[turn]?.combo ?? 0) > 1) ? "footer-streak" : ""} aria-live="polite">
                  <span className="footer-spark"><SparkIcon /></span> {footerMessage}
                </span>
                <button onClick={() => startGame()} className="restart-link" aria-label="Restart mission"><RestartIcon /> RESTART</button>
              </div>
            </section>
          </div>

          {banner && <div className={`turn-banner tone-${banner.tone}`} key={banner.id}>{banner.label}</div>}
        </main>
      )}

      {phase === "paused" && !modal && (
        <div className="overlay pause-overlay" role="presentation">
          <div className="dialog-panel pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
            <div className="modal-icon"><PauseIcon /></div>
            <span className="dialog-eyebrow">MISSION PAUSED · {MODES.find((entry) => entry.id === mode)?.tag} · {activeDifficulty.name}</span>
            <h2 id="pause-title">Catch your<br /><em>breath.</em></h2>
            <p>{versus ? "The duel is frozen mid-turn. Nothing moves until you say so." : "Your timer is frozen. The village will be here when you get back."}</p>
            <button className="primary-button dialog-primary" onClick={resumeGame}><span>RESUME MISSION</span><span className="button-arrow"><ArrowIcon /></span></button>
            <button className="text-button" onClick={() => startGame()}><RestartIcon /> START OVER</button>
            <button className="text-button" onClick={goToSetup}><GearIcon /> CHANGE MODE OR RANK</button>
            <span className="dialog-key-hint">PRESS P OR ESC TO RESUME · M TOGGLES MUSIC</span>
          </div>
        </div>
      )}

      {(phase === "won" || phase === "lost") && (
        <div className="overlay result-overlay" role="presentation">
          <div className={`dialog-panel result-panel ${resultIsVictory ? "is-victory" : ""}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div className="result-symbol"><LeafIcon /></div>
            {isNewBest && <div className="record-badge"><TrophyIcon /><span>NEW RECORD</span></div>}
            {titleUp && <div className="rankup-banner">PROMOTED TO {titleUp}</div>}
            <span className="dialog-eyebrow">{resultHeadline.eyebrow}</span>
            <h2 id="result-title">{resultHeadline.title}</h2>
            <p className="result-copy">{resultHeadline.copy}</p>
            <p className="result-meta">
              {MODES.find((entry) => entry.id === mode)?.tag ?? "SOLO"} · {activeDifficulty.name} RANK · {activeDifficulty.pairs * 2} CARDS ·{" "}
              {mode === "timed" ? `${activeDifficulty.time}s CLOCK` : "TURN BASED"}
            </p>
            {grade && (
              <div className={`grade-medal grade-${grade.letter}`} aria-label={`Mission grade ${grade.letter}, ${grade.label}`}>
                <strong>{grade.letter}</strong><span>{grade.label}</span><i>{grade.accuracy}% ACCURACY</i>
              </div>
            )}

            {versus ? (
              <div className="result-duel">
                {[0, 1].map((index) => {
                  const player = players[index] ?? emptyPlayer();
                  return (
                    <div key={index} className={`duel-side tone-${index === 0 ? "p1" : "p2"} ${winner === index ? "is-winner" : ""}`}>
                      <span className="metric-label">{mode === "cpu" && index === 1 ? "OPPONENT" : `PLAYER ${index + 1}`}</span>
                      <strong>{playerNames[index]}</strong>
                      <div className="duel-figures">
                        <span><b>{String(player.pairs).padStart(2, "0")}</b>PAIRS</span>
                        <span><b>{formatScore(player.score)}</b>POINTS</span>
                        <span><b>x{player.best}</b>BEST RUN</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="result-score">
                  <span>FINAL SCORE</span>
                  <strong>{formatScore(me.score)}</strong>
                  {timeBonus > 0 && <span className="bonus-line">INCLUDES TIME BONUS +{timeBonus}</span>}
                  {perfectBonus > 0 && <span className="bonus-line perfect-line">PERFECT MEMORY +{perfectBonus} · NO MISSES</span>}
                </div>
                <div className="result-details">
                  <div><span>PAIRS</span><strong>{matchCount} / {totalPairs}</strong></div>
                  <div><span>BEST STREAK</span><strong>x{me.best}</strong></div>
                  <div><span>ACCURACY</span><strong>{accuracy}%</strong></div>
                </div>
              </>
            )}

            <p className="record-line">RANK: {shinobiTitle} · WINS {stats.wins} · BEST {formatScore(stats.bestScore)}{winsToNext !== null ? ` · ${winsToNext} WIN${winsToNext === 1 ? "" : "S"} TO RANK UP` : " · MAX RANK"}</p>

            {canEditResultName && (
              <form className="name-form" onSubmit={saveName}>
                <label htmlFor="callsign">YOUR NAME ON THE SCROLL</label>
                <div>
                  <input id="callsign" value={resultName} onChange={(event) => { setResultName(event.target.value); setNameSaved(false); }} maxLength={12} autoComplete="off" spellCheck={false} aria-label="Leaderboard name" />
                  <button type="submit">{nameSaved ? "SAVED" : "SAVE NAME"}</button>
                </div>
              </form>
            )}

            <button className="primary-button dialog-primary" onClick={() => startGame()}><span>PLAY AGAIN</span><span className="button-arrow"><ArrowIcon /></span></button>
            <div className="dialog-button-row">
              <button className="text-button" onClick={() => openModal("leaderboard")}><TrophyIcon /> LEADERBOARD</button>
              <button className="text-button" onClick={shareResult}>{copied ? "SHARED" : "SHARE RESULT"}</button>
              <button className="text-button" onClick={goToSetup}><GearIcon /> CHANGE SETUP</button>
            </div>
            <span className="dialog-key-hint">PRESS R FOR AN INSTANT RESTART</span>
          </div>
        </div>
      )}

      {badgeToast && (
        <div className="badge-toast" role="status" key={badgeToast.id}>
          <span className="badge-toast-mark">{badgeToast.badge.mark}</span>
          <span className="badge-toast-copy"><small>BADGE UNLOCKED</small><strong>{badgeToast.badge.name}</strong></span>
        </div>
      )}

      {modal && (
        <div className="overlay info-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }} role="presentation">
          <div className={`dialog-panel info-panel ${modal === "collection" ? "is-collection" : ""}`} role="dialog" aria-modal="true" aria-labelledby="info-title">
            <div className="info-topline">
              <span>
                {modal === "help" ? "FIELD GUIDE / 001" : modal === "leaderboard" ? "HIDDEN LEAF RECORDS" : modal === "collection" ? "NINJA SCROLL ARCHIVE" : modal === "badges" ? "SHINOBI DEEDS / 008" : "VILLAGE SETTINGS"}
              </span>
              <button className="close-button" onClick={() => setModal(null)} aria-label="Close dialog"><CloseIcon /></button>
            </div>

            {modal === "help" && (
              <>
                <div className="info-stamp"><LeafIcon /></div>
                <h2 id="info-title">Sharpen your<br /><em>memory.</em></h2>
                <p className="info-description">Flip two cards at a time and match every Naruto character — {CHARACTERS.length} shinobi in the roster, each appearing as exactly one pair, never a quad. Every run opens with a memorize preview; Time Trial restores two seconds for every pair.</p>

                <div className="guide-modes">
                  {MODES.map((entry) => (
                    <div key={entry.id}>
                      <span className="mode-icon"><ModeIcon mode={entry.id} /></span>
                      <p><strong>{entry.name}<small>{entry.tag}</small></strong>{entry.blurb}</p>
                    </div>
                  ))}
                </div>

                <div className="guide-arts">
                  <div><span className="mode-icon"><EyeIcon /></span><p><strong>SHARINGAN PEEK · KEY 1</strong>Reveal every remaining card for a heartbeat. Limited charges per game.</p></div>
                  <div><span className="mode-icon"><SpiralIcon /></span><p><strong>RASENGAN STRIKE · KEY 2</strong>Instantly claim one random pair. Keeps your turn — perfect for breaking a stall.</p></div>
                  <div><span className="mode-icon"><SageIcon /></span><p><strong>SAGE MODE · {SAGE_NEED} MATCHES</strong>Chain {SAGE_NEED} matches without missing to awaken {SAGE_DURATION}s of double points.</p></div>
                  <div><span className="mode-icon"><MusicIcon /></span><p><strong>KONOHA FM · KEY M</strong>A live-synthesized village theme. Taiko drums join the battle and race the final seconds.</p></div>
                </div>

                <div className="guide-list">
                  {DIFFICULTIES.map((entry) => (
                    <div key={entry.id}>
                      <span>{entry.rank}</span>
                      <p><strong>{entry.name} — {entry.blurb}</strong>{entry.note} Points x{entry.mult}.</p>
                    </div>
                  ))}
                </div>

                <div className="guide-controls">
                  <span>KEYBOARD SHORTCUTS</span>
                  <p><kbd>ARROWS</kbd> or <kbd>WASD</kbd> move / <kbd>ENTER</kbd> flip / <kbd>1</kbd> peek / <kbd>2</kbd> rasengan / <kbd>P</kbd> pause / <kbd>M</kbd> music / <kbd>R</kbd> restart</p>
                  <p className="guide-extra">Mid-mission, click the Naruto logo in the header to drop straight back to the main menu.</p>
                </div>
                <button className="primary-button dialog-primary" onClick={phase === "start" ? () => startGame(mode, difficultyId) : () => { setModal(null); if (phase === "paused") resumeGame(); }}>
                  <span>{phase === "start" ? "START MISSION" : "BACK TO MISSION"}</span><span className="button-arrow"><ArrowIcon /></span>
                </button>
              </>
            )}

            {modal === "leaderboard" && (
              <>
                <div className="info-stamp trophy-stamp"><TrophyIcon /></div>
                <h2 id="info-title">Hall of<br /><em>shinobi.</em></h2>
                <p className="info-description">The best runs on this device, etched into the scroll — solo scores and duel victories alike.</p>
                <div className="leaderboard-table">
                  <div className="table-heading"><span>RANK</span><span>CALLSIGN</span><span>SCORE</span></div>
                  {leaderboard.length ? leaderboard.map((entry, index) => (
                    <div className={`table-row ${entry.id === resultEntryId ? "is-current" : ""} ${entry.won ? "" : "is-loss"}`} key={entry.id}>
                      <span className="table-rank">{String(index + 1).padStart(2, "0")}</span>
                      <span className="table-name">
                        {entry.name}
                        <small>{entry.tag} · {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}</small>
                      </span>
                      <strong>{formatScore(entry.score)}</strong>
                    </div>
                  )) : (
                    <div className="empty-scores"><LeafIcon /><strong>The scroll is still blank.</strong><span>Finish a mission to claim the first spot.</span></div>
                  )}
                </div>
                <button className="primary-button dialog-primary" onClick={phase === "start" ? () => startGame(mode, difficultyId) : () => setModal(null)}>
                  <span>{phase === "start" ? "CLAIM YOUR SPOT" : "CLOSE SCROLL"}</span><span className="button-arrow"><ArrowIcon /></span>
                </button>
              </>
            )}

            {modal === "collection" && (
              <>
                <div className="info-stamp"><GridIcon /></div>
                <h2 id="info-title">Ninja<br /><em>scroll.</em></h2>
                <p className="info-description">
                  Every unique shinobi you match joins the scroll — one pair each, never a quad. {stats.discoveries.length} of {ROSTER_SIZE} discovered.
                </p>
                <div className="scroll-progress" aria-hidden="true">
                  <span style={{ width: `${(stats.discoveries.length / ROSTER_SIZE) * 100}%` }} />
                </div>

                <div className="faction-filter" role="tablist" aria-label="Filter the scroll by faction">
                  {FACTIONS.map((faction) => {
                    const total = faction.id === "ALL" ? ROSTER_SIZE : CHARACTERS.filter((c) => c.faction === faction.id).length;
                    const found = faction.id === "ALL"
                      ? stats.discoveries.length
                      : CHARACTERS.filter((c) => c.faction === faction.id && stats.discoveries.includes(c.id)).length;
                    return (
                      <button
                        key={faction.id}
                        type="button"
                        role="tab"
                        aria-selected={scrollFilter === faction.id}
                        className={`faction-chip ${scrollFilter === faction.id ? "is-active" : ""} ${found === total ? "is-complete" : ""}`}
                        onClick={() => { setScrollFilter(faction.id); audio.play("click"); }}
                      >
                        {faction.label}<b>{found}<i>/</i>{total}</b>
                      </button>
                    );
                  })}
                </div>

                <div className="collection-grid">
                  {CHARACTERS.filter((character) => scrollFilter === "ALL" || character.faction === scrollFilter).map((character) => {
                    const found = stats.discoveries.includes(character.id);
                    return (
                      <div key={character.id} className={`collection-card ${found ? "" : "is-locked"}`}>
                        <span className="collection-art" role="img" aria-label={found ? character.name : "Undiscovered shinobi"}>
                          <CharacterArt character={character} />
                          {!found && <span className="collection-lock">?</span>}
                          {found && <span className="collection-faction">{character.faction}</span>}
                        </span>
                        <strong>{found ? character.name : "???"}</strong>
                        <span>{found ? "DISCOVERED" : "LOCKED"}</span>
                      </div>
                    );
                  })}
                </div>
                <button className="text-button badge-link-button" onClick={() => setModal("badges")}><BadgeIcon /> VIEW BADGES · {achievements.length}/{ACHIEVEMENTS.length}</button>
                <button className="primary-button dialog-primary" onClick={phase === "start" ? () => startGame(mode, difficultyId) : () => setModal(null)}>
                  <span>{phase === "start" ? "HUNT THE MISSING" : "CLOSE SCROLL"}</span><span className="button-arrow"><ArrowIcon /></span>
                </button>
              </>
            )}

            {modal === "badges" && (
              <>
                <div className="info-stamp trophy-stamp"><BadgeIcon /></div>
                <h2 id="info-title">Hall of<br /><em>deeds.</em></h2>
                <p className="info-description">{achievements.length} of {ACHIEVEMENTS.length} badges earned across {stats.games} missions. New deeds are remembered on this device.</p>
                <div className="badge-grid">
                  {ACHIEVEMENTS.map((badge) => {
                    const unlocked = achievements.includes(badge.id);
                    return (
                      <div className={`badge-card ${unlocked ? "is-owned" : ""}`} key={badge.id}>
                        <span className="badge-mark">{unlocked ? badge.mark : "??"}</span>
                        <strong>{badge.name}</strong>
                        <span>{unlocked ? "UNLOCKED" : badge.hint}</span>
                      </div>
                    );
                  })}
                </div>
                <button className="primary-button dialog-primary" onClick={() => setModal(null)}><span>CLOSE SCROLL</span><span className="button-arrow"><ArrowIcon /></span></button>
              </>
            )}

            {modal === "settings" && (
              <>
                <div className="info-stamp"><GearIcon /></div>
                <h2 id="info-title">Village<br /><em>settings.</em></h2>
                <p className="info-description">Tune the Konoha FM theme, effects and feedback. Everything saves to this device.</p>

                <div className="settings-list">
                  <div className="setting-row">
                    <div className="setting-copy">
                      <strong><EqBars on={musicOn} /> KONOHA FM THEME</strong>
                      <span>Live-synthesized flute, koto and taiko. No audio files.</span>
                    </div>
                    <button className={`toggle ${musicOn ? "is-on" : ""}`} onClick={toggleMusic} aria-pressed={musicOn} aria-label="Toggle music">
                      <i />
                    </button>
                  </div>
                  <label className="slider-row">
                    <span>MUSIC VOLUME</span>
                    <input type="range" min={0} max={100} value={Math.round(musicVol * 100)} onChange={(e) => changeMusicVol(Number(e.target.value) / 100)} aria-label="Music volume" />
                  </label>
                  <div className="setting-row">
                    <div className="setting-copy">
                      <strong><SoundIcon muted={!sfxOn} /> SOUND EFFECTS</strong>
                      <span>Flips, matches, jutsu stingers and countdown ticks.</span>
                    </div>
                    <button className={`toggle ${sfxOn ? "is-on" : ""}`} onClick={toggleSfx} aria-pressed={sfxOn} aria-label="Toggle sound effects">
                      <i />
                    </button>
                  </div>
                  <label className="slider-row">
                    <span>SFX VOLUME</span>
                    <input type="range" min={0} max={100} value={Math.round(sfxVol * 100)} onChange={(e) => changeSfxVol(Number(e.target.value) / 100)} aria-label="SFX volume" />
                  </label>
                  <div className="setting-row">
                    <div className="setting-copy">
                      <strong>HAPTICS</strong>
                      <span>Subtle vibration on matches, misses and victories (mobile).</span>
                    </div>
                    <button className={`toggle ${hapticsOn ? "is-on" : ""}`} onClick={toggleHaptics} aria-pressed={hapticsOn} aria-label="Toggle haptics">
                      <i />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div className="setting-copy">
                      <strong>SCREEN SHAKE</strong>
                      <span>Camera impact on a miss. Haptics can be toggled separately.</span>
                    </div>
                    <button className={`toggle ${shakeOn ? "is-on" : ""}`} onClick={toggleShake} aria-pressed={shakeOn} aria-label="Toggle screen shake">
                      <i />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div className="setting-copy">
                      <strong>SHINOBI RECORD</strong>
                      <span>{stats.games} games · {stats.wins} wins · {stats.perfects} perfect · {stats.totalPairs} pairs · best {formatScore(stats.bestScore)}</span>
                    </div>
                    <button className="ghost-button" onClick={resetRecords}>RESET</button>
                  </div>
                </div>

                <button className="primary-button dialog-primary" onClick={() => setModal(null)}>
                  <span>DONE</span><span className="button-arrow"><ArrowIcon /></span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
