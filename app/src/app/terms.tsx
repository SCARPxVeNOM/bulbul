import { router } from "expo-router";
import { Text, View } from "react-native";
import { Card, Header, Screen } from "@/components/ui";
import { space, type } from "@/theme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Savings commitments, not betting",
    body:
      "bulbul helps you keep promises to yourself. Goal vaults hold your own USDC toward something you want, and habit stakes put a small amount behind a habit you choose. You never wager on outcomes you don’t control.",
  },
  {
    title: "Goal vaults",
    body:
      "Deposits sit in a vault controlled by the bulbul Solana program, not by bulbul the company. You can complete a goal after reaching the target and the unlock date, or break the vault at any time to take your money back. Breaking early earns no XP.",
  },
  {
    title: "Habit stakes",
    body:
      "Your stake is escrowed by the program for the period you pick. Keep the habit on enough days and your full stake comes back. If you miss it, the stake follows the rule you chose: Soft (it comes back to you), Charity (it’s donated), or Pool (it funds bonuses for people who kept theirs). Pool isn’t offered in every region.",
  },
  {
    title: "Your region",
    body:
      "You choose your region once, when you create your profile, and it can’t be changed. In regions where redistributing missed stakes to other people could be treated as gaming, Pool mode is turned off by the program itself.",
  },
  {
    title: "How focus is verified",
    body:
      "Focus sessions are timed by bulbul’s server while the app stays open. When a session meets your goal, bulbul’s attestor key records a check-in on-chain. This is a trust assumption: the attestor can only add check-ins. It can’t move your funds, change your stake rules, or edit your companion. Your session data stays off-chain; only “checked in on day N” is recorded.",
  },
  {
    title: "Your companion",
    body:
      "Your companion is a soulbound Metaplex Core asset. Only the bulbul program can update it, and only from XP earned by completed goals and kept streaks. It can’t be transferred or sold.",
  },
  {
    title: "Risks",
    body:
      "Smart contracts and wallets carry risk. Only stake amounts you’re comfortable locking. bulbul is not a bank and doesn’t offer financial advice.",
  },
];

export default function Terms() {
  return (
    <Screen>
      <Header title="How bulbul works" onBack={() => router.back()} />
      <View style={{ gap: space.lg }}>
        {SECTIONS.map((s) => (
          <Card key={s.title} style={{ gap: space.sm }}>
            <Text style={type.heading}>{s.title}</Text>
            <Text style={type.body}>{s.body}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
