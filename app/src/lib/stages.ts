export type StageKey = "curious" | "focused" | "evolving" | "legendary";

export interface StageInfo {
  key: StageKey;
  name: string;
  minXp: number;
  line: string;
}

// Mirrors STAGE_XP_THRESHOLDS in programs/bulbul/src/constants.rs; the program is the source of truth.
export const STAGES: readonly StageInfo[] = [
  { key: "curious", name: "Curious", minXp: 0, line: "Just hatched. Ready to grow with you." },
  { key: "focused", name: "Focused", minXp: 100, line: "Your first kept commitments shaped me." },
  { key: "evolving", name: "Evolving", minXp: 500, line: "Built from verified savings and streaks." },
  { key: "legendary", name: "Legendary", minXp: 2000, line: "Earned through sustained commitment." },
];

export function stageForXp(xp: number): StageInfo {
  return [...STAGES].reverse().find((s) => xp >= s.minXp) ?? STAGES[0]!;
}

/** Anchor decodes Rust enums as `{ focused: {} }`. */
export function stageFromEnum(value: Record<string, unknown>): StageInfo {
  const key = Object.keys(value)[0] as StageKey;
  return STAGES.find((s) => s.key === key) ?? STAGES[0]!;
}

export function nextStage(xp: number): { stage: StageInfo; remaining: number; progress: number } | null {
  const current = stageForXp(xp);
  const idx = STAGES.indexOf(current);
  const next = STAGES[idx + 1];
  if (!next) return null;
  const span = next.minXp - current.minXp;
  return { stage: next, remaining: next.minXp - xp, progress: (xp - current.minXp) / span };
}
