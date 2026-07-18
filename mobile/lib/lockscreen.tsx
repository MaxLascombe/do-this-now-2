import { useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { Platform } from "react-native";

import LockScreenBridge from "../modules/lock-screen-bridge";

const DEVICE_TOKEN_KEY = "dtn.lockscreen.deviceToken";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

// Wires this phone up as a Lock Screen Timer device (ADR-0004): once per
// install, trade a Clerk-authed request for the long-lived device token,
// park it (plus the API base URL) in the shared App Group so the widget's
// Pause/Resume and the native token sync can call the server, then kick
// the sync. ActivityKit token registration itself is native and
// launch-driven (LockScreenTokenSync) — it must also run on background
// launches where JS never starts.
export function useLockScreenSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (Platform.OS !== "ios" || !isSignedIn) return;
    if (!LockScreenBridge || !LockScreenBridge.isSupported()) return;
    const bridge = LockScreenBridge;

    let cancelled = false;

    const setup = async () => {
      let deviceToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
      if (!deviceToken) {
        const clerkToken = await getToken();
        if (!clerkToken || cancelled) return;
        const res = await fetch(`${BASE_URL}/api/lockscreen/device`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkToken}`,
          },
          body: JSON.stringify({ label: "iPhone" }),
        }).catch(() => null);
        if (!res?.ok) return;
        const issued = (await res.json()) as { token: string };
        deviceToken = issued.token;
        await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, deviceToken);
      }
      if (cancelled) return;

      bridge.setConfig(BASE_URL, deviceToken);
      bridge.startSync();
    };

    void setup();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);
}
