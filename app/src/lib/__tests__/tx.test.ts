import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { confirmByPolling, explainProgramError, sendInstructions, TxError, type TxWallet } from "../tx";

const payer = Keypair.generate();
const transfer = SystemProgram.transfer({
  fromPubkey: payer.publicKey,
  toPubkey: Keypair.generate().publicKey,
  lamports: 1,
});
const hash = () => Keypair.generate().publicKey.toBase58();

function walletWith(overrides: Partial<TxWallet> = {}): TxWallet {
  return {
    publicKey: payer.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(payer);
      return tx;
    },
    signAndSendTransaction: async () => "sig",
    ...overrides,
  };
}

function healthyConnection(simHash: string, sendHash: string) {
  return {
    getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: simHash, lastValidBlockHeight: 10 }),
    getLatestBlockhashAndContext: jest.fn().mockResolvedValue({
      context: { slot: 7 },
      value: { blockhash: sendHash, lastValidBlockHeight: 20 },
    }),
    simulateTransaction: jest.fn().mockResolvedValue({ value: { err: null, logs: [] } }),
    sendRawTransaction: jest.fn().mockResolvedValue("raw-sig"),
    getSignatureStatuses: jest.fn().mockResolvedValue({ value: [{ err: null, confirmationStatus: "confirmed" }] }),
    getBlockHeight: jest.fn().mockResolvedValue(5),
  };
}

describe("sendInstructions", () => {
  it("turns connectivity failures into a readable message", async () => {
    const connection = {
      getLatestBlockhash: jest
        .fn()
        .mockRejectedValue(new Error("failed to get recent blockhash: Error: fetch failed: java.net.UnknownHostException")),
    };
    await expect(sendInstructions(connection as never, walletWith(), [transfer])).rejects.toThrow(
      /Couldn’t reach the Solana network/,
    );
  });

  it("keeps program errors from simulation logs", async () => {
    const connection = {
      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: hash(), lastValidBlockHeight: 10 }),
      simulateTransaction: jest.fn().mockResolvedValue({
        value: { err: { InstructionError: [0, { Custom: 6012 }] }, logs: ["Program log: AnchorError … Error Message: Goal is still locked."] },
      }),
    };
    const err = await sendInstructions(connection as never, walletWith(), [transfer]).catch((e) => e);
    expect(err).toBeInstanceOf(TxError);
    expect(err.message).toBe("Goal is still locked");
  });

  // Tests run with EXPO_PUBLIC_TX_SUBMIT=app: the wallet signs, the app submits.
  it("signs with a blockhash fetched after simulation, and extra signers commit to it", async () => {
    const simHash = hash();
    const sendHash = hash();
    const connection = healthyConnection(simHash, sendHash);
    const asset = Keypair.generate();
    let sent: Transaction | undefined;
    const wallet = walletWith({
      signTransaction: async (tx: Transaction) => {
        tx.partialSign(payer);
        sent = tx;
        return tx;
      },
    });
    const ix = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: asset.publicKey,
      lamports: 1,
      space: 0,
      programId: SystemProgram.programId,
    });
    await expect(sendInstructions(connection as never, wallet, [ix], [asset])).resolves.toBe("raw-sig");
    expect(connection.sendRawTransaction).toHaveBeenCalledWith(expect.anything(), { minContextSlot: 7 });
    expect(sent!.recentBlockhash).toBe(sendHash);
    const assetSig = sent!.signatures.find((s) => s.publicKey.equals(asset.publicKey));
    expect(assetSig?.signature).toBeTruthy();
    // The asset signature verifies only against the final message (fresh blockhash).
    expect(sent!.verifySignatures(false)).toBe(true);
    expect(connection.getSignatureStatuses).toHaveBeenCalledWith(["raw-sig"]);
  });

  it("explains an expired request instead of the raw RPC error", async () => {
    const connection = healthyConnection(hash(), hash());
    connection.sendRawTransaction.mockRejectedValue(new Error("Transaction simulation failed: Blockhash not found"));
    await expect(sendInstructions(connection as never, walletWith(), [transfer])).rejects.toThrow(/took too long/);
  });

  it("explains a rejected wallet session", async () => {
    const wallet = walletWith({
      signTransaction: async () => {
        throw new Error("-1/auth_token not valid for signing");
      },
    });
    await expect(sendInstructions(healthyConnection(hash(), hash()) as never, wallet, [transfer])).rejects.toThrow(
      /wallet session expired/,
    );
  });

  it("confirmByPolling waits until confirmed", async () => {
    const connection = {
      getSignatureStatuses: jest
        .fn()
        .mockResolvedValueOnce({ value: [null] })
        .mockResolvedValueOnce({ value: [{ err: null, confirmationStatus: "processed" }] })
        .mockResolvedValueOnce({ value: [{ err: null, confirmationStatus: "confirmed" }] }),
      getBlockHeight: jest.fn().mockResolvedValue(1),
    };
    await expect(confirmByPolling(connection as never, "s", 10, 0)).resolves.toBeNull();
    expect(connection.getSignatureStatuses).toHaveBeenCalledTimes(3);
  });

  it("confirmByPolling returns the on-chain error", async () => {
    const err = { InstructionError: [0, { Custom: 6001 }] };
    const connection = {
      getSignatureStatuses: jest.fn().mockResolvedValue({ value: [{ err, confirmationStatus: "confirmed" }] }),
      getBlockHeight: jest.fn(),
    };
    await expect(confirmByPolling(connection as never, "s", 10, 0)).resolves.toEqual(err);
  });

  it("confirmByPolling gives up after the blockhash expires", async () => {
    const connection = {
      getSignatureStatuses: jest.fn().mockResolvedValue({ value: [null] }),
      getBlockHeight: jest.fn().mockResolvedValue(11),
    };
    await expect(confirmByPolling(connection as never, "s", 10, 0)).rejects.toThrow(/took too long/);
  });

  it("explainProgramError falls back sensibly", () => {
    expect(explainProgramError(["Transfer: insufficient lamports 5, need 10"])).toBe("Not enough balance for this transaction");
    expect(explainProgramError([])).toBe("The transaction failed. Please try again.");
  });
});
