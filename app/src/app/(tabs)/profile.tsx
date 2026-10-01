import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, Card, ErrorState, Loading, Screen, Stat } from "@/components/ui";
import { useProfile, useUsdcBalance, useWalletAddress } from "@/hooks/useBulbul";
import { signOut } from "@/lib/api";
import { big, formatDate, formatUsdc, shortAddress } from "@/lib/format";
import { regionName } from "@/lib/regions";
import { stageFromEnum } from "@/lib/stages";
import { colors, space, type } from "@/theme";

export default function ProfileScreen() {
  const profile = useProfile();
  const balance = useUsdcBalance();
  const wallet = useWalletAddress();
  const { disconnect } = useMobileWallet();

  async function leave() {
    if (wallet) await signOut(wallet.toBase58());
    await disconnect();
    router.replace("/welcome");
  }

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <View style={{ gap: space.xl, paddingTop: space.xl }}>
        <Text style={type.title}>You</Text>
        {profile.isPending ? (
          <Loading />
        ) : profile.isError || !profile.data ? (
          <ErrorState error={profile.error ?? new Error("No profile")} onRetry={() => void profile.refetch()} />
        ) : (
          <>
            <Card style={{ gap: space.lg }}>
              <Text style={type.label}>On-chain reputation</Text>
              <View style={{ flexDirection: "row" }}>
                <Stat label="Verified saved" value={`${formatUsdc(big(profile.data.verifiedSavedTotal), { decimals: 0 })} USDC`} />
                <Stat label="XP" value={profile.data.xp.toString()} />
              </View>
              <View style={{ flexDirection: "row" }}>
                <Stat label="Goals done" value={String(profile.data.goalsCompleted)} />
                <Stat label="Streaks kept" value={String(profile.data.commitmentsSucceeded)} />
              </View>
              <View style={{ flexDirection: "row" }}>
                <Stat label="Stage" value={stageFromEnum(profile.data.companionStage).name} />
                <Stat label="Missed" value={String(profile.data.commitmentsFailed)} />
              </View>
              <Text style={type.small}>
                These numbers live on Solana. Any app can read them, and only kept commitments can raise them.
              </Text>
            </Card>
            <Card style={{ gap: space.sm }}>
              <Text style={type.label}>Account</Text>
              <Text style={type.body}>Wallet {wallet ? shortAddress(wallet.toBase58()) : ""}</Text>
              <Text style={type.body}>Region {regionName(String.fromCharCode(...profile.data.region))}</Text>
              <Text style={type.body}>USDC {balance.data !== undefined ? formatUsdc(balance.data) : "…"}</Text>
              <Text style={type.small}>Member since {formatDate(profile.data.createdAt.toNumber())}</Text>
            </Card>
          </>
        )}
        <Pressable onPress={() => router.push("/terms")} accessibilityRole="link">
          <Text style={[type.body, { color: colors.accent }]}>How bulbul works & terms</Text>
        </Pressable>
        <Button label="Disconnect wallet" variant="secondary" icon="log-out-outline" onPress={() => void leave()} />
      </View>
    </Screen>
  );
}
