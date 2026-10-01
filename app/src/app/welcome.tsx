import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Companion } from "@/components/Companion";
import { Banner, Button, Screen } from "@/components/ui";
import { colors, space, type } from "@/theme";

export default function Welcome() {
  const { connect } = useMobileWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      await connect();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't connect to a wallet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: "space-between", paddingTop: space.xxl }}>
        <View style={{ gap: space.md }}>
          <Text style={[type.hero, { fontSize: 44, color: colors.glow }]}>bulbul</Text>
          <Text style={[type.body, { fontSize: 17 }]}>More than a tracker.{"\n"}A companion for your journey.</Text>
        </View>
        <Companion stage="curious" size={260} />
        <View style={{ gap: space.lg, paddingBottom: space.xl }}>
          <Text style={type.small}>
            Your companion grows only from commitments you actually keep, saved and verified on Solana.
          </Text>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Button label="Let’s begin" icon="arrow-forward" onPress={begin} loading={busy} />
          <Text style={[type.small, { textAlign: "center" }]}>You’ll connect a Solana wallet on this phone.</Text>
        </View>
      </View>
    </Screen>
  );
}
