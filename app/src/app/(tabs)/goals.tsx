import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, Card, ErrorState, Loading, ProgressBar, Screen } from "@/components/ui";
import { useGoals, useUsdcBalance } from "@/hooks/useBulbul";
import { useNow } from "@/hooks/useNow";
import { big, formatDate, formatUntil, formatUsdc, percent } from "@/lib/format";
import { space, type } from "@/theme";

export default function Goals() {
  const goals = useGoals();
  const balance = useUsdcBalance();
  const now = useNow();

  return (
    <Screen
      refreshing={goals.isRefetching || balance.isRefetching}
      onRefresh={() => {
        void goals.refetch();
        void balance.refetch();
      }}
    >
      <View style={{ gap: space.xl, paddingTop: space.xl }}>
        <View style={{ gap: space.xs }}>
          <Text style={type.title}>Goal vaults</Text>
          <Text style={type.small}>
            Wallet balance: {balance.data === undefined ? "…" : `${formatUsdc(balance.data)} USDC`}
          </Text>
        </View>

        <Button label="New goal" icon="add" onPress={() => router.push("/goal/new")} />

        {goals.isPending ? (
          <Loading />
        ) : goals.isError ? (
          <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />
        ) : goals.data.length === 0 ? (
          <Card>
            <Text style={type.body}>
              No vaults yet. Pick something you’re saving for, lock USDC toward it, and your companion grows when you get
              there.
            </Text>
          </Card>
        ) : (
          goals.data.map(({ publicKey, account }) => {
            const pct = percent(big(account.deposited), big(account.targetAmount));
            const unlockAt = account.unlockAt.toNumber();
            const locked = unlockAt * 1000 > now;
            return (
              <Pressable key={publicKey.toBase58()} onPress={() => router.push(`/goal/${publicKey.toBase58()}`)}>
                <Card style={{ gap: space.md }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={type.heading}>{account.name}</Text>
                    <Text style={type.heading}>{Math.floor(pct)}%</Text>
                  </View>
                  <ProgressBar value={pct} />
                  <Text style={type.small}>
                    {formatUsdc(big(account.deposited))} / {formatUsdc(big(account.targetAmount))} USDC ·{" "}
                    {locked ? `unlocks in ${formatUntil(unlockAt, now)}` : `unlocked ${formatDate(unlockAt)}`}
                  </Text>
                </Card>
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}
