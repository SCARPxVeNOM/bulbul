import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { env } from "./env";

/** The subset of the mobile wallet API used to sign. */
export interface TxWallet {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAndSendTransaction(tx: Transaction, minContextSlot: number): Promise<string>;
}

export class TxError extends Error {
  constructor(
    message: string,
    readonly logs: string[] = [],
  ) {
    super(message);
  }
}

// Wallets report a cluster-side send failure (most often an expired blockhash) as
// "payloads invalid" (MWA error -2).
const EXPIRED = /Blockhash not found|block height exceeded|payloads invalid/i;
const WALLET_SESSION = /auth_token not valid|authorization failed|not authorized/i;
const NETWORK_ERROR =/fetch failed|Network request failed|UnknownHost|ENOTFOUND|ECONNREFUSED|timed? ?out|failed to get recent blockhash/i;

/**
 * Builds, signs (wallet + any extra keypairs, e.g. a new asset) and confirms one transaction.
 * In "wallet" mode the wallet submits (MWA best practice); in "app" mode the wallet only
 * signs and the app submits, which lets local development run against a localnet RPC.
 */
export async function sendInstructions(
  connection: Connection,
  wallet: TxWallet,
  instructions: TransactionInstruction[],
  extraSigners: Keypair[] = [],
): Promise<string> {
  try {
    return await sendInstructionsInner(connection, wallet, instructions, extraSigners);
  } catch (e) {
    if (!(e instanceof TxError) && e instanceof Error && NETWORK_ERROR.test(e.message)) {
      throw new TxError("Couldn’t reach the Solana network. Check your connection and try again.");
    }
    throw e;
  }
}

async function sendInstructionsInner(
  connection: Connection,
  wallet: TxWallet,
  instructions: TransactionInstruction[],
  extraSigners: Keypair[],
): Promise<string> {
  // Simulate first so program errors surface with logs before the wallet prompt.
  const forSim = await connection.getLatestBlockhash("confirmed");
  const simTx = new Transaction({ feePayer: wallet.publicKey, ...forSim }).add(...instructions);
  const sim = await connection.simulateTransaction(simTx);
  if (sim.value.err) {
    throw new TxError(explainProgramError(sim.value.logs ?? []), sim.value.logs ?? []);
  }

  // Fetch the blockhash only now, right before the wallet prompt: a blockhash lives
  // ~60 s and the wallet round trip eats into it. Extra signatures commit to it, so
  // they're applied after.
  const {
    context: { slot: minContextSlot },
    value: { blockhash, lastValidBlockHeight },
  } = await connection.getLatestBlockhashAndContext("confirmed");
  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(...instructions);
  if (extraSigners.length > 0) tx.partialSign(...extraSigners);

  let signature: string;
  try {
    if (env.txSubmit === "wallet") {
      signature = await wallet.signAndSendTransaction(tx, minContextSlot);
    } else {
      const signed = await wallet.signTransaction(tx);
      signature = await connection.sendRawTransaction(signed.serialize(), { minContextSlot });
    }
  } catch (e) {
    if (e instanceof Error && EXPIRED.test(e.message)) {
      throw new TxError("That took too long and the request expired. Please try again.");
    }
    if (e instanceof Error && WALLET_SESSION.test(e.message)) {
      throw new TxError("Your wallet session expired. Please try again to reconnect.");
    }
    throw e;
  }

  const err = await confirmByPolling(connection, signature, lastValidBlockHeight);
  if (err) {
    const meta = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    throw new TxError(explainProgramError(meta?.meta?.logMessages ?? []), meta?.meta?.logMessages ?? []);
  }
  return signature;
}

/**
 * Waits for "confirmed" over plain HTTP. web3.js' confirmTransaction subscribes over a
 * WebSocket, which is unreliable on mobile networks. Resolves to the transaction error
 * (null on success); throws once the blockhash has expired without the tx landing.
 */
export async function confirmByPolling(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  intervalMs = 1_000,
): Promise<unknown> {
  for (;;) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) return status.err;
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return null;
    if ((await connection.getBlockHeight("confirmed")) > lastValidBlockHeight) {
      throw new TxError("That took too long and the request expired. Please try again.");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Pulls the human-readable Anchor error message out of program logs. */
export function explainProgramError(logs: string[]): string {
  for (const line of logs) {
    const m = /Error Message: (.+?)\.?$/.exec(line);
    if (m?.[1]) return m[1];
  }
  if (logs.some((l) => l.includes("insufficient funds") || l.includes("insufficient lamports"))) {
    return "Not enough balance for this transaction";
  }
  return "The transaction failed. Please try again.";
}
