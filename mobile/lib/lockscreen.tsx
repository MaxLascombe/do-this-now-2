import { useAuth } from "@clerk/clerk-expo";
import { useSelection } from "@dtn/shared/queries";
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

  // when the selection empties, end the activity locally instead of waiting on the APNs end push
  const selection = useSelection();
  const selectedTaskId = selection.data?.selectedTaskId ?? null;
  const selectionLoaded = selection.data !== undefined;
  useEffect(() => {
    if (Platform.OS !== "ios" || selectedTaskId || !selectionLoaded) return;
    if (typeof LockScreenBridge?.endAllActivities === "function") {
      void LockScreenBridge.endAllActivities();
    }
  }, [selectionLoaded, selectedTaskId]);

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
