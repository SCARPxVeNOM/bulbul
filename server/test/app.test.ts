import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { missingArt } from "../src/metadata.js";
import { focusFor, harness, signMessage } from "./helpers.js";

const BASE = "https://api.bulbul.test";

function setup() {
  const h = harness();
  const app = createApp({ auth: h.auth, focus: h.focus, chain: h.chain, baseUrl: BASE, now: h.clock.now });
  const post = (path: string, body: unknown, token?: string) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  const login = async (kp: Keypair) => {
    const wallet = kp.publicKey.toBase58();
    const ch = (await (await post("/auth/challenge", { wallet })).json()) as { nonce: string; message: string };
    const res = await post("/auth/verify", { wallet, nonce: ch.nonce, signature: signMessage(kp, ch.message) });
    expect(res.status).toBe(200);
    return ((await res.json()) as { token: string }).token;
  };
  return { h, app, post, login };
}

describe("http api", () => {
  it("health reports attestor and art status", async () => {
    const { app, h } = setup();
    const body = (await (await app.request("/health")).json()) as Record<string, unknown>;
    expect(body.attestor).toBe(h.chain.attestor);
    expect(body.attestor_balance_sol).toBe(2.5);
    expect(body.missing_art).toEqual(missingArt());
  });

  it("end-to-end: sign in, focus, attest", async () => {
    const { h, app, post, login } = setup();
    const kp = Keypair.generate();
    const wallet = kp.publicKey.toBase58();
    const token = await login(kp);
    const commitment = h.chain.add(wallet, { focusMinutes: 5 });

    const started = await post("/focus/start", { commitment }, token);
    expect(started.status).toBe(201);
    const { session } = (await started.json()) as { session: { id: string } };

    const active = await app.request("/focus/active", { headers: { authorization: `Bearer ${token}` } });
    expect(((await active.json()) as { session: { id: string } }).session.id).toBe(session.id);

    focusFor(h, wallet, session.id, 300);
    const finished = await post(`/focus/${session.id}/finish`, {}, token);
    const out = (await finished.json()) as { session: { status: string; tx_signature: string } };
    expect(out.session.status).toBe("attested");
    expect(out.session.tx_signature).toBe("sig-1");
  });

  it("focus routes require a valid bearer token", async () => {
    const { post } = setup();
    expect((await post("/focus/start", { commitment: "x".repeat(44) })).status).toBe(401);
    expect((await post("/focus/start", { commitment: "x".repeat(44) }, "garbage")).status).toBe(401);
  });

  it("validates request bodies", async () => {
    const { app, post, login } = setup();
    expect((await post("/auth/challenge", { wallet: 5 })).status).toBe(400);
    expect((await post("/auth/verify", { wallet: "a".repeat(44), nonce: "zz", signature: "s" })).status).toBe(400);
    const bad = await app.request("/auth/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(bad.status).toBe(400);
    const token = await login(Keypair.generate());
    expect((await post("/focus/start", {}, token)).status).toBe(400);
  });

  it("maps domain errors to status codes", async () => {
    const { post, login } = setup();
    const token = await login(Keypair.generate());
    const missing = Keypair.generate().publicKey.toBase58();
    expect((await post("/focus/start", { commitment: missing }, token)).status).toBe(404);
    expect((await post("/auth/verify", { wallet: missing, nonce: "a".repeat(32), signature: "1".repeat(88) })).status).toBe(
      401,
    );
  });

  it("rate limits challenge requests", async () => {
    const { post } = setup();
    const wallet = Keypair.generate().publicKey.toBase58();
    for (let i = 0; i < 30; i++) expect((await post("/auth/challenge", { wallet })).status).toBe(200);
    expect((await post("/auth/challenge", { wallet })).status).toBe(429);
  });

  it("serves companion metadata for each stage", async () => {
    const { app } = setup();
    const res = await app.request("/companion/focused.json");
    expect(res.status).toBe(200);
    const meta = (await res.json()) as { name: string; image: string; attributes: unknown[] };
    expect(meta.name).toBe("bulbul · Focused");
    expect(meta.image).toBe(`${BASE}/companion/focused.png`);
    expect(meta.attributes).toEqual([{ trait_type: "stage", value: "Focused" }]);
    expect((await app.request("/companion/mythic.json")).status).toBe(404);
    expect((await app.request("/companion/../secrets.json")).status).toBe(404);
  });

  it("missing art is a clear 404, never a stand-in image", async () => {
    const { app } = setup();
    for (const stage of missingArt()) {
      const res = await app.request(`/companion/${stage}.png`);
      expect(res.status).toBe(404);
      expect(((await res.json()) as { error: string }).error).toContain("has not been added");
    }
  });
});
