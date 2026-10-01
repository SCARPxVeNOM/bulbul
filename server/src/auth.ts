import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import nacl from "tweetnacl";
import type { Db } from "./db.js";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export class AuthError extends Error {}

export function isValidWallet(wallet: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(wallet).toBytes());
  } catch {
    return false;
  }
}

export function buildSignInMessage(domain: string, wallet: string, nonce: string, issuedAt: Date, expiresAt: Date): string {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to bulbul. This does not move funds or approve any transaction.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");
}

export class Auth {
  private readonly key: Uint8Array;

  constructor(
    private readonly db: Db,
    secret: string,
    private readonly domain: string,
    private readonly now: () => number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  createChallenge(wallet: string): { nonce: string; message: string } {
    if (!isValidWallet(wallet)) throw new AuthError("invalid wallet address");
    const now = this.now();
    this.db.prepare("DELETE FROM auth_nonces WHERE expires_at < ?").run(now);
    const nonce = randomBytes(16).toString("hex");
    const message = buildSignInMessage(this.domain, wallet, nonce, new Date(now), new Date(now + NONCE_TTL_MS));
    this.db
      .prepare("INSERT INTO auth_nonces (nonce, wallet, message, expires_at) VALUES (?, ?, ?, ?)")
      .run(nonce, wallet, message, now + NONCE_TTL_MS);
    return { nonce, message };
  }

  /** Verifies the wallet signed our exact challenge; the nonce is single-use. */
  async verify(wallet: string, nonce: string, signatureB58: string): Promise<string> {
    const row = this.db
      .prepare("DELETE FROM auth_nonces WHERE nonce = ? RETURNING wallet, message, expires_at")
      .get(nonce) as { wallet: string; message: string; expires_at: number } | undefined;
    if (!row || row.wallet !== wallet) throw new AuthError("unknown or already-used challenge");
    if (row.expires_at < this.now()) throw new AuthError("challenge expired");

    let signature: Uint8Array;
    try {
      signature = bs58.decode(signatureB58);
    } catch {
      throw new AuthError("signature is not valid base58");
    }
    const ok =
      signature.length === nacl.sign.signatureLength &&
      nacl.sign.detached.verify(new TextEncoder().encode(row.message), signature, new PublicKey(wallet).toBytes());
    if (!ok) throw new AuthError("signature does not match wallet");

    const issuedAt = Math.floor(this.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(wallet)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
      .sign(this.key);
  }

  async walletFromToken(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        currentDate: new Date(this.now()),
      });
      if (!payload.sub || !isValidWallet(payload.sub)) throw new AuthError("bad token subject");
      return payload.sub;
    } catch (e) {
      if (e instanceof AuthError) throw e;
      throw new AuthError("invalid or expired session");
    }
  }
}
