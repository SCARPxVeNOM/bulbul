import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import idl from "../../idl/bulbul.json" with { type: "json" };
import type { Bulbul } from "../../idl/bulbul.js";

export interface CommitmentView {
  owner: string;
  createdAt: number;
  deadline: number;
  periodDays: number;
  focusMinutes: number;
  requiredCheckins: number;
  checkins: number;
  checkinBitmap: bigint;
}

/** The on-chain surface the attestor needs. */
export interface Chain {
  readonly attestor: string;
  getCommitment(address: string): Promise<CommitmentView | null>;
  attest(commitment: string, dayIndex: number): Promise<string>;
  attestorBalanceLamports(): Promise<number>;
}

export function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(raw) || raw.length !== 64) throw new Error(`${path} is not a 64-byte keypair file`);
  return Keypair.fromSecretKey(Uint8Array.from(raw as number[]));
}

export class SolanaChain implements Chain {
  private readonly program: Program<Bulbul>;
  private readonly configPda: PublicKey;
  readonly attestor: string;

  constructor(
    private readonly connection: Connection,
    private readonly signer: Keypair,
  ) {
    const provider = new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" });
    this.program = new Program<Bulbul>(idl as Bulbul, provider);
    this.configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], this.program.programId)[0];
    this.attestor = signer.publicKey.toBase58();
  }

  async getCommitment(address: string): Promise<CommitmentView | null> {
    let pk: PublicKey;
    try {
      pk = new PublicKey(address);
    } catch {
      return null;
    }
    const c = await this.program.account.commitment.fetchNullable(pk);
    if (!c) return null;
    return {
      owner: c.owner.toBase58(),
      createdAt: c.createdAt.toNumber(),
      deadline: c.deadline.toNumber(),
      periodDays: c.periodDays,
      focusMinutes: c.focusMinutes,
      requiredCheckins: c.requiredCheckins,
      checkins: c.checkins,
      checkinBitmap: BigInt(c.checkinBitmap.toString()),
    };
  }

  async attest(commitment: string, dayIndex: number): Promise<string> {
    return this.program.methods
      .attestCheckin(dayIndex)
      .accountsStrict({
        attestor: this.signer.publicKey,
        config: this.configPda,
        commitment: new PublicKey(commitment),
      })
      .rpc();
  }

  attestorBalanceLamports(): Promise<number> {
    return this.connection.getBalance(this.signer.publicKey);
  }
}
