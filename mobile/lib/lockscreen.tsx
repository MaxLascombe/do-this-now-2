import { useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { Platform } from "react-native";

import LockScreenBridge from "../modules/lock-screen-bridge";

const DEVICE_TOKEN_KEY = "dtn.lockscreen.deviceToken";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

// Wires this phone up as a Lock Screen Timer device (ADR-0004):
// 1. Once per install, trade a Clerk-authed request for the long-lived
//    device token, and park it (plus the API base URL) in the shared App
//    Group so the widget's Pause/Resume can call the server directly.
// 2. Stream ActivityKit push tokens (device-wide push-to-start + the
//    per-activity update token) to the server, which drives the activity
//    remotely via APNs whenever selection/timer state changes anywhere.
export function useLockScreenSync() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (Platform.OS !== "ios" || !isSignedIn) return;
    if (!LockScreenBridge || !LockScreenBridge.isSupported()) return;
    const bridge = LockScreenBridge;

    let cancelled = false;
    const subs: { remove: () => void }[] = [];

    const registerPushToken = (
      deviceToken: string,
      kind: "start" | "update",
      token: string,
    ) => {
      void fetch(`${BASE_URL}/api/lockscreen/push-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({ kind, token }),
      }).catch(() => {
        // Transient network failure — ActivityKit re-emits tokens on the
        // next app launch, so a missed registration self-heals.
      });
    };

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
      const token = deviceToken;
      subs.push(
        bridge.addListener("onPushToStartToken", ({ token: t }) =>
          registerPushToken(token, "start", t),
        ),
        bridge.addListener("onActivityUpdateToken", ({ token: t }) =>
          registerPushToken(token, "update", t),
        ),
      );
    };

    void setup();
    return () => {
      cancelled = true;
      subs.forEach((s) => s.remove());
    };
  }, [isSignedIn, getToken]);
}
