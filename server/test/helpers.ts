import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { Auth } from "../src/auth.js";
import type { Chain, CommitmentView } from "../src/chain.js";
import { openDb, type Db } from "../src/db.js";
import { FocusService } from "../src/focus.js";

export const T0 = 1_800_000_000_000;
export const DAY = 86_400;

export class Clock {
  constructor(public ms = T0) {}
  now = () => this.ms;
  advanceSec(s: number) {
    this.ms += s * 1000;
  }
  get sec() {
    return Math.floor(this.ms / 1000);
  }
}

/** In-memory stand-in for the program, enforcing the same check-in rules. */
export class FakeChain implements Chain {
  readonly attestor = Keypair.generate().publicKey.toBase58();
  commitments = new Map<string, CommitmentView>();
  attested: { commitment: string; day: number }[] = [];
  failNext: string | null = null;

  constructor(private readonly clock: Clock) {}

  add(owner: string, overrides: Partial<CommitmentView> = {}): string {
    const address = Keypair.generate().publicKey.toBase58();
    this.commitments.set(address, {
      owner,
      createdAt: this.clock.sec,
      deadline: this.clock.sec + 7 * DAY,
      periodDays: 7,
      focusMinutes: 120,
      requiredCheckins: 5,
      checkins: 0,
      checkinBitmap: 0n,
      ...overrides,
    });
    return address;
  }

  async getCommitment(address: string) {
    return this.commitments.get(address) ?? null;
  }

  async attest(commitment: string, day: number) {
    if (this.failNext) {
      const msg = this.failNext;
      this.failNext = null;
      throw new Error(msg);
    }
    const c = this.commitments.get(commitment)!;
    const bit = 1n << BigInt(day);
    if (c.checkinBitmap & bit) throw new Error("AlreadyCheckedIn");
    c.checkinBitmap |= bit;
    c.checkins += 1;
    this.attested.push({ commitment, day });
    return `sig-${this.attested.length}`;
  }

  async attestorBalanceLamports() {
    return 2_500_000_000;
  }
}

export interface Harness {
  db: Db;
  clock: Clock;
  chain: FakeChain;
  auth: Auth;
  focus: FocusService;
}

export function harness(): Harness {
  const db = openDb(":memory:");
  const clock = new Clock();
  const chain = new FakeChain(clock);
  const auth = new Auth(db, "x".repeat(32), "bulbul.test", clock.now);
  const focus = new FocusService(db, chain, { heartbeatIntervalSeconds: 30, heartbeatGraceSeconds: 90 }, clock.now);
  return { db, clock, chain, auth, focus };
}

export function signMessage(kp: Keypair, message: string): string {
  return bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));
}

/** Runs a session with heartbeats every 30s for `seconds`. */
export function focusFor(h: Harness, wallet: string, id: string, seconds: number) {
  for (let t = 0; t < seconds; t += 30) {
    h.clock.advanceSec(Math.min(30, seconds - t));
    h.focus.heartbeat(wallet, id);
  }
}
