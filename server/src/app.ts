import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { Auth, AuthError } from "./auth.js";
import type { Chain } from "./chain.js";
import { FocusError, FocusService } from "./focus.js";
import { artPath, companionMetadata, isStage, missingArt } from "./metadata.js";

type Vars = { Variables: { wallet: string } };

export interface AppDeps {
  auth: Auth;
  focus: FocusService;
  chain: Chain;
  baseUrl: string;
  now: () => number;
}

const ChallengeBody = z.object({ wallet: z.string().min(32).max(44) });
const VerifyBody = z.object({
  wallet: z.string().min(32).max(44),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  signature: z.string().min(64).max(100),
});
const StartBody = z.object({ commitment: z.string().min(32).max(44) });

/** Fixed-window limiter for unauthenticated endpoints. */
function rateLimit(limit: number, windowMs: number, now: () => number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const t = now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (hits.size > 10_000) hits.clear();
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

function clientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
}

export function createApp({ auth, focus, chain, baseUrl, now }: AppDeps) {
  const app = new Hono<Vars>();
  const challengeLimiter = rateLimit(30, 60_000, now);

  app.onError((err, c) => {
    if (err instanceof AuthError) return c.json({ error: err.message }, 401);
    if (err instanceof FocusError) return c.json({ error: err.message }, err.status);
    if (err instanceof z.ZodError) return c.json({ error: "invalid request", issues: err.issues }, 400);
    if (err instanceof SyntaxError) return c.json({ error: "invalid JSON body" }, 400);
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  app.get("/health", async (c) => {
    const lamports = await chain.attestorBalanceLamports();
    return c.json({
      ok: true,
      attestor: chain.attestor,
      attestor_balance_sol: lamports / 1e9,
      missing_art: missingArt(),
    });
  });

  app.post("/auth/challenge", async (c) => {
    if (!challengeLimiter(clientIp(c))) return c.json({ error: "too many requests" }, 429);
    const { wallet } = ChallengeBody.parse(await c.req.json());
    return c.json(auth.createChallenge(wallet));
  });

  app.post("/auth/verify", async (c) => {
    const { wallet, nonce, signature } = VerifyBody.parse(await c.req.json());
    return c.json({ token: await auth.verify(wallet, nonce, signature), wallet });
  });

  const focusRoutes = new Hono<Vars>();
  focusRoutes.use(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new AuthError("missing bearer token");
    c.set("wallet", await auth.walletFromToken(token));
    await next();
  });
  focusRoutes.get("/active", (c) => c.json({ session: focus.active(c.get("wallet")) }));
  focusRoutes.post("/start", async (c) => {
    const { commitment } = StartBody.parse(await c.req.json());
    return c.json({ session: await focus.start(c.get("wallet"), commitment) }, 201);
  });
  focusRoutes.post("/:id/heartbeat", (c) => c.json({ session: focus.heartbeat(c.get("wallet"), c.req.param("id")) }));
  focusRoutes.post("/:id/finish", async (c) =>
    c.json({ session: await focus.finish(c.get("wallet"), c.req.param("id")) }),
  );
  focusRoutes.post("/:id/retry", async (c) =>
    c.json({ session: await focus.retryAttestation(c.get("wallet"), c.req.param("id")) }),
  );
  focusRoutes.post("/:id/cancel", (c) => c.json({ session: focus.cancel(c.get("wallet"), c.req.param("id")) }));
  app.route("/focus", focusRoutes);

  app.get("/companion/:file", async (c) => {
    const match = /^([a-z]+)\.(json|png)$/.exec(c.req.param("file"));
    const stage = match?.[1];
    if (!match || !stage || !isStage(stage)) return c.json({ error: "not found" }, 404);
    if (match[2] === "json") {
      c.header("cache-control", "public, max-age=300");
      return c.json(companionMetadata(baseUrl, stage));
    }
    const path = artPath(stage);
    if (!existsSync(path)) return c.json({ error: `art for stage '${stage}' has not been added yet` }, 404);
    c.header("content-type", "image/png");
    c.header("cache-control", "public, max-age=3600");
    return c.body(await readFile(path));
  });

  return app;
}
