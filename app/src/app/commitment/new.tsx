import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner, Button, Card, Chips, Field, Header, Loading, Screen } from "@/components/ui";
import { useChainAction, useChainConfig, useProfile, useUsdcBalance } from "@/hooks/useBulbul";
import type { ForfeitMode } from "@/lib/actions";
import { MODE_COPY } from "@/lib/commitments";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { regionName } from "@/lib/regions";
import { colors, radius, space, type } from "@/theme";

const MINUTES = [30, 60, 120, 180] as const;
const PERIODS = [3, 5, 7, 14, 30] as const;
const MODES: ForfeitMode[] = ["soft", "charity", "pool"];
const MIN_STAKE = 1_000_000n;

/** Every day count for short periods; for longer ones, multiples of 5 plus ~70% and "all". */
function requiredChoices(period: number): number[] {
  if (period <= 7) return Array.from({ length: period }, (_, i) => i + 1);
  const picks = new Set([1, Math.ceil(period * 0.7), period]);
  for (let n = 5; n < period; n += 5) picks.add(n);
  return [...picks].sort((a, b) => a - b);
}

export default function NewCommitment() {
  const profile = useProfile();
  const config = useChainConfig();
  const balance = useUsdcBalance();
  const [minutes, setMinutes] = useState<(typeof MINUTES)[number]>(120);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7);
  const [requiredPick, setRequired] = useState(5);
  const [stake, setStake] = useState("10");
  const [modePick, setMode] = useState<ForfeitMode>("charity");

  const region = profile.data ? String.fromCharCode(...profile.data.region) : null;
  const poolAllowed = !!region && !!config.data && !config.data.restrictedRegions.includes(region);
  const required = Math.min(requiredPick, period);
  const mode: ForfeitMode = modePick === "pool" && !poolAllowed ? "charity" : modePick;

  const create = useChainAction(
    (a, v: { commitmentId: number; stake: bigint; focusMinutes: number; requiredCheckins: number; periodDays: number; mode: ForfeitMode }) =>
      a.createCommitment(v),
  );

  const stakeAmt = parseUsdc(stake);
  const tooMuch = stakeAmt !== null && balance.data !== undefined && stakeAmt > balance.data;
  const stakeError =
    stake.length > 0 && (stakeAmt === null || stakeAmt < MIN_STAKE)
      ? "Stake at least 1 USDC"
      : tooMuch
        ? "More than your wallet balance"
        : null;
  const valid = stakeAmt !== null && stakeAmt >= MIN_STAKE && !tooMuch && required >= 1 && required <= period;

  async function submit() {
    if (!valid || !profile.data) return;
    await create
      .mutateAsync({
        commitmentId: profile.data.commitmentsCreated,
        stake: stakeAmt!,
        focusMinutes: minutes,
        requiredCheckins: required,
        periodDays: period,
        mode,
      })
      .then(() => router.back(), () => undefined);
  }

  const requiredOptions = requiredChoices(period);

  return (
    <Screen>
      <Header title="New habit stake" onBack={() => router.back()} />
      {profile.isPending || config.isPending ? (
        <Loading />
      ) : (
        <View style={{ gap: space.xl }}>
          <View style={{ gap: space.sm }}>
            <Text style={type.label}>Deep focus per day</Text>
            <Chips options={MINUTES} value={minutes} onChange={setMinutes} format={(m) => (m >= 60 ? `${m / 60} h` : `${m} min`)} />
            <Text style={type.small}>One continuous session in the app counts as a check-in.</Text>
          </View>
          <View style={{ gap: space.sm }}>
            <Text style={type.label}>Over the next</Text>
            <Chips options={PERIODS} value={period} onChange={setPeriod} format={(d) => `${d} days`} />
          </View>
          <View style={{ gap: space.sm }}>
            <Text style={type.label}>Days you’ll keep it</Text>
            <Chips options={requiredOptions} value={required} onChange={setRequired} format={(n) => `${n}`} />
            <Text style={type.small}>
              {required} of {period} days. Leaving room for a bad day is fine.
            </Text>
          </View>
          <Field
            label="Stake (USDC)"
            keyboardType="decimal-pad"
            value={stake}
            onChangeText={setStake}
            hint={balance.data !== undefined ? `Wallet: ${formatUsdc(balance.data)} USDC` : undefined}
            error={stakeError}
          />
          <View style={{ gap: space.sm }}>
            <Text style={type.label}>If you miss it</Text>
            {MODES.map((m) => {
              const disabled = m === "pool" && !poolAllowed;
              const selected = m === mode;
              return (
                <Pressable
                  key={m}
                  onPress={() => !disabled && setMode(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                  style={{
                    padding: space.lg,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? "rgba(167,139,250,0.18)" : colors.surface,
                    opacity: disabled ? 0.4 : 1,
                    gap: 4,
                  }}
                >
                  <Text style={type.heading}>{MODE_COPY[m].title}</Text>
                  <Text style={type.small}>
                    {disabled ? `Not available in ${regionName(region ?? "")}.` : MODE_COPY[m].detail}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Card>
            <Text style={type.body}>
              This is a savings commitment, not a bet. Your {stakeAmt ? formatUsdc(stakeAmt) : ""} USDC is held by the bulbul
              program, not by us, and comes back when you keep the habit.
            </Text>
          </Card>
          {config.data?.paused ? <Banner tone="warning">New stakes are paused right now.</Banner> : null}
          {create.error ? <Banner tone="error">{create.error.message}</Banner> : null}
          <Button label="Stake & commit" icon="flame" onPress={submit} loading={create.isPending} disabled={!valid || config.data?.paused} />
        </View>
      )}
    </Screen>
  );
}
