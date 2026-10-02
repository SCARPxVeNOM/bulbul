import { PublicKey } from "@solana/web3.js";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Banner, Button, Card, ErrorState, Loading, ProgressBar, Screen } from "@/components/ui";
import { useChainAction, useCommitments } from "@/hooks/useBulbul";
import { useNow } from "@/hooks/useNow";
import { commitmentStatus, MODE_COPY } from "@/lib/commitments";
import { big, formatUsdc } from "@/lib/format";
import { colors, space, type } from "@/theme";

export default function Focus() {
  const commitments = useCommitments();
  const now = useNow();
  const settle = useChainAction((a, commitment: PublicKey) => a.settleCommitment(commitment));

  return (
    <Screen refreshing={commitments.isRefetching} onRefresh={() => void commitments.refetch()}>
      <View style={{ gap: space.xl, paddingTop: space.xl }}>
        <View style={{ gap: space.xs }}>
          <Text style={type.title}>Focus stakes</Text>
          <Text style={type.small}>Promise yourself deep focus. Keep it and your stake comes back with XP.</Text>
        </View>
        <Button label="New habit stake" icon="add" onPress={() => router.push("/commitment/new")} />
        {settle.error ? <Banner tone="error">{settle.error.message}</Banner> : null}

        {commitments.isPending ? (
          <Loading />
        ) : commitments.isError ? (
          <ErrorState error={commitments.error} onRetry={() => void commitments.refetch()} />
        ) : commitments.data.length === 0 ? (
          <Card>
            <Text style={type.body}>No active stakes. Try “2 hours of focus, 5 of the next 7 days”.</Text>
          </Card>
        ) : (
          commitments.data.map(({ publicKey, account }) => {
            const s = commitmentStatus(account, now);
            const pct = (account.checkins / account.requiredCheckins) * 100;
            const hours = account.focusMinutes >= 60 ? `${account.focusMinutes / 60} h` : `${account.focusMinutes} min`;
            return (
              <Card key={publicKey.toBase58()} style={{ gap: space.md }}>
                <Pressable onPress={() => s.state === "active" && router.push(`/session/${publicKey.toBase58()}`)}>
                  <View style={{ gap: space.sm }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[type.heading, { flex: 1 }]}>
                        {hours} focus · {account.requiredCheckins} of {account.periodDays} days
                      </Text>
                      <Text style={type.heading}>
                        {account.checkins}/{account.requiredCheckins}
                      </Text>
                    </View>
                    <ProgressBar value={pct} />
                    <Text style={type.small}>
                      {formatUsdc(big(account.stake))} USDC staked · {MODE_COPY[s.mode].title} ·{" "}
                      {s.state === "active"
                        ? `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`
                        : s.state === "succeeded"
                          ? "kept ✓"
                          : "missed"}
                    </Text>
                  </View>
                </Pressable>
                {s.state === "active" ? (
                  s.checkedInToday ? (
                    <Text style={[type.small, { color: colors.success }]}>Today is checked in ✓</Text>
                  ) : !s.stillPossible ? (
                    <Text style={[type.small, { color: colors.warning }]}>
                      Not enough days left to reach the goal. It will settle as missed at the deadline.
                    </Text>
                  ) : (
                    <Button label="Start today’s focus" icon="play" onPress={() => router.push(`/session/${publicKey.toBase58()}`)} />
                  )
                ) : (
                  <Button
                    label={s.state === "succeeded" ? "Settle & collect stake" : "Settle missed stake"}
                    variant={s.state === "succeeded" ? "primary" : "secondary"}
                    loading={settle.isPending && settle.variables?.equals(publicKey)}
                    disabled={settle.isPending}
                    onPress={() => void settle.mutateAsync(publicKey).catch(() => undefined)}
                  />
                )}
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}
