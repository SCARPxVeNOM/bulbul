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
  const {
    context: { slot: minContextSlot },
    value: { blockhash, lastValidBlockHeight },
  } = await connection.getLatestBlockhashAndContext("confirmed");

  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(...instructions);
  if (extraSigners.length > 0) tx.partialSign(...extraSigners);

  // Simulate first so program errors surface with logs before the wallet prompt.
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    throw new TxError(explainProgramError(sim.value.logs ?? []), sim.value.logs ?? []);
  }

  let signature: string;
  if (env.txSubmit === "wallet") {
    signature = await wallet.signAndSendTransaction(tx, minContextSlot);
  } else {
    const signed = await wallet.signTransaction(tx);
    signature = await connection.sendRawTransaction(signed.serialize(), { minContextSlot });
  }

  const result = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  if (result.value.err) {
    const meta = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    throw new TxError(explainProgramError(meta?.meta?.logMessages ?? []), meta?.meta?.logMessages ?? []);
  }
  return signature;
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
