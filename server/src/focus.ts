import { randomUUID } from "node:crypto";
import type { Chain } from "./chain.js";
import type { Db, FocusSession } from "./db.js";

const SECONDS_PER_DAY = 86_400;

export class FocusError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export interface FocusSettings {
  heartbeatIntervalSeconds: number;
  heartbeatGraceSeconds: number;
}

export interface SessionView extends FocusSession {
  required_seconds: number;
  elapsed_seconds: number;
  heartbeat_interval_seconds: number;
}

/**
 * Focus check-ins. All timing uses the server clock: the client only proves it
 * stayed in the app by sending heartbeats. A gap longer than the grace window
 * breaks the session ("you left focus").
 */
export class FocusService {
  constructor(
    private readonly db: Db,
    private readonly chain: Chain,
    private readonly settings: FocusSettings,
    private readonly nowMs: () => number,
  ) {}

  private nowSec(): number {
    return Math.floor(this.nowMs() / 1000);
  }

  private get(id: string): FocusSession {
    const row = this.db.prepare("SELECT * FROM focus_sessions WHERE id = ?").get(id) as FocusSession | undefined;
    if (!row) throw new FocusError("session not found", 404);
    return row;
  }

  private owned(id: string, wallet: string): FocusSession {
    const s = this.get(id);
    if (s.wallet !== wallet) throw new FocusError("session not found", 404);
    return s;
  }

  private setStatus(id: string, status: FocusSession["status"], fields: Partial<FocusSession> = {}): FocusSession {
    const s = { ...this.get(id), ...fields, status };
    this.db
      .prepare(
        `UPDATE focus_sessions SET status = ?, last_heartbeat = ?, ended_at = ?, tx_signature = ?, error = ? WHERE id = ?`,
      )
      .run(s.status, s.last_heartbeat, s.ended_at, s.tx_signature, s.error, id);
    return s;
  }

  view(s: FocusSession): SessionView {
    const end = s.status === "active" ? s.last_heartbeat : (s.ended_at ?? s.last_heartbeat);
    return {
      ...s,
      required_seconds: s.focus_minutes * 60,
      elapsed_seconds: Math.max(0, end - s.started_at),
      heartbeat_interval_seconds: this.settings.heartbeatIntervalSeconds,
    };
  }

  /** The wallet's live session, expiring it first if heartbeats stopped (e.g. the app crashed). */
  active(wallet: string): SessionView | null {
    const s = this.db
      .prepare("SELECT * FROM focus_sessions WHERE wallet = ? AND status = 'active'")
      .get(wallet) as FocusSession | undefined;
    if (!s) return null;
    const checked = this.expireIfStale(s);
    return checked.status === "active" ? this.view(checked) : null;
  }

  private expireIfStale(s: FocusSession): FocusSession {
    if (this.nowSec() - s.last_heartbeat <= this.settings.heartbeatGraceSeconds) return s;
    return this.setStatus(s.id, "broken", {
      ended_at: s.last_heartbeat,
      error: "focus interrupted: the app was closed or backgrounded",
    });
  }

  async start(wallet: string, commitment: string): Promise<SessionView> {
    const c = await this.chain.getCommitment(commitment);
    if (!c) throw new FocusError("commitment not found on-chain", 404);
    if (c.owner !== wallet) throw new FocusError("this commitment belongs to another wallet", 403);
    const now = this.nowSec();
    if (now >= c.deadline) throw new FocusError("commitment deadline has passed", 409);
    if (c.checkins >= c.requiredCheckins) throw new FocusError("commitment already complete; settle it", 409);
    const dayIndex = Math.floor((now - c.createdAt) / SECONDS_PER_DAY);
    if (dayIndex < 0 || dayIndex >= c.periodDays) throw new FocusError("outside the commitment period", 409);
    if ((c.checkinBitmap >> BigInt(dayIndex)) & 1n) throw new FocusError("today is already checked in", 409);
    if (this.active(wallet)) throw new FocusError("finish or cancel your current focus session first", 409);

    const session: FocusSession = {
      id: randomUUID(),
      wallet,
      commitment,
      day_index: dayIndex,
      focus_minutes: c.focusMinutes,
      started_at: now,
      last_heartbeat: now,
      ended_at: null,
      status: "active",
      tx_signature: null,
      error: null,
    };
    this.db
      .prepare(
        `INSERT INTO focus_sessions (id, wallet, commitment, day_index, focus_minutes, started_at, last_heartbeat, ended_at, status, tx_signature, error)
         VALUES (@id, @wallet, @commitment, @day_index, @focus_minutes, @started_at, @last_heartbeat, @ended_at, @status, @tx_signature, @error)`,
      )
      .run(session);
    return this.view(session);
  }

  private activeOwned(id: string, wallet: string): FocusSession {
    const s = this.owned(id, wallet);
    if (s.status !== "active") throw new FocusError(`session is ${s.status}`, 409);
    return s;
  }

  /** Records a heartbeat, or breaks the session if the app went quiet too long. */
  private touch(s: FocusSession): FocusSession {
    const checked = this.expireIfStale(s);
    if (checked.status !== "active") return checked;
    return this.setStatus(s.id, "active", { last_heartbeat: this.nowSec() });
  }

  heartbeat(wallet: string, id: string): SessionView {
    return this.view(this.touch(this.activeOwned(id, wallet)));
  }

  async finish(wallet: string, id: string): Promise<SessionView> {
    const live = this.view(this.touch(this.activeOwned(id, wallet)));
    if (live.status === "broken") return live;
    const now = live.last_heartbeat;
    if (live.elapsed_seconds < live.required_seconds) {
      return this.view(this.setStatus(id, "too_short", { ended_at: now }));
    }
    this.setStatus(id, "attest_failed", { ended_at: now, error: "attestation pending" });
    return this.submitAttestation(id);
  }

  /** Retry after an RPC failure. The program itself rejects double check-ins. */
  async retryAttestation(wallet: string, id: string): Promise<SessionView> {
    const s = this.owned(id, wallet);
    if (s.status !== "attest_failed") throw new FocusError(`session is ${s.status}`, 409);
    return this.submitAttestation(id);
  }

  cancel(wallet: string, id: string): SessionView {
    this.activeOwned(id, wallet);
    return this.view(this.setStatus(id, "cancelled", { ended_at: this.nowSec() }));
  }

  private async submitAttestation(id: string): Promise<SessionView> {
    const s = this.get(id);
    try {
      const sig = await this.chain.attest(s.commitment, s.day_index);
      return this.view(this.setStatus(id, "attested", { tx_signature: sig, error: null }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return this.view(this.setStatus(id, "attest_failed", { error: message.slice(0, 500) }));
    }
  }
}
