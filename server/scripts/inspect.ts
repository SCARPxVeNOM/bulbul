/**
 * Prints a wallet's bulbul profile, companion asset and recent transactions.
 *   tsx scripts/inspect.ts --rpc <url> --wallet <pubkey>
 */
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { parseArgs } from "node:util";
import idl from "../../idl/bulbul.json" with { type: "json" };
import type { Bulbul } from "../../idl/bulbul.js";

const { values } = parseArgs({ options: { rpc: { type: "string", default: "http://127.0.0.1:8899" }, wallet: { type: "string" } } });
if (!values.wallet) throw new Error("--wallet is required");

const connection = new Connection(values.rpc!, "confirmed");
const program = new Program<Bulbul>(idl as Bulbul, new AnchorProvider(connection, new Wallet(Keypair.generate()), {}));
const owner = new PublicKey(values.wallet);
const profilePda = PublicKey.findProgramAddressSync([Buffer.from("profile"), owner.toBuffer()], program.programId)[0];

const profile = await program.account.profile.fetchNullable(profilePda);
if (!profile) {
  console.log("no profile");
} else {
  console.log({
    profile: profilePda.toBase58(),
    region: String.fromCharCode(...profile.region),
    xp: profile.xp.toString(),
    companion: profile.companion.toBase58(),
    companionStage: Object.keys(profile.companionStage)[0],
    goals: `${profile.goalsCompleted}/${profile.goalsCreated} completed, ${profile.goalsBroken} broken`,
    commitments: `${profile.commitmentsSucceeded} kept, ${profile.commitmentsFailed} missed of ${profile.commitmentsCreated}`,
  });
  if (!profile.companion.equals(PublicKey.default)) {
    const asset = await connection.getAccountInfo(profile.companion);
    console.log("companion asset:", asset ? `${asset.data.length} bytes owned by ${asset.owner.toBase58()}` : "missing");
  }
}
for (const s of await connection.getSignaturesForAddress(owner, { limit: 5 })) {
  console.log(s.signature, s.err ? `FAILED ${JSON.stringify(s.err)}` : "ok");
}
