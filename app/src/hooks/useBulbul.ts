import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { PublicKey, type Keypair, type Transaction, type TransactionInstruction } from "@solana/web3.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { actions, type ChainConfig } from "@/lib/actions";
import { focusApi } from "@/lib/api";
import { makeProgram, pdas } from "@/lib/program";
import { tokenBalance } from "@/lib/token";
import { sendInstructions, type TxWallet } from "@/lib/tx";

export function useProgram() {
  const { connection } = useMobileWallet();
  return useMemo(() => makeProgram(connection), [connection]);
}

export function useWalletAddress(): PublicKey | null {
  const { account } = useMobileWallet();
  return account?.publicKey ?? null;
}

export const keys = {
  config: ["config"] as const,
  profile: (w: string) => ["profile", w] as const,
  goals: (w: string) => ["goals", w] as const,
  commitments: (w: string) => ["commitments", w] as const,
  usdc: (w: string) => ["usdc", w] as const,
};

export function useChainConfig() {
  const program = useProgram();
  return useQuery({
    queryKey: keys.config,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ChainConfig> => {
      const c = await program.account.config.fetch(pdas.config());
      return {
        usdcMint: c.usdcMint,
        charityTokenAccount: c.charityTokenAccount,
        poolVault: c.poolVault,
        restrictedRegions: c.restrictedRegions.map((r) => String.fromCharCode(...r)),
        companionUriBase: c.companionUriBase,
        paused: c.paused,
      };
    },
  });
}

export function useProfile() {
  const program = useProgram();
  const wallet = useWalletAddress();
  return useQuery({
    queryKey: keys.profile(wallet?.toBase58() ?? ""),
    enabled: !!wallet,
    queryFn: () => program.account.profile.fetchNullable(pdas.profile(wallet!)),
  });
}

const OWNER_OFFSET = 8;

export function useGoals() {
  const program = useProgram();
  const wallet = useWalletAddress();
  return useQuery({
    queryKey: keys.goals(wallet?.toBase58() ?? ""),
    enabled: !!wallet,
    queryFn: async () => {
      const goals = await program.account.goalVault.all([
        { memcmp: { offset: OWNER_OFFSET, bytes: wallet!.toBase58() } },
      ]);
      return goals.sort((a, b) => a.account.id - b.account.id);
    },
  });
}

export function useCommitments() {
  const program = useProgram();
  const wallet = useWalletAddress();
  return useQuery({
    queryKey: keys.commitments(wallet?.toBase58() ?? ""),
    enabled: !!wallet,
    queryFn: async () => {
      const list = await program.account.commitment.all([
        { memcmp: { offset: OWNER_OFFSET, bytes: wallet!.toBase58() } },
      ]);
      return list.sort((a, b) => a.account.id - b.account.id);
    },
  });
}

export function useUsdcBalance() {
  const { connection } = useMobileWallet();
  const wallet = useWalletAddress();
  const config = useChainConfig();
  return useQuery({
    queryKey: keys.usdc(wallet?.toBase58() ?? ""),
    enabled: !!wallet && !!config.data,
    queryFn: () => {
      const a = actions(makeProgram(connection), wallet!, config.data!);
      return tokenBalance(connection, a.ownerUsdc);
    },
  });
}

/** Wallet adapter shaped for sendInstructions. */
export function useTxWallet(): TxWallet | null {
  const mw = useMobileWallet();
  const pk = mw.account?.publicKey;
  return useMemo(() => {
    if (!pk) return null;
    return {
      publicKey: pk,
      signTransaction: (tx: Transaction) => mw.signTransaction(tx),
      signAndSendTransaction: (tx: Transaction, slot: number) => mw.signAndSendTransaction(tx, slot),
    };
  }, [pk, mw]);
}

/**
 * Runs an on-chain action: builds instructions from the current config, signs via
 * the mobile wallet, confirms, then refreshes everything the action may have changed.
 */
export function useChainAction<V>(
  build: (a: ReturnType<typeof actions>, vars: V) => Promise<TransactionInstruction[] | { ixs: TransactionInstruction[]; signers: Keypair[] }>,
) {
  const { connection } = useMobileWallet();
  const program = useProgram();
  const wallet = useTxWallet();
  const config = useChainConfig();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => {
      if (!wallet) throw new Error("Connect your wallet first");
      if (!config.data) throw new Error("Still loading bulbul's on-chain config");
      const built = await build(actions(program, wallet.publicKey, config.data), vars);
      const { ixs, signers } = Array.isArray(built) ? { ixs: built, signers: [] } : built;
      return sendInstructions(connection, wallet, ixs, signers);
    },
    // Returning the promise makes mutateAsync wait for fresh data, so screens that
    // navigate on success never route against the pre-transaction cache.
    onSettled: () => {
      const w = wallet?.publicKey.toBase58() ?? "";
      return Promise.all(
        [keys.profile(w), keys.goals(w), keys.commitments(w), keys.usdc(w)].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}

export function useFocusApi() {
  const mw = useMobileWallet();
  const wallet = mw.account?.publicKey.toBase58();
  return useMemo(
    () => (wallet ? focusApi(wallet, (msg) => mw.signMessage(msg)) : null),
    [wallet, mw],
  );
}
