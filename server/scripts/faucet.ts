/**
 * Localnet only: airdrops SOL and mints test USDC to a wallet.
 *
 *   tsx scripts/faucet.ts --rpc http://127.0.0.1:8899 --admin <mint-authority.json> --to <wallet> [--usdc 500] [--sol 5]
 */
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { parseArgs } from "node:util";
import idl from "../../idl/bulbul.json" with { type: "json" };
import { loadKeypair } from "../src/chain.js";

const { values } = parseArgs({
  options: {
    rpc: { type: "string", default: "http://127.0.0.1:8899" },
    admin: { type: "string" },
    to: { type: "string" },
    usdc: { type: "string", default: "500" },
    sol: { type: "string", default: "5" },
  },
});

const rpc = values.rpc!;
if (!/127\.0\.0\.1|localhost/.test(rpc)) throw new Error("faucet only runs against localnet");
if (!values.admin || !values.to) throw new Error("--admin and --to are required");

const connection = new Connection(rpc, "confirmed");
const admin = loadKeypair(values.admin);
const to = new PublicKey(values.to);

const configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], new PublicKey(idl.address))[0];
const configInfo = await connection.getAccountInfo(configPda);
if (!configInfo) throw new Error("config not initialized; run bootstrap first");
// Config layout: 8 discriminator, admin(32), attestor(32), usdc_mint(32)...
const usdcMint = new PublicKey(configInfo.data.subarray(8 + 64, 8 + 96));

const sig = await connection.requestAirdrop(to, Number(values.sol) * LAMPORTS_PER_SOL);
await connection.confirmTransaction(sig, "confirmed");
const ata = await getOrCreateAssociatedTokenAccount(connection, admin, usdcMint, to);
await mintTo(connection, admin, usdcMint, ata.address, admin, BigInt(Math.round(Number(values.usdc) * 1e6)));
console.log(`Sent ${values.sol} SOL and ${values.usdc} test USDC to ${to.toBase58()} (token account ${ata.address.toBase58()})`);
