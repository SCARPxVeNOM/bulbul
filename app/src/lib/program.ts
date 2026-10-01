import { Program } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import idlJson from "@idl/bulbul.json";
import type { Bulbul } from "@idl/bulbul";

export const idl = idlJson as Bulbul;
export const PROGRAM_ID = new PublicKey(idl.address);
export const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

export type BulbulProgram = Program<Bulbul>;

/** Read + instruction-building client; signing goes through the mobile wallet. */
export function makeProgram(connection: Connection): BulbulProgram {
  return new Program<Bulbul>(idl, { connection });
}

const enc = (s: string) => Buffer.from(s);
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const find = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const pdas = {
  config: () => find(enc("config")),
  pool: () => find(enc("pool")),
  companionAuth: () => find(enc("companion_auth")),
  profile: (owner: PublicKey) => find(enc("profile"), owner.toBuffer()),
  goal: (owner: PublicKey, id: number) => find(enc("goal"), owner.toBuffer(), u32(id)),
  goalVault: (goal: PublicKey) => find(enc("goal_vault"), goal.toBuffer()),
  commitment: (owner: PublicKey, id: number) => find(enc("commitment"), owner.toBuffer(), u32(id)),
  escrow: (commitment: PublicKey) => find(enc("escrow"), commitment.toBuffer()),
};
