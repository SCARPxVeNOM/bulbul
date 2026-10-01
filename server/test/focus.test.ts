import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { FocusError } from "../src/focus.js";
import { DAY, focusFor, harness } from "./helpers.js";

const wallet = () => Keypair.generate().publicKey.toBase58();

describe("focus sessions", () => {
  it("a full continuous session is attested on-chain for today", async () => {
    const h = harness();
    const w = wallet();
    const c = h.chain.add(w, { focusMinutes: 120 });
    const s = await h.focus.start(w, c);
    expect(s.status).toBe("active");
    expect(s.day_index).toBe(0);
    expect(s.required_seconds).toBe(7200);

    focusFor(h, w, s.id, 7200);
    const done = await h.focus.finish(w, s.id);
    expect(done.status).toBe("attested");
    expect(done.tx_signature).toBe("sig-1");
    expect(done.elapsed_seconds).toBe(7200);
    expect(h.chain.attested).toEqual([{ commitment: c, day: 0 }]);
  });

  it("uses the day index relative to commitment creation", async () => {
    const h = harness();
    const w = wallet();
    const c = h.chain.add(w, { focusMinutes: 5 });
    h.clock.advanceSec(3 * DAY + 100);
    const s = await h.focus.start(w, c);
    expect(s.day_index).toBe(3);
    focusFor(h, w, s.id, 300);
    await h.focus.finish(w, s.id);
    expect(h.chain.attested[0]!.day).toBe(3);
  });

  it("finishing early records too_short and attests nothing", async () => {
    const h = harness();
    const w = wallet();
    const c = h.chain.add(w, { focusMinutes: 60 });
    const s = await h.focus.start(w, c);
    focusFor(h, w, s.id, 3599);
    const done = await h.focus.finish(w, s.id);
    expect(done.status).toBe("too_short");
    expect(h.chain.attested).toHaveLength(0);
  });

  it("leaving the app longer than the grace window breaks focus", async () => {
    const h = harness();
    const w = wallet();
    const c = h.chain.add(w, { focusMinutes: 5 });
    const s = await h.focus.start(w, c);
    focusFor(h, w, s.id, 120);
    h.clock.advanceSec(91);
    const hb = h.focus.heartbeat(w, s.id);
    expect(hb.status).toBe("broken");
    expect(hb.elapsed_seconds).toBe(120);
    await expect(h.focus.finish(w, s.id)).rejects.toThrow(/broken/);
    expect(h.chain.attested).toHaveLength(0);
  });

  it("a gap at the grace limit is still fine", async () => {
    const h = harness();
    const w = wallet();
    const c = h.chain.add(w, { focusMinutes: 5 });
    const s = await h.focus.start(w, c);
    h.clock.advanceSec(90);
    expect(h.focus.heartbeat(w, s.id).status).toBe("active");
  });

  it("finish after a long silence returns broken, not attested", async () => {
    const h = harness();
    const w = wallet();
    const c = h.chain.add(w, { focusMinutes: 5 });
    const s = await h.focus.start(w, c);
    h.clock.advanceSec(600);
    const done = await h.focus.finish(w, s.id);
    expect(done.status).toBe("broken");
    expect(h.chain.attested).toHaveLength(0);
  });

  it("an RPC failure can be retried", async () => {
    const h = harness();
    const w = wallet();
    const c = h.chain.add(w, { focusMinutes: 5 });
    const s = await h.focus.start(w, c);
    focusFor(h, w, s.id, 300);
    h.chain.failNext = "blockhash not found";
    const failed = await h.focus.finish(w, s.id);
    expect(failed.status).toBe("attest_failed");
    expect(failed.error).toContain("blockhash");
    const retried = await h.focus.retryAttestation(w, s.id);
    expect(retried.status).toBe("attested");
    expect(h.chain.attested).toHaveLength(1);
  });

  it("rejects sessions for commitments it can't attest", async () => {
    const h = harness();
    const w = wallet();
    const missing = Keypair.generate().publicKey.toBase58();
    await expect(h.focus.start(w, missing)).rejects.toMatchObject({ status: 404 });

    const others = h.chain.add(wallet());
    await expect(h.focus.start(w, others)).rejects.toMatchObject({ status: 403 });

    const expired = h.chain.add(w, { deadline: h.clock.sec });
    await expect(h.focus.start(w, expired)).rejects.toThrow(/deadline/);

    const complete = h.chain.add(w, { requiredCheckins: 2, checkins: 2 });
    await expect(h.focus.start(w, complete)).rejects.toThrow(/already complete/);

    const doneToday = h.chain.add(w, { checkinBitmap: 1n, checkins: 1 });
    await expect(h.focus.start(w, doneToday)).rejects.toThrow(/already checked in/);
  });

  it("allows one live session per wallet", async () => {
    const h = harness();
    const w = wallet();
    const a = h.chain.add(w);
    const b = h.chain.add(w);
    await h.focus.start(w, a);
    await expect(h.focus.start(w, b)).rejects.toThrow(/current focus session/);
  });

  it("a crashed session expires so a new one can start", async () => {
    const h = harness();
    const w = wallet();
    const a = h.chain.add(w);
    const first = await h.focus.start(w, a);
    h.clock.advanceSec(91);
    expect(h.focus.active(w)).toBeNull();
    const second = await h.focus.start(w, a);
    expect(second.id).not.toBe(first.id);
  });

  it("cancel ends the session", async () => {
    const h = harness();
    const w = wallet();
    const s = await h.focus.start(w, h.chain.add(w));
    expect(h.focus.cancel(w, s.id).status).toBe("cancelled");
    expect(h.focus.active(w)).toBeNull();
    expect(() => h.focus.heartbeat(w, s.id)).toThrow(FocusError);
  });

  it("another wallet can't touch your session", async () => {
    const h = harness();
    const w = wallet();
    const s = await h.focus.start(w, h.chain.add(w));
    const intruder = wallet();
    expect(() => h.focus.heartbeat(intruder, s.id)).toThrow(/not found/);
    expect(() => h.focus.cancel(intruder, s.id)).toThrow(/not found/);
    await expect(h.focus.finish(intruder, s.id)).rejects.toThrow(/not found/);
  });
});
