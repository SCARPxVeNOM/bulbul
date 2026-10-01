import { PublicKey } from "@solana/web3.js";
import { Redirect } from "expo-router";
import { ErrorState, Loading, Screen } from "@/components/ui";
import { useProfile, useWalletAddress } from "@/hooks/useBulbul";

/** Routes to welcome, onboarding, or home depending on wallet + on-chain profile. */
export default function Gate() {
  const wallet = useWalletAddress();
  const profile = useProfile();

  if (!wallet) return <Redirect href="/welcome" />;
  if (profile.isPending) {
    return (
      <Screen scroll={false}>
        <Loading label="Finding your companion…" />
      </Screen>
    );
  }
  if (profile.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  if (!profile.data || profile.data.companion.equals(PublicKey.default)) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
