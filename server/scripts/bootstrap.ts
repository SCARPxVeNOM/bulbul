/**
 * Initializes bulbul's on-chain config. Idempotent: prints the existing config if present.
 *
 *   tsx scripts/bootstrap.ts --rpc <url> --admin <keypair.json> --attestor <pubkey>
 *       --uri-base <https://host/companion> [--usdc-mint <pubkey>] [--charity-owner <pubkey>]
 *       [--restricted IN,PK] [--out <file.json>]
 *
 * Without --usdc-mint (localnet only) a test USDC mint is created with the admin as mint authority.
 */
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { createMint, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import idl from "../../idl/bulbul.json" with { type: "json" };
import type { Bulbul } from "../../idl/bulbul.js";
import { loadKeypair } from "../src/chain.js";

const { values } = parseArgs({
  options: {
    rpc: { type: "string" },
    admin: { type: "string" },
    attestor: { type: "string" },
    "uri-base": { type: "string" },
    "usdc-mint": { type: "string" },
    "charity-owner": { type: "string" },
    restricted: { type: "string", default: "IN" },
    out: { type: "string" },
  },
});

function need(name: keyof typeof values): string {
  const v = values[name];
  if (typeof v !== "string" || !v) throw new Error(`--${name} is required`);
  return v;
}

const rpc = need("rpc");
const admin = loadKeypair(need("admin"));
const attestor = new PublicKey(need("attestor"));
const uriBase = need("uri-base").replace(/\/+$/, "");
const restricted = (values.restricted ?? "")
  .split(",")
  .map((r) => r.trim().toUpperCase())
  .filter(Boolean);

const connection = new Connection(rpc, "confirmed");
const program = new Program<Bulbul>(idl as Bulbul, new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" }));
const configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0];
const poolPda = PublicKey.findProgramAddressSync([Buffer.from("pool")], program.programId)[0];
const programData = PublicKey.findProgramAddressSync(
  [program.programId.toBuffer()],
  new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
)[0];

const existing = await program.account.config.fetchNullable(configPda);
if (existing) {
  console.log("Config already initialized.");
} else {
  const isLocal = /127\.0\.0\.1|localhost/.test(rpc);
  let usdcMint: PublicKey;
  if (values["usdc-mint"]) {
    usdcMint = new PublicKey(values["usdc-mint"]);
  } else if (isLocal) {
    usdcMint = await createMint(connection, admin, admin.publicKey, null, 6);
    console.log(`Created localnet test USDC mint ${usdcMint.toBase58()}`);
  } else {
    throw new Error("--usdc-mint is required off localnet (devnet USDC: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU)");
  }
  const charityOwner = new PublicKey(values["charity-owner"] ?? admin.publicKey.toBase58());
  const charity = await getOrCreateAssociatedTokenAccount(connection, admin, usdcMint, charityOwner, true);

  await program.methods
    .initializeConfig({
      attestor,
      restrictedRegions: restricted.map((r) => [...Buffer.from(r)]),
      companionUriBase: uriBase,
    })
    .accountsStrict({
      admin: admin.publicKey,
      config: configPda,
      usdcMint,
      poolVault: poolPda,
      charityTokenAccount: charity.address,
      program: program.programId,
      programData,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("Config initialized.");
}

const config = await program.account.config.fetch(configPda);
const summary = {
  programId: program.programId.toBase58(),
  config: configPda.toBase58(),
  admin: config.admin.toBase58(),
  attestor: config.attestor.toBase58(),
  usdcMint: config.usdcMint.toBase58(),
  charityTokenAccount: config.charityTokenAccount.toBase58(),
  poolVault: config.poolVault.toBase58(),
  restrictedRegions: config.restrictedRegions.map((r) => String.fromCharCode(...r)),
  companionUriBase: config.companionUriBase,
};
console.log(JSON.stringify(summary, null, 2));
if (values.out) writeFileSync(values.out, JSON.stringify(summary, null, 2));
