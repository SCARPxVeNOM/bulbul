import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { useEffect, useState, type ReactNode } from "react";
import { Loading, Screen } from "./ui";

/**
 * The wallet provider restores the cached authorization asynchronously and doesn't
 * expose when it's done. Await the same (idempotent) cache read here so routing never
 * runs against a "no wallet" state that is only "not loaded yet".
 */
export function WalletHydration({ children }: { children: ReactNode }) {
  const { store } = useMobileWallet();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    store
      .fetch()
      .catch(() => null)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [store]);

  if (!ready) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  return <>{children}</>;
}
