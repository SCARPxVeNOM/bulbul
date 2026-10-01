import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Banner, Button, Card, Chips, Field, Header, Loading, Screen } from "@/components/ui";
import { useChainAction, useChainConfig, useProfile } from "@/hooks/useBulbul";
import { formatDate, formatUsdc, parseUsdc } from "@/lib/format";
import { space, type } from "@/theme";

const LOCK_DAYS = [7, 30, 90, 180, 365] as const;
const MAX_NAME_BYTES = 32;
const MIN_TARGET = 1_000_000n;

/** A minute of slack so the on-chain minimum lock still holds when the tx lands. */
function unlockAtFrom(nowMs: number, lockDays: number): number {
  return Math.floor(nowMs / 1000) + lockDays * 86_400 + 60;
}

export default function NewGoal() {
  const profile = useProfile();
  const config = useChainConfig();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [lockDays, setLockDays] = useState<(typeof LOCK_DAYS)[number]>(90);
  const [openedAt] = useState(() => Date.now());

  const create = useChainAction((a, v: { id: number; name: string; target: bigint; lockDays: number }) =>
    a.createGoal(v.id, v.name, v.target, unlockAtFrom(Date.now(), v.lockDays)),
  );

  const target = parseUsdc(amount);
  const nameBytes = new TextEncoder().encode(name.trim()).length;
  const nameError = name.length > 0 && (nameBytes === 0 || nameBytes > MAX_NAME_BYTES) ? "Use 1–32 characters" : null;
  const amountError =
    amount.length > 0 && (target === null || target < MIN_TARGET) ? "Enter at least 1 USDC (up to 6 decimals)" : null;
  const valid = nameBytes > 0 && nameBytes <= MAX_NAME_BYTES && target !== null && target >= MIN_TARGET;

  async function submit() {
    if (!valid || !profile.data) return;
    await create
      .mutateAsync({ id: profile.data.goalsCreated, name: name.trim(), target: target!, lockDays })
      .then(() => router.back(), () => undefined);
  }

  return (
    <Screen>
      <Header title="New goal" onBack={() => router.back()} />
      {profile.isPending || config.isPending ? (
        <Loading />
      ) : (
        <View style={{ gap: space.xl }}>
          <Field
            label="What are you saving for?"
            placeholder="iPhone 17 Pro"
            value={name}
            onChangeText={setName}
            maxLength={40}
            error={nameError}
          />
          <Field
            label="Target (USDC)"
            placeholder="1700"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            error={amountError}
          />
          <View style={{ gap: space.sm }}>
            <Text style={type.label}>Lock until</Text>
            <Chips options={LOCK_DAYS} value={lockDays} onChange={setLockDays} format={(d) => (d === 365 ? "1 year" : `${d} days`)} />
            <Text style={type.small}>Unlocks {formatDate(unlockAtFrom(openedAt, lockDays))}. Longer locks earn your companion more XP.</Text>
          </View>
          <Card style={{ gap: space.sm }}>
            <Text style={type.body}>
              Deposit any time. Once you reach {target ? formatUsdc(target) : "your target"} USDC and the lock date passes,
              complete the goal to get your money back and earn verified XP.
            </Text>
            <Text style={type.small}>You can break the vault early to get your money back, but without XP.</Text>
          </Card>
          {config.data?.paused ? <Banner tone="warning">New goals are paused right now.</Banner> : null}
          {create.error ? <Banner tone="error">{create.error.message}</Banner> : null}
          <Button label="Create vault" icon="lock-closed" onPress={submit} loading={create.isPending} disabled={!valid || config.data?.paused} />
        </View>
      )}
    </Screen>
  );
}
