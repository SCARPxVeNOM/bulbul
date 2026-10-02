import { Ionicons } from "@expo/vector-icons";
import { getLocales } from "expo-localization";
import { PublicKey } from "@solana/web3.js";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, Pressable, Text, View } from "react-native";
import { Banner, Button, Card, ErrorState, Header, Loading, Screen } from "@/components/ui";
import { useChainAction, useChainConfig, useProfile } from "@/hooks/useBulbul";
import { REGIONS, regionName } from "@/lib/regions";
import { colors, radius, space, type } from "@/theme";

function deviceRegion(): string {
  const code = getLocales()[0]?.regionCode?.toUpperCase();
  return code && REGIONS.some((r) => r.code === code) ? code : "IN";
}

export default function Onboarding() {
  const profile = useProfile();
  const config = useChainConfig();
  const [region, setRegion] = useState(deviceRegion);
  const [picking, setPicking] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const hatch = useChainAction(async (a, needsProfile: boolean) => {
    const companion = await a.mintCompanion();
    const ixs = needsProfile ? [...(await a.initProfile(region)), ...companion.ixs] : companion.ixs;
    return { ixs, signers: companion.signers };
  });

  // Android back closes the picker instead of leaving onboarding.
  useEffect(() => {
    if (!picking) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setPicking(false);
      return true;
    });
    return () => sub.remove();
  }, [picking]);

  const restricted = useMemo(() => config.data?.restrictedRegions.includes(region) ?? false, [config.data, region]);

  if (profile.isPending || config.isPending) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (config.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState error={config.error} onRetry={() => void config.refetch()} />
      </Screen>
    );
  }

  if (profile.data && !profile.data.companion.equals(PublicKey.default)) return <Redirect href="/home" />;

  const needsProfile = !profile.data;
  const lockedRegion = profile.data ? String.fromCharCode(...profile.data.region) : null;

  async function submit() {
    await hatch.mutateAsync(needsProfile).then(() => router.replace("/"), () => undefined);
  }

  if (picking) {
    return (
      <Screen scroll={false}>
        <Header title="Where do you live?" onBack={() => setPicking(false)} />
        <FlatList
          data={REGIONS}
          keyExtractor={(r) => r.code}
          contentContainerStyle={{ gap: space.sm, paddingBottom: space.xxl }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setRegion(item.code);
                setPicking(false);
              }}
              style={{
                padding: space.lg,
                borderRadius: radius.md,
                backgroundColor: item.code === region ? "rgba(167,139,250,0.25)" : colors.surface,
                borderWidth: 1,
                borderColor: item.code === region ? colors.accent : colors.border,
              }}
            >
              <Text style={type.body}>{item.name}</Text>
            </Pressable>
          )}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space.xl, paddingTop: space.xxl }}>
        <View style={{ gap: space.sm }}>
          <Text style={type.title}>Hatch your companion</Text>
          <Text style={type.body}>
            It’s soulbound to your wallet and evolves only through commitments recorded on-chain. You can’t edit it by
            hand, and neither can anyone else.
          </Text>
        </View>

        {needsProfile ? (
          <Card style={{ gap: space.md }}>
            <Text style={type.label}>Your region</Text>
            <Pressable
              onPress={() => setPicking(true)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              accessibilityRole="button"
            >
              <Text style={type.heading}>{regionName(region)}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
            </Pressable>
            <Text style={type.small}>
              This is permanent. It decides which commitment options are available where you live.
              {restricted
                ? " In your region, missed stakes go back to you (Soft) or to charity. Never to other people."
                : ""}
            </Text>
          </Card>
        ) : (
          <Banner>Region: {regionName(lockedRegion ?? "")}. Your profile exists; let’s hatch your companion.</Banner>
        )}

        <Card style={{ gap: space.md }}>
          <Text style={type.heading}>Savings commitments, not betting</Text>
          <Text style={type.body}>
            • Goal vaults hold your own USDC until you reach your goal. You can always break a vault and take your money
            back.{"\n"}• Habit stakes are promises to yourself. Keep them and your stake comes back, plus XP for your
            companion.{"\n"}• Miss one and the stake follows the rule you chose: back to you, to charity, or (where
            allowed) to people who kept theirs.{"\n"}• Focus check-ins are verified by bulbul’s attestor service, which
            can only confirm check-ins and never move your funds.
          </Text>
          <Pressable
            onPress={() => setAccepted((v) => !v)}
            style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
          >
            <Ionicons name={accepted ? "checkbox" : "square-outline"} size={24} color={colors.accent} />
            <Text style={[type.body, { flex: 1, color: colors.text }]}>I understand how bulbul works</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/terms")} accessibilityRole="link">
            <Text style={[type.small, { color: colors.accent }]}>Read the full terms</Text>
          </Pressable>
        </Card>

        {hatch.error ? <Banner tone="error">{hatch.error.message}</Banner> : null}
        <Button
          label={needsProfile ? "Create profile & hatch" : "Hatch companion"}
          icon="sparkles"
          onPress={submit}
          loading={hatch.isPending}
          disabled={!accepted}
        />
      </View>
    </Screen>
  );
}
