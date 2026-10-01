import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, space, type } from "@/theme";

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const content = padded ? { paddingHorizontal: space.xl, paddingBottom: 120 } : undefined;
  return (
    <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={StyleSheet.absoluteFill}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, content]}>{children}</View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
      <Text style={type.heading}>{title}</Text>
      <View style={{ minWidth: 24, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ value, color = colors.teal }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <LinearGradient
        colors={[color, colors.tealDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { width: `${pct}%` }]}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const inactive = disabled || loading;
  const inner = (
    <View style={styles.buttonInner}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={colors.text} /> : null}
          <Text style={styles.buttonLabel}>{label}</Text>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [{ opacity: inactive ? 0.45 : pressed ? 0.85 : 1 }]}
    >
      {variant === "primary" ? (
        <LinearGradient colors={[colors.accent, colors.accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.button, variant === "danger" ? styles.buttonDanger : styles.buttonSecondary]}>{inner}</View>
      )}
    </Pressable>
  );
}

export function Orb({ onPress, size = 64, label }: { onPress?: () => void; size?: number; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      <View style={[styles.orbGlow, { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 }]}>
        <LinearGradient
          colors={["#F5F3FF", colors.accent, colors.accentDeep]}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.8, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" }}
        />
      </View>
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
        {...props}
      />
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={type.small}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
  disabled,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  disabled?: (v: T) => boolean;
}) {
  return (
    <View style={styles.chips}>
      {options.map((opt) => {
        const selected = opt === value;
        const off = disabled?.(opt) ?? false;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => !off && onChange(opt)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: off }}
            style={[styles.chip, selected && styles.chipSelected, off && { opacity: 0.35 }]}
          >
            <Text style={[styles.chipLabel, selected && { color: colors.text }]}>{format(opt)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const color = { info: colors.accent, error: colors.danger, success: colors.success, warning: colors.warning }[tone];
  return (
    <View style={[styles.banner, { borderColor: color }]}>
      <Text style={[type.small, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

export function Bubble({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bubble}>
      <Text style={[type.body, { color: colors.text, textAlign: "center" }]}>{children}</Text>
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={type.label}>{label}</Text>
      <Text style={[type.heading, { fontVariant: ["tabular-nums"] }]}>{value}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: "center", gap: space.md }}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={type.small}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <Card style={{ gap: space.md }}>
      <Text style={[type.body, { color: colors.danger }]}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  button: { borderRadius: radius.pill, paddingVertical: 15, paddingHorizontal: space.xl },
  buttonSecondary: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: colors.danger },
  buttonInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, minHeight: 22 },
  buttonLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },
  orbGlow: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.25)",
    shadowColor: colors.glow,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: "rgba(167,139,250,0.28)", borderColor: colors.accent },
  chipLabel: { color: colors.textSoft, fontSize: 14, fontWeight: "500" },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: space.md, backgroundColor: colors.surface },
  bubble: {
    backgroundColor: "rgba(20,16,48,0.85)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignSelf: "center",
    maxWidth: 300,
  },
});
