import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Orb } from "@/components/ui";
import { useWalletAddress } from "@/hooks/useBulbul";
import { colors, radius, space } from "@/theme";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  goals: "wallet-outline",
  evolution: "sparkles-outline",
  profile: "person-outline",
};

function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const goTo = (index: number) => {
    const route = state.routes[index]!;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name);
  };
  const focusIndex = state.routes.findIndex((r) => r.name === "focus");
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + space.sm }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key]?.options.title ?? route.name;
          const go = () => goTo(index);
          // The orb is drawn above the bar (outside its clipped, rounded bounds); keep its slot.
          if (route.name === "focus") return <View key={route.key} style={styles.orbSlot} />;
          return (
            <Pressable
              key={route.key}
              onPress={go}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
            >
              <Ionicons name={ICONS[route.name] ?? "ellipse-outline"} size={22} color={focused ? colors.glow : colors.textMuted} />
              <Text style={[styles.label, focused && { color: colors.glow }]}>{label}</Text>
            </Pressable>
          );
        })}
      </BlurView>
      <View style={[styles.orb, { bottom: insets.bottom + space.sm + 18 }]} pointerEvents="box-none">
        <Orb label="Focus" size={56} onPress={() => goTo(focusIndex)} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const wallet = useWalletAddress();
  if (!wallet) return <Redirect href="/welcome" />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="goals" options={{ title: "Goals" }} />
      <Tabs.Screen name="focus" options={{ title: "Focus" }} />
      <Tabs.Screen name="evolution" options={{ title: "Evolve" }} />
      <Tabs.Screen name="profile" options={{ title: "You" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    paddingVertical: space.sm,
    backgroundColor: "rgba(17,14,40,0.6)",
  },
  item: { flex: 1, alignItems: "center", gap: 2, paddingVertical: space.xs },
  orbSlot: { flex: 1 },
  orb: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  label: { fontSize: 11, color: colors.textMuted },
});
