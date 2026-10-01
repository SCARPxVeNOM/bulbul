import { BN } from "@anchor-lang/core";
import { commitmentStatus, type CommitmentFields } from "../commitments";

const DAY = 86_400;
const T0 = 1_800_000_000;

function make(over: Partial<CommitmentFields> & { bitmap?: number } = {}): CommitmentFields {
  const { bitmap = 0, ...rest } = over;
  return {
    stake: new BN(10_000_000),
    focusMinutes: 120,
    requiredCheckins: 5,
    periodDays: 7,
    checkins: 0,
    checkinBitmap: new BN(bitmap),
    mode: { charity: {} },
    createdAt: new BN(T0),
    deadline: new BN(T0 + 7 * DAY),
    ...rest,
  };
}

const at = (seconds: number) => (T0 + seconds) * 1000;

describe("commitmentStatus", () => {
  it("is active on day 0 with nothing checked in", () => {
    const s = commitmentStatus(make(), at(60));
    expect(s).toMatchObject({ state: "active", dayIndex: 0, checkedInToday: false, daysLeft: 7, mode: "charity", stillPossible: true });
  });

  it("tracks the day index and today's bit", () => {
    const s = commitmentStatus(make({ bitmap: 0b100, checkins: 1 }), at(2 * DAY + 5));
    expect(s.dayIndex).toBe(2);
    expect(s.checkedInToday).toBe(true);
  });

  it("succeeds as soon as enough check-ins are recorded, even before the deadline", () => {
    expect(commitmentStatus(make({ checkins: 5, bitmap: 0b11111 }), at(5 * DAY)).state).toBe("succeeded");
  });

  it("is missed after the deadline without enough check-ins", () => {
    const s = commitmentStatus(make({ checkins: 3, bitmap: 0b111 }), at(7 * DAY));
    expect(s.state).toBe("missed");
    expect(s.daysLeft).toBe(0);
    expect(s.stillPossible).toBe(false);
  });

  it("knows when the goal is no longer reachable", () => {
    // Day 4 of 7, 1 check-in, needs 5: only days 4,5,6 remain -> max 4.
    expect(commitmentStatus(make({ checkins: 1, bitmap: 0b1 }), at(4 * DAY)).stillPossible).toBe(false);
    // Day 2 of 7, 1 check-in: days 2..6 remain -> max 6.
    expect(commitmentStatus(make({ checkins: 1, bitmap: 0b1 }), at(2 * DAY)).stillPossible).toBe(true);
  });

  it("handles bits above 31 (up to 64-day periods)", () => {
    const c = make({ periodDays: 64, requiredCheckins: 64, deadline: new BN(T0 + 64 * DAY), checkinBitmap: new BN(1).shln(40) } as never);
    expect(commitmentStatus(c, at(40 * DAY + 1)).checkedInToday).toBe(true);
  });
});
