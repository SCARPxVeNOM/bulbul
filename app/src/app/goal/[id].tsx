import { PublicKey } from "@solana/web3.js";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Banner, Button, Card, ErrorState, Field, Header, Loading, ProgressBar, Screen, Stat } from "@/components/ui";
import { useChainAction, useGoals, useUsdcBalance } from "@/hooks/useBulbul";
import { useNow } from "@/hooks/useNow";
import { big, formatDate, formatUntil, formatUsdc, parseUsdc, percent } from "@/lib/format";
import { space, type } from "@/theme";

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useGoals();
  const balance = useUsdcBalance();
  const [amount, setAmount] = useState("");
  const now = useNow();

  const deposit = useChainAction((a, v: { goal: PublicKey; amount: bigint }) => a.deposit(v.goal, v.amount));
  const close = useChainAction((a, v: { goal: PublicKey; kind: "complete" | "break" }) => a.closeGoal(v.goal, v.kind));

  if (goals.isPending) {
    return (
      <Screen>
        <Header title="Goal" onBack={() => router.back()} />
        <Loading />
      </Screen>
    );
  }
  if (goals.isError) {
    return (
      <Screen>
        <Header title="Goal" onBack={() => router.back()} />
        <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />
      </Screen>
    );
  }

  const goal = goals.data.find((g) => g.publicKey.toBase58() === id);
  if (!goal) {
    return (
      <Screen>
        <Header title="Goal" onBack={() => router.back()} />
        <Card>
          <Text style={type.body}>This vault has been completed or closed.</Text>
        </Card>
      </Screen>
    );
  }

  const g = goal.account;
  const deposited = big(g.deposited);
  const targetAmt = big(g.targetAmount);
  const pct = percent(deposited, targetAmt);
  const unlockAt = g.unlockAt.toNumber();
  const locked = unlockAt * 1000 > now;
  const reached = deposited >= targetAmt;
  const parsed = parseUsdc(amount);
  const tooMuch = parsed !== null && balance.data !== undefined && parsed > balance.data;
  const amountError =
    amount.length > 0 && (parsed === null || parsed === 0n) ? "Enter a valid amount" : tooMuch ? "More than your wallet balance" : null;

  async function doDeposit() {
    if (!parsed || tooMuch) return;
    await deposit.mutateAsync({ goal: goal!.publicKey, amount: parsed }).then(() => setAmount(""), () => undefined);
  }

  function confirmBreak() {
    Alert.alert(
      "Break this vault?",
      `You’ll get ${formatUsdc(deposited)} USDC back now, but your companion earns no XP for this goal.`,
      [
        { text: "Keep saving", style: "cancel" },
        {
          text: "Break vault",
          style: "destructive",
          onPress: () => void close.mutateAsync({ goal: goal!.publicKey, kind: "break" }).then(() => router.back(), () => undefined),
        },
      ],
    );
  }

  async function complete() {
    await close.mutateAsync({ goal: goal!.publicKey, kind: "complete" }).then(() => router.replace("/evolution"), () => undefined);
  }

  return (
    <Screen>
      <Header title="Goal" onBack={() => router.back()} />
      <View style={{ gap: space.xl }}>
        <Card style={{ gap: space.md }}>
          <Text style={type.title}>{g.name}</Text>
          <Text style={type.small}>Target: {formatUsdc(targetAmt)} USDC</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={[type.body, { flex: 1 }]}>{reached ? "Target reached!" : "You’re on track"}</Text>
            <Text style={type.heading}>{Math.floor(pct)}%</Text>
          </View>
          <ProgressBar value={pct} />
          <View style={{ flexDirection: "row" }}>
            <Stat label="Saved" value={formatUsdc(deposited)} />
            <Stat label="To go" value={formatUsdc(reached ? 0n : targetAmt - deposited)} />
          </View>
          <Text style={type.small}>{locked ? `Locked until ${formatDate(unlockAt)} (${formatUntil(unlockAt, now)} left)` : `Unlocked since ${formatDate(unlockAt)}`}</Text>
        </Card>

        <View style={{ gap: space.md }}>
          <Field
            label="Add savings (USDC)"
            placeholder="50"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            hint={balance.data !== undefined ? `Wallet: ${formatUsdc(balance.data)} USDC` : undefined}
            error={amountError}
          />
          {deposit.error ? <Banner tone="error">{deposit.error.message}</Banner> : null}
          <Button label="Deposit" icon="arrow-down" onPress={doDeposit} loading={deposit.isPending} disabled={!parsed || tooMuch} />
        </View>

        <View style={{ gap: space.md }}>
          {close.error ? <Banner tone="error">{close.error.message}</Banner> : null}
          {reached && !locked ? (
            <Button label="Complete goal & withdraw" icon="trophy" onPress={complete} loading={close.isPending} />
          ) : (
            <Text style={type.small}>
              {!reached ? "Reach your target" : "Wait for the unlock date"} to complete this goal and earn XP.
            </Text>
          )}
          <Button label="Break vault early" variant="danger" onPress={confirmBreak} disabled={close.isPending} />
        </View>
      </View>
    </Screen>
  );
}
