import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { AuthError, isValidWallet } from "../src/auth.js";
import { harness, signMessage } from "./helpers.js";

describe("sign in with solana", () => {
  it("issues a session token for a valid signature", async () => {
    const h = harness();
    const kp = Keypair.generate();
    const wallet = kp.publicKey.toBase58();
    const { nonce, message } = h.auth.createChallenge(wallet);
    expect(message).toContain(wallet);
    expect(message).toContain(`Nonce: ${nonce}`);
    expect(message).toContain("does not move funds");

    const token = await h.auth.verify(wallet, nonce, signMessage(kp, message));
    expect(await h.auth.walletFromToken(token)).toBe(wallet);
  });

  it("nonces are single use", async () => {
    const h = harness();
    const kp = Keypair.generate();
    const wallet = kp.publicKey.toBase58();
    const { nonce, message } = h.auth.createChallenge(wallet);
    const sig = signMessage(kp, message);
    await h.auth.verify(wallet, nonce, sig);
    await expect(h.auth.verify(wallet, nonce, sig)).rejects.toThrow(/already-used/);
  });

  it("rejects a signature from a different key", async () => {
    const h = harness();
    const wallet = Keypair.generate().publicKey.toBase58();
    const { nonce, message } = h.auth.createChallenge(wallet);
    await expect(h.auth.verify(wallet, nonce, signMessage(Keypair.generate(), message))).rejects.toThrow(
      /does not match/,
    );
  });

  it("rejects a challenge issued for another wallet", async () => {
    const h = harness();
    const a = Keypair.generate();
    const b = Keypair.generate();
    const { nonce, message } = h.auth.createChallenge(a.publicKey.toBase58());
    await expect(h.auth.verify(b.publicKey.toBase58(), nonce, signMessage(b, message))).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("rejects expired challenges", async () => {
    const h = harness();
    const kp = Keypair.generate();
    const wallet = kp.publicKey.toBase58();
    const { nonce, message } = h.auth.createChallenge(wallet);
    h.clock.advanceSec(5 * 60 + 1);
    await expect(h.auth.verify(wallet, nonce, signMessage(kp, message))).rejects.toThrow(/expired/);
  });

  it("rejects malformed signatures", async () => {
    const h = harness();
    const wallet = Keypair.generate().publicKey.toBase58();
    const { nonce } = h.auth.createChallenge(wallet);
    await expect(h.auth.verify(wallet, nonce, "0OIl-not-base58")).rejects.toThrow(/base58/);
  });

  it("session tokens expire after 7 days", async () => {
    const h = harness();
    const kp = Keypair.generate();
    const wallet = kp.publicKey.toBase58();
    const { nonce, message } = h.auth.createChallenge(wallet);
    const token = await h.auth.verify(wallet, nonce, signMessage(kp, message));
    h.clock.advanceSec(7 * 86_400 + 1);
    await expect(h.auth.walletFromToken(token)).rejects.toThrow(/expired/);
  });

  it("rejects tampered tokens", async () => {
    const h = harness();
    const kp = Keypair.generate();
    const wallet = kp.publicKey.toBase58();
    const { nonce, message } = h.auth.createChallenge(wallet);
    const token = await h.auth.verify(wallet, nonce, signMessage(kp, message));
    await expect(h.auth.walletFromToken(token.slice(0, -2) + "xx")).rejects.toBeInstanceOf(AuthError);
  });

  it("validates wallet addresses", () => {
    const h = harness();
    expect(isValidWallet(Keypair.generate().publicKey.toBase58())).toBe(true);
    expect(isValidWallet("not-a-key")).toBe(false);
    expect(() => h.auth.createChallenge("not-a-key")).toThrow(AuthError);
  });
});
