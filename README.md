# explain_back_back

Monorepo (bun workspaces):

- `apps/backend` — Express API (Clerk auth, Prisma + Supabase Postgres)
- `apps/mobile` — Expo app (Expo Router, Clerk)

## Setup

Prerequisites:

- [Bun](https://bun.sh)
- Android: [Android Studio](https://developer.android.com/studio) with the Android SDK, `ANDROID_HOME`
  set (e.g. `~/Android/Sdk`), and `platform-tools` / `emulator` on your `PATH`
- iOS (macOS only): Xcode

```bash
bun install                                   # from the repository root

cp apps/backend/.env.example apps/backend/.env       # fill in Clerk keys + DATABASE_URL
cp apps/mobile/.env.example  apps/mobile/.env.local  # fill in Clerk publishable key + API URL

# Generate the Prisma client (src/generated/prisma is gitignored)
cd apps/backend && bunx prisma generate --config prisma7.config.ts && cd ../..
```

## Run

All commands below run from the repository root.

| Command | What it starts |
|---|---|
| `bun run dev:android` | Backend + Metro, opens the app on the connected Android device/emulator |
| `bun run dev:ios` | Backend + Metro, opens the app on the iOS simulator |
| `bun run dev:all` | Backend + Metro only (open the app yourself: dev build, or `w` for web) |
| `bun run backend` | Backend only (`http://localhost:3000`) |
| `bun run android` / `bun run ios` | Metro only, opening the app on Android / iOS (**does not build**) |
| `bun run start:mobile` | Metro only (`expo start`) |
| `bun run typecheck:backend` | Type-check the backend |

The `android` / `ios` scripts above only *start* the app. They need a development build already
installed (see below). Inside `apps/mobile`, `bun run android` / `bun run ios` mean something
different: they **build** the native app.

## Development build (first time only)

The app uses native modules (`@clerk/expo`, `expo-dev-client`), so it does **not** run in Expo Go.
Build and install a [development build](https://docs.expo.dev/develop/development-builds/introduction/)
once, and again whenever native dependencies or `app.json` plugins change:

```bash
bun run --filter @explain-it-back/mobile android   # = expo run:android in apps/mobile
bun run --filter @explain-it-back/mobile ios       # = expo run:ios (macOS only)
```

The `android/` and `ios/` directories are gitignored, so the first run generates them (prebuild).
With several Android devices connected, pick one from the prompt or pass `--device <name>`
(`cd apps/mobile && bunx expo run:android --device <AVD_NAME>`).

To start an Android emulator:

```bash
emulator -list-avds        # list available AVDs
emulator -avd <AVD_NAME>   # or Android Studio > Device Manager
adb devices                # should list the emulator, e.g. "emulator-5554  device"
```

## Reaching the backend from a device

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` for where the app runs:

| App runs on | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:3000` or `http://localhost:3000` |
| Android physical device | `http://localhost:3000` |
| iOS simulator / web | `http://localhost:3000` |

`bun run android` and `bun run dev:android` run `adb reverse tcp:3000 tcp:3000` first, so
`localhost:3000` on an Android device or emulator reaches the backend on your machine. The forwarding
is lost when the device reconnects; re-run the script.
(`10.0.2.2` exists only inside the Android emulator, not on a physical phone.)

Web additionally needs CORS on the backend (not configured yet).

## Troubleshooting

- Env var changes are not picked up: `EXPO_PUBLIC_*` values are inlined at bundle time, so restart
  Metro with a cleared cache: `cd apps/mobile && bunx expo start --clear`.
- Native build is broken or out of date: `cd apps/mobile && bunx expo prebuild --clean -p android`,
  then build again.
- Backend fails with a missing `generated/prisma` module: run the `prisma generate` step in Setup.
