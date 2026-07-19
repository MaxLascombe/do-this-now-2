import { useAuth } from "@clerk/clerk-expo";
import { useSelection, useTask } from "@dtn/shared/queries";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { Platform } from "react-native";

import LockScreenBridge from "../modules/lock-screen-bridge";

const DEVICE_TOKEN_KEY = "dtn.lockscreen.deviceToken";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

// Set once this build can mirror the Live Activity locally. The API client
// sends it as X-Lockscreen-Device so the server skips this device's
// push-to-start (which would duplicate the locally-started activity).
let localSyncDeviceToken: string | null = null;
export const getLockScreenDeviceToken = () => localSyncDeviceToken;

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

  // Local-first mirror: every action that can change the lock screen
  // (select, timer start/pause/adjust, edits, task switch) lands in the
  // query cache optimistically, so deriving the state here and pushing it
  // straight into the Live Activity makes the lock screen react instantly.
  // The server's APNs sync stays as the cross-device/backup path; it skips
  // this device's push-to-start via the X-Lockscreen-Device header.
  const selected = useTask(selectedTaskId ?? "").data ?? null;
  const keeper = useTask(selected?.timekeeperId ?? "").data ?? null;
  const timerTask = selected?.timekeeperId ? keeper : selected;
  const stateJson =
    selectedTaskId && selected && timerTask
      ? JSON.stringify({
          taskId: selected.id,
          title: selected.title,
          emoji: selected.emoji,
          running: timerTask.timerStartedAt != null,
          startedAtEpoch: timerTask.timerStartedAt
            ? new Date(timerTask.timerStartedAt).getTime() / 1000
            : null,
          accumulatedSeconds: timerTask.timerAccumulatedSeconds,
          targetMinutes: Math.ceil(timerTask.timeFrame),
        })
      : null;
  useEffect(() => {
    if (Platform.OS !== "ios" || !stateJson) return;
    if (typeof LockScreenBridge?.syncActivity === "function") {
      void LockScreenBridge.syncActivity(stateJson);
    }
  }, [stateJson]);

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
      // Only claim local-sync capability when this build actually has it —
      // otherwise the server must keep push-to-starting this device.
      if (typeof bridge.syncActivity === "function") {
        localSyncDeviceToken = deviceToken;
      }
    };

    void setup();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);
}
