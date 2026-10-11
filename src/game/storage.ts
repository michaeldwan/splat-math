import { CORE_FACTORS, FACTORS, type Fact } from "./facts";

export type Config = {
  durationSec: number;
  target: number;
  tables: number[];
  sound: boolean;
};

export type Round = {
  at: number;
  correct: number;
  attempted: number;
  durationSec: number;
  target: number;
  tables: number[];
};

export type RoundResult = {
  correct: number;
  attempted: number;
  missed: readonly Fact[];
};

const DEFAULT_CONFIG: Config = {
  durationSec: 150,
  target: 50,
  tables: [...CORE_FACTORS],
  sound: true,
};

/** What the settings allow; saved values outside these are pulled back in. */
export const LIMITS = {
  durationSec: { min: 30, max: 300, step: 15 },
  target: { min: 5, max: 100, step: 5 },
} as const;

type Range = { min: number; max: number };

export const clamp = (n: number, { min, max }: Range) => Math.min(max, Math.max(min, n));

const CONFIG_KEY = "splat-math:config";
const ROUNDS_KEY = "splat-math:rounds";
const MAX_ROUNDS = 500;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the game still works without saving.
  }
}

const clampInt = (value: unknown, range: Range, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), range) : fallback;

export function loadConfig(): Config {
  const saved = read(CONFIG_KEY);
  if (typeof saved !== "object" || saved === null) return DEFAULT_CONFIG;
  const s = saved as Record<string, unknown>;
  const tables = Array.isArray(s.tables)
    ? FACTORS.filter((n) => (s.tables as unknown[]).includes(n))
    : [];
  return {
    durationSec: clampInt(s.durationSec, LIMITS.durationSec, DEFAULT_CONFIG.durationSec),
    target: clampInt(s.target, LIMITS.target, DEFAULT_CONFIG.target),
    tables: tables.length > 0 ? tables : DEFAULT_CONFIG.tables,
    sound: typeof s.sound === "boolean" ? s.sound : DEFAULT_CONFIG.sound,
  };
}

export const saveConfig = (config: Config) => write(CONFIG_KEY, config);

export function loadRounds(): Round[] {
  const saved = read(ROUNDS_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (r): r is Round =>
      typeof r === "object" &&
      r !== null &&
      typeof r.correct === "number" &&
      typeof r.durationSec === "number" &&
      Array.isArray(r.tables),
  );
}

export function saveRounds(rounds: Round[]) {
  write(ROUNDS_KEY, rounds.slice(-MAX_ROUNDS));
}

/** Best score among rounds played with the same length and times tables. */
export function bestFor(rounds: readonly Round[], config: Config): number | null {
  const tables = config.tables.join(",");
  const scores = rounds
    .filter((r) => r.durationSec === config.durationSec && r.tables.join(",") === tables)
    .map((r) => r.correct);
  return scores.length > 0 ? Math.max(...scores) : null;
}

export function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
