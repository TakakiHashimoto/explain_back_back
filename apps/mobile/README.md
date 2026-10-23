# mobile

Expo app (Expo Router, Clerk) for explain_back_back.

Setup and run instructions live in the [root README](../../README.md).
Run commands from the repository root (e.g. `bun run dev:android`), not from this folder.

Reusable UI styles and web/native examples: [design system guide](../../docs/design/README.md).

## OneSignal push notifications

The iOS and Android development builds initialize OneSignal with App ID
`4ef89c9c-db70-4019-9b48-5cbd71f70e87`. All SDK calls live in
`src/features/notifications/onesignal.ts`, initialized by the root layout. Web and
Expo Go skip the native SDK. Identity, email/SMS, and tag methods are available in
the wrapper; they are not automatically connected to Clerk or enrolled on launch.

Dependencies are pinned to `react-native-onesignal` **5.5.15** and
`onesignal-expo-plugin` **2.7.2**, the approved Current releases from the
[official version manifest](https://onesignal.github.io/sdk-releases/releases.json)
(neither package had a Stable entry when integrated).

The first Expo config plugin generates the iOS Notification Service Extension,
shared App Group `group.com.anonymous.mobile.onesignal`, and push entitlements.
The extension targets iOS 17.0, matching the app's Clerk plugin requirement. Background remote notifications
are enabled in `app.json`. Both platform identifiers remain `com.anonymous.mobile`.
Android links the SDK automatically; no `google-services.json` is needed for OneSignal.

To verify from the repository root:

1. Configure APNs and FCM credentials in the OneSignal dashboard for this App ID.
   Use credentials matching the existing app identifiers. iOS device builds also
   need your Apple Developer Team and provisioning for the app and extension.
2. Generate native projects after this config change:
   `cd apps/mobile && bunx expo prebuild --no-install`, then return to the root.
   Native directories are generated and gitignored; keep configuration in `app.json`.
3. Rebuild and install with `bun run --filter @explain-it-back/mobile android`, or
   `bun run --filter @explain-it-back/mobile ios` on macOS with Xcode/CocoaPods.
   Use an Android device/emulator with Google Play Services or a supported iOS device.
   Install over the existing app; do not uninstall or clear app data to re-test.
4. A real server-assigned subscription ID displays the integration verification
   dialog once per app process. Tap **Got it** to request push permission. No
   permission request occurs automatically during initialization.
5. Find that subscription in OneSignal and send it a test push. For iOS, also test
   an image attachment to exercise the extension. Check that both signed targets
   share the App Group and the main app embeds the extension.

Before TestFlight/App Store builds, change both the plugin's `mode` and
`ios.entitlements["aps-environment"]` in `app.json` to `production`, then regenerate
and rebuild. Keep normal code signing enabled.

Local checks:

```sh
bun run --filter @explain-it-back/mobile typecheck
bun test apps/mobile/src/features/notifications/onesignal.test.ts
```

See the [OneSignal Expo setup](https://documentation.onesignal.com/docs/en/react-native-expo-sdk-setup)
for platform credentials and native build troubleshooting.
