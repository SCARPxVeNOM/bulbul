import type { BN } from "@anchor-lang/core";
import type { ForfeitMode } from "./actions";

export interface CommitmentFields {
  stake: BN;
  focusMinutes: number;
  requiredCheckins: number;
  periodDays: number;
  checkins: number;
  checkinBitmap: BN;
  mode: Record<string, unknown>;
  createdAt: BN;
  deadline: BN;
}

export type CommitmentState = "active" | "succeeded" | "missed";

export interface CommitmentStatus {
  state: CommitmentState;
  dayIndex: number;
  checkedInToday: boolean;
  daysLeft: number;
  mode: ForfeitMode;
  /** Can still reach the goal if every remaining day is kept. */
  stillPossible: boolean;
}

const DAY = 86_400;

export function commitmentStatus(c: CommitmentFields, nowMs: number): CommitmentStatus {
  const now = Math.floor(nowMs / 1000);
  const created = c.createdAt.toNumber();
  const deadline = c.deadline.toNumber();
  const dayIndex = Math.min(c.periodDays - 1, Math.max(0, Math.floor((now - created) / DAY)));
  const checkedInToday = c.checkinBitmap.testn(dayIndex);
  const succeeded = c.checkins >= c.requiredCheckins;
  const ended = now >= deadline;
  const remainingDays = ended ? 0 : c.periodDays - dayIndex - (checkedInToday ? 1 : 0);
  return {
    state: succeeded ? "succeeded" : ended ? "missed" : "active",
    dayIndex,
    checkedInToday,
    daysLeft: Math.max(0, Math.ceil((deadline - now) / DAY)),
    mode: Object.keys(c.mode)[0] as ForfeitMode,
    stillPossible: succeeded || c.checkins + remainingDays >= c.requiredCheckins,
  };
}

export const MODE_COPY: Record<ForfeitMode, { title: string; detail: string }> = {
  soft: { title: "Soft", detail: "Miss it and your stake comes back. Only your companion feels it." },
  charity: { title: "Charity", detail: "Miss it and your stake is donated to charity." },
  pool: { title: "Pool", detail: "Miss it and your stake funds bonuses for people who kept their streaks." },
};
