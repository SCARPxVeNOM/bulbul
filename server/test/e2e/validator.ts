import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { TestProject } from "vitest/node";
import idl from "../../../idl/bulbul.json" with { type: "json" };

const ROOT = resolve(import.meta.dirname, "../../..");
const SO = join(ROOT, "target/deploy/bulbul.so");
const MPL_CORE_SO = join(ROOT, "programs/bulbul/tests/fixtures/mpl_core.so");
const MPL_CORE_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
const RPC_PORT = 18899;

let validator: ChildProcess | undefined;

/** Boots a fresh local validator with the real bulbul + Metaplex Core programs. */
export default async function setup(project: TestProject) {
  if (!existsSync(SO)) throw new Error(`build the program first: ${SO} missing (run anchor build)`);
  const dir = mkdtempSync(join(tmpdir(), "bulbul-e2e-"));
  const admin = Keypair.generate();
  const adminPath = join(dir, "admin.json");
  writeFileSync(adminPath, JSON.stringify(Array.from(admin.secretKey)));

  const bin = join(homedir(), ".local/share/solana/install/active_release/bin/solana-test-validator");
  validator = spawn(
    bin,
    [
      "--reset",
      "--quiet",
      "--ledger", join(dir, "ledger"),
      "--rpc-port", String(RPC_PORT),
      "--faucet-port", String(RPC_PORT + 1001),
      "--mint", admin.publicKey.toBase58(),
      "--upgradeable-program", idl.address, SO, admin.publicKey.toBase58(),
      "--bpf-program", MPL_CORE_ID, MPL_CORE_SO,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  validator.stderr?.on("data", (d) => (stderr += d));

  const rpc = `http://127.0.0.1:${RPC_PORT}`;
  const connection = new Connection(rpc, "confirmed");
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const [funded, program] = await Promise.all([
        connection.getAccountInfo(admin.publicKey),
        connection.getAccountInfo(new PublicKey(idl.address)),
      ]);
      if (funded && program) break;
    } catch {
      /* not up yet */
    }
    if (validator.exitCode !== null) throw new Error(`validator exited early:\n${stderr}`);
    if (Date.now() > deadline) throw new Error(`validator did not start:\n${stderr}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  project.provide("rpcUrl", rpc);
  project.provide("adminKeypairPath", adminPath);
  project.provide("workDir", dir);

  return () => {
    validator?.kill("SIGTERM");
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    rpcUrl: string;
    adminKeypairPath: string;
    workDir: string;
  }
}
