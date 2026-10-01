import { big, formatDuration, formatUntil, formatUsdc, parseUsdc, percent, shortAddress } from "../format";

describe("parseUsdc", () => {
  it("parses whole and fractional amounts to base units", () => {
    expect(parseUsdc("12")).toBe(12_000_000n);
    expect(parseUsdc("12.5")).toBe(12_500_000n);
    expect(parseUsdc("0.000001")).toBe(1n);
    expect(parseUsdc(" 3.14 ")).toBe(3_140_000n);
    expect(parseUsdc("7.")).toBe(7_000_000n);
  });

  it("rejects anything that isn't a clean non-negative amount", () => {
    for (const bad of ["", "-1", "1.0000001", "1e6", "abc", "1,000", ".5", "1.2.3"]) {
      expect(parseUsdc(bad)).toBeNull();
    }
  });
});

describe("formatUsdc", () => {
  it("formats with grouping and 2 decimals by default", () => {
    expect(formatUsdc(1_234_567_890n)).toBe("1,234.56");
    expect(formatUsdc(0n)).toBe("0.00");
    expect(formatUsdc(5n)).toBe("0.00");
  });

  it("supports custom decimals and number input", () => {
    expect(formatUsdc(1_500_000n, { decimals: 0 })).toBe("1");
    expect(formatUsdc(1_500_000n, { decimals: 6 })).toBe("1.500000");
    expect(formatUsdc(2_000_000)).toBe("2.00");
  });

  it("round-trips with parseUsdc", () => {
    expect(formatUsdc(parseUsdc("1700.25")!)).toBe("1,700.25");
  });
});

describe("percent", () => {
  it("computes and clamps", () => {
    expect(percent(50n, 200n)).toBe(25);
    expect(percent(300n, 200n)).toBe(100);
    expect(percent(1n, 0n)).toBe(0);
    expect(percent(1n, 3n)).toBeCloseTo(33.33, 2);
  });
});

describe("misc", () => {
  it("formatDuration", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(8100)).toBe("02:15:00");
    expect(formatDuration(-5)).toBe("00:00:00");
  });

  it("formatUntil rounds to the nearest unit", () => {
    const now = 1_800_000_000_000;
    const t = now / 1000;
    expect(formatUntil(t + 30 * 86_400 + 60, now)).toBe("30 days");
    expect(formatUntil(t + 30 * 86_400 - 120, now)).toBe("30 days");
    expect(formatUntil(t + 86_400, now)).toBe("1 day");
    expect(formatUntil(t + 23.8 * 3_600, now)).toBe("1 day");
    expect(formatUntil(t + 5 * 3_600 + 59, now)).toBe("5 hours");
    expect(formatUntil(t + 59 * 60 + 50, now)).toBe("1 hour");
    expect(formatUntil(t + 90, now)).toBe("2 minutes");
    expect(formatUntil(t + 5, now)).toBe("1 minute");
  });

  it("big converts BN-like values", () => {
    expect(big({ toString: () => "18446744073709551615" })).toBe(18446744073709551615n);
  });

  it("shortAddress", () => {
    expect(shortAddress("5c7PXFMxkMc3kKsNHoafJb3phNhZoz6jt5qm57heRpGF")).toBe("5c7P…RpGF");
  });
});
