import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Companion } from "@/components/Companion";
import { Bubble, Button, Card, ErrorState, Loading, ProgressBar } from "@/components/ui";
import { useCommitments, useGoals, useProfile } from "@/hooks/useBulbul";
import { useNow } from "@/hooks/useNow";
import { commitmentStatus } from "@/lib/commitments";
import { big, formatUsdc, percent } from "@/lib/format";
import { stageForXp, stageFromEnum } from "@/lib/stages";
import { colors, space, type } from "@/theme";

function greeting(hour: number) {
  if (hour < 5) return { text: "Still up?", icon: "moon" as const };
  if (hour < 12) return { text: "Good morning", icon: "sunny" as const };
  if (hour < 17) return { text: "Good afternoon", icon: "partly-sunny" as const };
  return { text: "Good evening", icon: "moon" as const };
}

export default function Home() {
  const profile = useProfile();
  const goals = useGoals();
  const commitments = useCommitments();
  const now = useNow();
  const refreshing = profile.isRefetching || goals.isRefetching || commitments.isRefetching;
  const refresh = () => {
    void profile.refetch();
    void goals.refetch();
    void commitments.refetch();
  };

  const hello = greeting(new Date().getHours());
  const p = profile.data;
  const shownStage = p ? stageFromEnum(p.companionStage) : null;
  const earnedStage = p ? stageForXp(p.xp.toNumber()) : null;
  const canEvolve = !!shownStage && !!earnedStage && earnedStage.minXp > shownStage.minXp;

  const statuses = (commitments.data ?? []).map((c) => ({ c, s: commitmentStatus(c.account, now) }));
  const toSettle = statuses.filter(({ s }) => s.state !== "active");
  const missed = statuses.some(({ s }) => s.state === "missed");
  const kept = statuses.some(({ s }) => s.state === "succeeded");
  const dueToday = statuses.filter(({ s }) => s.state === "active" && !s.checkedInToday);

  const goalPct = (g: { account: { deposited: object; targetAmount: object } }) =>
    percent(big(g.account.deposited), big(g.account.targetAmount));
  const topGoal = [...(goals.data ?? [])].sort((a, b) => goalPct(b) - goalPct(a))[0];

  const line = kept
    ? "You kept your streak! Settle it to collect your stake."
    : missed
      ? "That one slipped. It’s okay, tomorrow’s a new day."
      : dueToday.length > 0
        ? `${dueToday.length === 1 ? "One focus check-in" : `${dueToday.length} focus check-ins`} waiting for today.`
        : (shownStage?.line ?? "");

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 140, gap: space.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        >
          <View style={{ alignItems: "center", paddingTop: space.xl, gap: space.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Ionicons name={hello.icon} size={22} color={colors.warning} />
              <Text style={type.title}>{hello.text}</Text>
            </View>
            <Text style={type.small}>Ready for a great day?</Text>
          </View>

          {profile.isPending ? (
            <Loading />
          ) : profile.isError ? (
            <ErrorState error={profile.error} onRetry={refresh} />
          ) : shownStage ? (
            <View style={{ gap: space.lg }}>
              {line ? <Bubble>{line}</Bubble> : null}
              <Companion stage={shownStage.key} />
              <Text style={[type.small, { textAlign: "center" }]}>
                {shownStage.name} · {p!.xp.toString()} XP
              </Text>
              {canEvolve ? (
                <Button label={`Evolve to ${earnedStage!.name}`} icon="sparkles" onPress={() => router.push("/evolution")} />
              ) : null}
            </View>
          ) : null}

          {toSettle.length > 0 ? (
            <Card style={{ gap: space.sm }}>
              <Text style={type.heading}>Ready to settle</Text>
              <Text style={type.body}>
                {toSettle.length === 1 ? "A habit stake has" : `${toSettle.length} habit stakes have`} finished. Settle to
                release the stake and record the result.
              </Text>
              <Button label="Review" variant="secondary" onPress={() => router.push("/focus")} />
            </Card>
          ) : null}

          <Pressable onPress={() => router.push(topGoal ? `/goal/${topGoal.publicKey.toBase58()}` : "/goal/new")}>
            <Card style={{ gap: space.md }}>
              <Text style={type.label}>Goal</Text>
              {topGoal ? (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={type.heading}>{topGoal.account.name}</Text>
                    <Text style={type.heading}>{Math.floor(goalPct(topGoal))}%</Text>
                  </View>
                  <ProgressBar value={goalPct(topGoal)} />
                  <Text style={type.small}>
                    {formatUsdc(big(topGoal.account.deposited))} of {formatUsdc(big(topGoal.account.targetAmount))} USDC saved
                  </Text>
                </>
              ) : (
                <Text style={type.body}>Start a goal vault. Lock savings toward something you want.</Text>
              )}
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push("/focus")}>
            <Card style={{ gap: space.sm }}>
              <Text style={type.label}>Focus</Text>
              <Text style={type.body}>
                {statuses.length === 0
                  ? "Stake on a focus habit, e.g. 2 hours of deep work for 5 days."
                  : dueToday.length > 0
                    ? `${dueToday.length} check-in${dueToday.length > 1 ? "s" : ""} left today.`
                    : "All caught up for today."}
              </Text>
            </Card>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
