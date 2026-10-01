import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { Companion } from "@/components/Companion";
import { Banner, Bubble, Button, Header, Loading, ProgressBar, Screen } from "@/components/ui";
import { keys, useCommitments, useFocusApi, useProfile, useWalletAddress } from "@/hooks/useBulbul";
import type { FocusSession } from "@/lib/api";
import { commitmentStatus } from "@/lib/commitments";
import { formatDuration } from "@/lib/format";
import { stageFromEnum } from "@/lib/stages";
import { colors, space, type } from "@/theme";

function KeepAwake() {
  useKeepAwake();
  return null;
}

const OUTCOME: Partial<Record<FocusSession["status"], { tone: "success" | "error" | "warning"; text: string }>> = {
  attested: { tone: "success", text: "Checked in on-chain. Your companion felt that. 💙" },
  too_short: { tone: "warning", text: "Ended before the goal time, so this session didn’t count. Try again when you’re ready." },
  broken: { tone: "error", text: "Focus was interrupted (the app was closed or in the background too long). Start again when you’re ready." },
  cancelled: { tone: "warning", text: "Session cancelled." },
  attest_failed: { tone: "error", text: "Your focus counted, but recording it on-chain failed. Retry below." },
};

export default function FocusSessionScreen() {
  const { id: commitment } = useLocalSearchParams<{ id: string }>();
  const api = useFocusApi();
  const wallet = useWalletAddress();
  const profile = useProfile();
  const commitments = useCommitments();
  const qc = useQueryClient();

  const [session, setSession] = useState<FocusSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Server-reported elapsed at the last heartbeat, plus the local clock since then.
  const [baseElapsed, setBaseElapsed] = useState(() => ({ seconds: 0, at: Date.now() }));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const sessionRef = useRef<FocusSession | null>(null);

  const apply = useCallback((s: FocusSession) => {
    sessionRef.current = s;
    setSession(s);
    setBaseElapsed({ seconds: s.elapsed_seconds, at: Date.now() });
    if (s.status === "attested") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: keys.commitments(wallet?.toBase58() ?? "") });
    }
  }, [qc, wallet]);

  const run = useCallback(async (fn: () => Promise<FocusSession | null>) => {
    setBusy(true);
    setError(null);
    try {
      const s = await fn();
      if (s) apply(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [apply]);

  // Resume a live session for this commitment, if there is one.
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api
      .active()
      .then((s) => {
        if (!cancelled && s && s.commitment === commitment) apply(s);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn’t reach the server"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, commitment, apply]);

  const live = session?.status === "active";
  const sessionId = session?.id;
  const heartbeatSeconds = session?.heartbeat_interval_seconds;

  // Heartbeats while live; one immediately on returning from the background.
  useEffect(() => {
    if (!api || !live || !sessionId || !heartbeatSeconds) return;
    const beat = () => {
      const current = sessionRef.current;
      if (current?.status !== "active") return;
      api.heartbeat(current.id).then(apply, (e) => setError(e instanceof Error ? e.message : "Heartbeat failed"));
    };
    const interval = setInterval(beat, heartbeatSeconds * 1000);
    const sub = AppState.addEventListener("change", (state) => state === "active" && beat());
    const clock = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
      sub.remove();
    };
  }, [api, live, sessionId, heartbeatSeconds, apply]);

  const record = commitments.data?.find((c) => c.publicKey.toBase58() === commitment);
  const status = record ? commitmentStatus(record.account, nowMs) : null;
  const stage = profile.data ? stageFromEnum(profile.data.companionStage) : null;
  const required = (session?.required_seconds ?? (record?.account.focusMinutes ?? 0) * 60);
  const elapsed = live
    ? baseElapsed.seconds + Math.max(0, Math.floor((nowMs - baseElapsed.at) / 1000))
    : (session?.elapsed_seconds ?? 0);
  const done = elapsed >= required && required > 0;
  const outcome = session ? OUTCOME[session.status] : undefined;

  return (
    <Screen>
      {live ? <KeepAwake /> : null}
      <Header title="Focus time" onBack={() => router.back()} right={<Text style={type.heading}>{formatDuration(elapsed)}</Text>} />
      {loading || commitments.isPending ? (
        <Loading />
      ) : !record ? (
        <Banner>This stake has been settled.</Banner>
      ) : (
        <View style={{ gap: space.xl }}>
          {live ? (
            <Bubble>
              {done
                ? "Goal time reached! Finish to check in."
                : `You’ve been in deep focus for ${formatDuration(elapsed)}. Keep it up 💙`}
            </Bubble>
          ) : null}
          {stage ? <Companion stage={stage.key} size={200} /> : null}
          <View style={{ gap: space.sm }}>
            <ProgressBar value={required ? (elapsed / required) * 100 : 0} />
            <Text style={type.small}>
              {formatDuration(Math.min(elapsed, required))} of {formatDuration(required)} · day {(status?.dayIndex ?? 0) + 1} of{" "}
              {record.account.periodDays}
            </Text>
          </View>

          {outcome ? <Banner tone={outcome.tone}>{outcome.text}</Banner> : null}
          {session?.status === "attest_failed" && session.error ? <Text style={type.small}>{session.error}</Text> : null}
          {error ? <Banner tone="error">{error}</Banner> : null}

          {live ? (
            <View style={{ gap: space.md }}>
              <Text style={[type.small, { color: colors.warning }]}>
                Stay on this screen. Leaving it, or the app, for more than about a minute ends the session.
              </Text>
              <Button label={done ? "Finish & check in" : "Keep going…"} icon="checkmark" onPress={() => void run(() => api!.finish(session!.id))} loading={busy} disabled={!done} />
              <Button label="Cancel session" variant="secondary" onPress={() => void run(() => api!.cancel(session!.id))} disabled={busy} />
            </View>
          ) : session?.status === "attest_failed" ? (
            <Button label="Retry check-in" icon="refresh" onPress={() => void run(() => api!.retry(session.id))} loading={busy} />
          ) : session?.status === "attested" || status?.checkedInToday ? (
            <Button label="Done" onPress={() => router.back()} />
          ) : status?.state === "active" ? (
            <Button label="Start focus" icon="play" onPress={() => void run(() => api!.start(commitment!))} loading={busy} disabled={!api} />
          ) : (
            <Banner>This stake has finished. Settle it from the Focus tab.</Banner>
          )}
        </View>
      )}
    </Screen>
  );
}
