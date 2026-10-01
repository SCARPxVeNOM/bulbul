import { serve } from "@hono/node-server";
import { Connection } from "@solana/web3.js";
import { createApp } from "./app.js";
import { Auth } from "./auth.js";
import { SolanaChain, loadKeypair } from "./chain.js";
import { openDb } from "./db.js";
import { loadEnv } from "./env.js";
import { FocusService } from "./focus.js";
import { missingArt } from "./metadata.js";

const env = loadEnv();
const now = () => Date.now();
const db = openDb(env.DATABASE_PATH);
const chain = new SolanaChain(new Connection(env.RPC_URL, "confirmed"), loadKeypair(env.ATTESTOR_KEYPAIR_PATH));
const auth = new Auth(db, env.JWT_SECRET, new URL(env.PUBLIC_BASE_URL).host, now);
const focus = new FocusService(
  db,
  chain,
  { heartbeatIntervalSeconds: env.HEARTBEAT_INTERVAL_SECONDS, heartbeatGraceSeconds: env.HEARTBEAT_GRACE_SECONDS },
  now,
);
const app = createApp({ auth, focus, chain, baseUrl: env.PUBLIC_BASE_URL, now });

const missing = missingArt();
if (missing.length > 0) {
  console.warn(`[bulbul] companion art missing for: ${missing.join(", ")} (add PNGs to server/assets/companion/)`);
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[bulbul] server on :${info.port}, attestor ${chain.attestor}`);
});
