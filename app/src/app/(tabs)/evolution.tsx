import { PublicKey } from "@solana/web3.js";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Companion } from "@/components/Companion";
import { Banner, Button, Card, ErrorState, Loading, ProgressBar, Screen } from "@/components/ui";
import { useChainAction, useProfile } from "@/hooks/useBulbul";
import { nextStage, STAGES, stageForXp, stageFromEnum } from "@/lib/stages";
import { colors, radius, space, type } from "@/theme";

export default function Evolution() {
  const profile = useProfile();
  const evolve = useChainAction((a, asset: PublicKey) => a.evolveCompanion(asset));

  if (profile.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorState error={profile.error ?? new Error("No profile yet")} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }

  const p = profile.data;
  const xp = p.xp.toNumber();
  const shown = stageFromEnum(p.companionStage);
  const earned = stageForXp(xp);
  const next = nextStage(xp);
  const hasCompanion = !p.companion.equals(PublicKey.default);

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <View style={{ gap: space.xl, paddingTop: space.xl }}>
        <Text style={type.title}>Evolution</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {STAGES.map((s) => {
            const reached = xp >= s.minXp;
            const current = s.key === shown.key;
            return (
              <View key={s.key} style={{ alignItems: "center", gap: space.xs, flex: 1 }}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: radius.pill,
                    backgroundColor: reached ? colors.accent : "transparent",
                    borderWidth: 2,
                    borderColor: current ? colors.glow : colors.border,
                  }}
                />
                <Text style={[type.small, current && { color: colors.text, fontWeight: "600" }]}>{s.name}</Text>
                <Text style={[type.small, { fontSize: 11 }]}>{s.minXp} XP</Text>
              </View>
            );
          })}
        </View>

        <Companion stage={shown.key} />
        <Text style={[type.body, { textAlign: "center" }]}>Your actions shape who I become.</Text>

        <Card style={{ gap: space.md }}>
          <Text style={type.heading}>{xp} XP</Text>
          {next ? (
            <>
              <ProgressBar value={next.progress * 100} color={colors.accent} />
              <Text style={type.small}>
                {next.remaining} XP to {next.stage.name}. Complete goal vaults and keep focus streaks to earn verified XP.
              </Text>
            </>
          ) : (
            <Text style={type.small}>Legendary. Every XP here was earned on-chain.</Text>
          )}
        </Card>

        {evolve.error ? <Banner tone="error">{evolve.error.message}</Banner> : null}
        {!hasCompanion ? (
          <Button label="Hatch your companion" icon="egg" onPress={() => router.push("/onboarding")} />
        ) : earned.minXp > shown.minXp ? (
          <Button
            label={`Evolve to ${earned.name}`}
            icon="sparkles"
            onPress={() => void evolve.mutateAsync(p.companion).catch(() => undefined)}
            loading={evolve.isPending}
          />
        ) : (
          <Button
            label="Sync stats to companion"
            variant="secondary"
            icon="sync"
            onPress={() => void evolve.mutateAsync(p.companion).catch(() => undefined)}
            loading={evolve.isPending}
          />
        )}
      </View>
    </Screen>
  );
}
