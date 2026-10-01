import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  RPC_URL: z.url(),
  ATTESTOR_KEYPAIR_PATH: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PUBLIC_BASE_URL: z.url().transform((u) => u.replace(/\/+$/, "")),
  DATABASE_PATH: z.string().default("./data/bulbul.db"),
  HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  HEARTBEAT_GRACE_SECONDS: z.coerce.number().int().positive().default(90),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  if (parsed.data.HEARTBEAT_GRACE_SECONDS <= parsed.data.HEARTBEAT_INTERVAL_SECONDS) {
    throw new Error("HEARTBEAT_GRACE_SECONDS must be greater than HEARTBEAT_INTERVAL_SECONDS");
  }
  return parsed.data;
}
