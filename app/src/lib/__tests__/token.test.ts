import { Keypair, PublicKey } from "@solana/web3.js";
import { associatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, createAtaIdempotentIx, TOKEN_PROGRAM_ID, tokenBalance } from "../token";

describe("token helpers", () => {
  // Reference vector: the canonical USDC ATA for a known wallet (verifiable on any explorer).
  it("derives the canonical associated token address", () => {
    const owner = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
    const usdc = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const expected = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), usdc.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )[0];
    expect(associatedTokenAddress(owner, usdc).equals(expected)).toBe(true);
  });

  it("builds CreateIdempotent with the ATA program's account order", () => {
    const payer = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const ix = createAtaIdempotentIx(payer, owner, mint);
    expect(ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    expect([...ix.data]).toEqual([1]);
    expect(ix.keys.map((k) => [k.isSigner, k.isWritable])).toEqual([
      [true, true],
      [false, true],
      [false, false],
      [false, false],
      [false, false],
      [false, false],
    ]);
    expect(ix.keys[1]!.pubkey.equals(associatedTokenAddress(owner, mint))).toBe(true);
  });

  it("reads the amount from a token account and treats missing accounts as zero", async () => {
    const data = Buffer.alloc(165);
    data.writeBigUInt64LE(123_456_789n, 64);
    const connection = {
      getAccountInfo: jest
        .fn()
        .mockResolvedValueOnce({ owner: TOKEN_PROGRAM_ID, data })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ owner: Keypair.generate().publicKey, data }),
    };
    const acct = Keypair.generate().publicKey;
    expect(await tokenBalance(connection as never, acct)).toBe(123_456_789n);
    expect(await tokenBalance(connection as never, acct)).toBe(0n);
    expect(await tokenBalance(connection as never, acct)).toBe(0n);
  });
});
