type MwaChain = "solana:devnet" | "solana:mainnet" | "solana:testnet";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy app/.env.example to app/.env and fill it in.`);
  return value;
}

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${name} must be one of ${allowed.join(", ")} (got "${value}")`);
  }
  return value as T;
}

// Expo inlines EXPO_PUBLIC_* only for static `process.env.X` reads, so each is read explicitly.
export const env = {
  rpcUrl: required("EXPO_PUBLIC_RPC_URL", process.env.EXPO_PUBLIC_RPC_URL),
  apiUrl: required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL).replace(/\/+$/, ""),
  /** Shown to the user by their wallet when connecting. */
  appUrl: required("EXPO_PUBLIC_APP_URL", process.env.EXPO_PUBLIC_APP_URL).replace(/\/+$/, ""),
  chain: oneOf<MwaChain>(
    "EXPO_PUBLIC_SOLANA_CHAIN",
    process.env.EXPO_PUBLIC_SOLANA_CHAIN ?? "solana:devnet",
    ["solana:devnet", "solana:mainnet", "solana:testnet"],
  ),
  txSubmit: oneOf("EXPO_PUBLIC_TX_SUBMIT", process.env.EXPO_PUBLIC_TX_SUBMIT ?? "wallet", ["wallet", "app"] as const),
} as const;
