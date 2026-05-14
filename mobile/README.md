# Mobile (Expo / React Native)

The Do This Now mobile client. Shares `@dtn/shared` with `web/` for queries,
types, and business logic; renders with React Native + NativeWind.

## Setup

```sh
# from repo root
pnpm install
cp mobile/.env.example mobile/.env
# fill in EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (same instance as web)
```

## Running in development

```sh
pnpm --filter mobile start
```

Metro serves on `http://localhost:8081`. To target an iOS Simulator:

```sh
xcrun simctl openurl booted "exp://127.0.0.1:8081"
```

Press `r` in the Expo CLI to reload, or hit `curl http://localhost:8081/reload`
from another terminal to broadcast a reload to every connected client.

## Installing on a real device

Three paths, easiest first.

### A. Expo Go (≈2 min, ephemeral)

Best for poking at the app over your normal dev loop. JS lives on your Mac;
your phone fetches the bundle from Metro over Wi-Fi.

1. Install **Expo Go** from the App Store on your phone.
2. Phone + this Mac on the **same Wi-Fi**.
3. Start Metro: `pnpm --filter mobile start`.
4. Find your Mac's LAN IP: `ipconfig getifaddr en0`.
5. On your phone, open Safari and tap `exp://<LAN_IP>:8081` (e.g.
   `exp://192.168.1.124:8081`). Expo Go opens the dev server.

Limits: requires Metro to be running; shows the Expo splash; can only use
native modules bundled into Expo Go's SDK build (no custom native code).

### B. Personal dev build (≈15 min first time, real app on home screen, 7-day expiry)

Compiles the native iOS binary with every package you depend on baked in,
sideloads it via Xcode. Works offline once installed.

Requires:

- **Xcode** installed (Mac App Store).
- An Apple ID (free tier is fine — provisioning expires every 7 days, so
  you'll need to rebuild weekly unless you have a paid Apple Developer
  Program account at $99/yr).
- iPhone plugged in via USB, unlocked, "Trust this computer" accepted.

Steps:

```sh
# from repo root
pnpm --filter mobile exec expo prebuild --platform ios
pnpm --filter mobile exec expo run:ios --device
```

The first run will prompt you to sign in to Xcode with your Apple ID for
code signing. Subsequent rebuilds skip that step.

To rebuild after JS changes only: nothing — the dev build still fetches the
JS bundle from Metro (just like Expo Go), but uses the custom native shell.
To pick up native dep changes: rerun `expo run:ios --device`.

### C. TestFlight (≈30 min first time, indistinguishable from an App Store install)

Real distribution via Apple's TestFlight pipeline. Use this when you want
the app on your home screen long-term, want to share it with friends, or
want builds that don't expire after 7 days.

Requires:

- Paid **Apple Developer Program** account ($99/yr).
- Free Expo account for EAS Build.
- An app record in App Store Connect (one-time setup).

Steps (rough — first time only):

```sh
# from repo root, sign in once:
pnpm --filter mobile exec eas login

# create eas.json if it doesn't exist:
pnpm --filter mobile exec eas build:configure

# kick off a TestFlight-ready build (cloud build ~20 min):
pnpm --filter mobile exec eas build --platform ios --profile preview

# submit the build to App Store Connect:
pnpm --filter mobile exec eas submit --platform ios
```

Then install **TestFlight** from the App Store on your phone, accept the
invite emailed by App Store Connect, and install Do This Now from there.

## Troubleshooting

### "Cannot read property 'useState' of null" / "Invalid hook call"

Two React copies in the bundle. Usually pnpm has resolved a transitive
package against a different react version. `mobile/metro.config.js` has a
`resolveRequest` hook that re-anchors `react`, `react-native`, and
`@tanstack/react-query*` to mobile's package root — if you see this error
on a new dep, add its name to that list.

### "Native module is null" / "Calling the 'constructor' function has failed"

Your JS package version doesn't match the native module compiled into Expo
Go (or the dev build). Look for the `expo start` startup warning that lists
"expected version: X" and pin to that:

```sh
pnpm --filter mobile add <package>@<expected-version>
```

Common offenders on SDK 54: `@react-native-async-storage/async-storage`,
`expo-audio`, `expo-haptics`.

### Stale bundle / "Unable to resolve …" after install

Clear Metro's cache:

```sh
pnpm --filter mobile start --clear
```

### Fonts (Instrument Serif + JetBrains Mono) not showing

Loaded by `_layout.tsx` via `useFonts` from `expo-font` (SDK-bundled) plus
the font assets from `@expo-google-fonts/instrument-serif` and
`@expo-google-fonts/jetbrains-mono`. If `<Text>` falls back to the system
default, check that the splash screen actually hid (font loading is
awaited before `SplashScreen.hideAsync()`).
