import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MobileWalletProvider } from "@wallet-ui/react-native-web3js";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { WalletHydration } from "@/components/WalletHydration";
import { env } from "@/lib/env";
import { colors } from "@/theme";

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2, staleTime: 15_000, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MobileWalletProvider
        chain={env.chain}
        endpoint={env.rpcUrl}
        commitmentOrConfig="confirmed"
        identity={{ name: "bulbul", uri: env.appUrl, icon: "favicon.png" }}
      >
        <StatusBar style="light" />
        <WalletHydration>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBottom }, animation: "fade" }} />
        </WalletHydration>
      </MobileWalletProvider>
    </QueryClientProvider>
  );
}
