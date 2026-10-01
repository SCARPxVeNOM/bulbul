import { nextStage, STAGES, stageForXp, stageFromEnum } from "../stages";

describe("stages", () => {
  it("matches the program's thresholds", () => {
    expect(STAGES.map((s) => s.minXp)).toEqual([0, 100, 500, 2000]);
  });

  it("stageForXp picks the highest reached stage", () => {
    expect(stageForXp(0).key).toBe("curious");
    expect(stageForXp(99).key).toBe("curious");
    expect(stageForXp(100).key).toBe("focused");
    expect(stageForXp(1999).key).toBe("evolving");
    expect(stageForXp(10_000).key).toBe("legendary");
  });

  it("decodes Anchor enum objects", () => {
    expect(stageFromEnum({ evolving: {} }).name).toBe("Evolving");
    expect(stageFromEnum({ unknown: {} }).key).toBe("curious");
  });

  it("nextStage reports remaining XP and progress", () => {
    expect(nextStage(250)).toEqual({ stage: STAGES[2], remaining: 250, progress: 0.375 });
    expect(nextStage(0)?.stage.key).toBe("focused");
    expect(nextStage(2000)).toBeNull();
  });
});
