import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import { createAccount, createMint, getAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { beforeAll, describe, expect, inject, it } from "vitest";
import idl from "../../../idl/bulbul.json" with { type: "json" };
import type { Bulbul } from "../../../idl/bulbul.js";
import { SolanaChain, loadKeypair } from "../../src/chain.js";
import { openDb } from "../../src/db.js";
import { FocusService } from "../../src/focus.js";
import { Clock, focusFor, type Harness } from "../helpers.js";

const USDC = 1_000_000;
const BPF_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

const programId = new PublicKey(idl.address);
const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

let connection: Connection;
let admin: Keypair;
let attestor: Keypair;
let usdcMint: PublicKey;
let charity: PublicKey;

function programFor(kp: Keypair) {
  return new Program<Bulbul>(idl as Bulbul, new AnchorProvider(connection, new Wallet(kp), { commitment: "confirmed" }));
}

async function fund(to: PublicKey, sol: number) {
  const sig = await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

async function newUser(usdc: number) {
  const kp = Keypair.generate();
  await fund(kp.publicKey, 5);
  const token = await createAccount(connection, admin, usdcMint, kp.publicKey);
  await mintTo(connection, admin, usdcMint, token, admin, usdc * USDC);
  await programFor(kp)
    .methods.initProfile([...Buffer.from("US")])
    .accountsStrict({
      owner: kp.publicKey,
      profile: pda(Buffer.from("profile"), kp.publicKey.toBuffer()),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  return { kp, token };
}

async function newCommitment(user: { kp: Keypair; token: PublicKey }, focusMinutes: number, required: number, days: number) {
  const program = programFor(user.kp);
  const profilePda = pda(Buffer.from("profile"), user.kp.publicKey.toBuffer());
  const { commitmentsCreated } = await program.account.profile.fetch(profilePda);
  const commitment = pda(Buffer.from("commitment"), user.kp.publicKey.toBuffer(), u32(commitmentsCreated));
  await program.methods
    .createCommitment(new BN(10 * USDC), focusMinutes, required, days, { charity: {} })
    .accountsStrict({
      owner: user.kp.publicKey,
      config: pda(Buffer.from("config")),
      profile: profilePda,
      commitment,
      escrow: pda(Buffer.from("escrow"), commitment.toBuffer()),
      ownerTokenAccount: user.token,
      usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  return commitment;
}

function focusHarness(signer: Keypair): Harness {
  const db = openDb(":memory:");
  const clock = new Clock(Date.now());
  const chain = new SolanaChain(connection, signer);
  const focus = new FocusService(db, chain, { heartbeatIntervalSeconds: 30, heartbeatGraceSeconds: 90 }, clock.now);
  return { db, clock, chain: chain as never, auth: undefined as never, focus };
}

beforeAll(async () => {
  connection = new Connection(inject("rpcUrl"), "confirmed");
  admin = loadKeypair(inject("adminKeypairPath"));
  attestor = Keypair.generate();
  await fund(attestor.publicKey, 2);

  usdcMint = await createMint(connection, admin, admin.publicKey, null, 6);
  charity = await createAccount(connection, admin, usdcMint, Keypair.generate().publicKey);

  await programFor(admin)
    .methods.initializeConfig({
      attestor: attestor.publicKey,
      restrictedRegions: [[...Buffer.from("IN")]],
      companionUriBase: "https://api.bulbul.test/companion",
    })
    .accountsStrict({
      admin: admin.publicKey,
      config: pda(Buffer.from("config")),
      usdcMint,
      poolVault: pda(Buffer.from("pool")),
      charityTokenAccount: charity,
      program: programId,
      programData: PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_UPGRADEABLE)[0],
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
});

describe("attestor against a real validator", () => {
  it("a qualifying focus session writes a check-in on-chain", async () => {
    const user = await newUser(50);
    const commitment = await newCommitment(user, 5, 1, 3);
    const h = focusHarness(attestor);
    const wallet = user.kp.publicKey.toBase58();

    const session = await h.focus.start(wallet, commitment.toBase58());
    expect(session.day_index).toBe(0);
    expect(session.focus_minutes).toBe(5);
    focusFor(h, wallet, session.id, 300);
    const done = await h.focus.finish(wallet, session.id);
    expect(done.error).toBeNull();
    expect(done.status).toBe("attested");

    const onChain = await programFor(user.kp).account.commitment.fetch(commitment);
    expect(onChain.checkins).toBe(1);
    expect(onChain.checkinBitmap.toNumber()).toBe(1);

    // The server now reads today's bit from chain and refuses a second session.
    await expect(h.focus.start(wallet, commitment.toBase58())).rejects.toThrow(/already/);
  });

  it("a key that is not the configured attestor is rejected by the program", async () => {
    const user = await newUser(50);
    const commitment = await newCommitment(user, 5, 1, 3);
    const impostor = Keypair.generate();
    await fund(impostor.publicKey, 1);
    const h = focusHarness(impostor);
    const wallet = user.kp.publicKey.toBase58();

    const session = await h.focus.start(wallet, commitment.toBase58());
    focusFor(h, wallet, session.id, 300);
    const done = await h.focus.finish(wallet, session.id);
    expect(done.status).toBe("attest_failed");
    expect(done.error).toMatch(/NotAttestor|6002/);
    expect((await programFor(user.kp).account.commitment.fetch(commitment)).checkins).toBe(0);
  });

  it("the attested streak settles and refunds the stake", async () => {
    const user = await newUser(50);
    const commitment = await newCommitment(user, 5, 1, 3);
    const h = focusHarness(attestor);
    const wallet = user.kp.publicKey.toBase58();
    const session = await h.focus.start(wallet, commitment.toBase58());
    focusFor(h, wallet, session.id, 300);
    expect((await h.focus.finish(wallet, session.id)).status).toBe("attested");

    await programFor(user.kp)
      .methods.settleCommitment()
      .accountsStrict({
        settler: user.kp.publicKey,
        owner: user.kp.publicKey,
        config: pda(Buffer.from("config")),
        profile: pda(Buffer.from("profile"), user.kp.publicKey.toBuffer()),
        commitment,
        escrow: pda(Buffer.from("escrow"), commitment.toBuffer()),
        ownerTokenAccount: user.token,
        charityTokenAccount: charity,
        poolVault: pda(Buffer.from("pool")),
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    expect(Number((await getAccount(connection, user.token)).amount)).toBe(50 * USDC);
    const profile = await programFor(user.kp).account.profile.fetch(
      pda(Buffer.from("profile"), user.kp.publicKey.toBuffer()),
    );
    expect(profile.commitmentsSucceeded).toBe(1);
    expect(profile.xp.toNumber()).toBe(30);
  });
});
