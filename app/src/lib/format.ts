export const USDC_DECIMALS = 6;

/** Anchor BN (or anything with a decimal toString) to bigint. */
export const big = (n: { toString(): string }): bigint => BigInt(n.toString());
const UNIT = 10n ** BigInt(USDC_DECIMALS);

/** "12.5" -> 12_500_000n. Returns null for anything that isn't a clean non-negative amount. */
export function parseUsdc(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(s)) return null;
  const [whole = "0", frac = ""] = s.split(".");
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

export function formatUsdc(base: bigint | number, opts: { decimals?: number } = {}): string {
  const v = typeof base === "bigint" ? base : BigInt(Math.trunc(base));
  const whole = v / UNIT;
  const frac = v % UNIT;
  const decimals = opts.decimals ?? 2;
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, decimals);
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals > 0 ? `${wholeStr}.${fracStr}` : wholeStr;
}

export function percent(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  const p = Number((part * 10_000n) / total) / 100;
  return Math.min(100, Math.max(0, p));
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "30 days", "5 hours", "12 minutes": rounded to the nearest whole unit, as people read durations. */
export function formatUntil(unixSeconds: number, nowMs: number): string {
  const secs = Math.max(0, unixSeconds - nowMs / 1000);
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (secs >= 86_400 - 1_800) return unit(Math.round(secs / 86_400), "day");
  if (secs >= 3_600 - 30) return unit(Math.round(secs / 3_600), "hour");
  return unit(Math.max(1, Math.round(secs / 60)), "minute");
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
