# Socratic Precision with Tailwind

The shared design system lives in [globals.css](../../apps/mobile/src/globals.css). Tailwind CSS 4 and NativeWind 5 compile it for React Native and web. The Expo Router root layout imports it once. The review screen is the first migrated screen; the existing themed navigation and authentication components retain their styling.

## Installed setup

- NativeWind `5.0.0-rc.0` and `react-native-css` `3.1.0-rc.0` are an exact release-candidate pair, not the stable NativeWind 4 setup.
- Tailwind and its PostCSS plugin are pinned to `4.1.12`.
- The repository root pins Lightning CSS to `1.30.1` through Bun's `overrides`.
- `apps/mobile/metro.config.js` wraps Expo's config with `withNativewind`.
- `apps/mobile/postcss.config.mjs` enables the Tailwind PostCSS plugin.
- `apps/mobile/nativewind-env.d.ts` enables native `className` types.
- No NativeWind Babel preset or `tailwind.config.js` is needed for this v5 setup.

From the repository root, run `bun install`. Then, from `apps/mobile`:

```sh
bun run typecheck
bunx expo start --clear
```

Rebuild a development client when native dependencies change. Restart the editor's TypeScript server if it still rejects `className` after installation.

## Reusable classes

`@theme` defines colors, spacing, radii, and shadows. `@utility` declares reusable names such as `card` and `btn-primary`; `@apply` composes Tailwind utilities inside them. The generated class is `.card`, used without a dot in JSX.

```css
@theme {
  --color-primary: #3b5ee8;
}

@utility card {
  @apply rounded-lg border border-border bg-surface p-md shadow-card;
}
```

```tsx
import { Pressable, Text, View } from 'react-native';

export function Example() {
  return (
    <View className="screen stack">
      <View className="card gap-sm">
        <Text className="headline-md">Explain it in your own words.</Text>
        <Text className="body-sm text-muted">Start with the core mechanism.</Text>
      </View>
      <Pressable className="btn-primary">
        <Text className="btn-primary-text">Submit Answer</Text>
      </Pressable>
    </View>
  );
}
```

Put container styles on `View`/`Pressable` and text styles on `Text`. Button and chip text have separate classes. Classes do not implement submission, recording, counters, or navigation. The review screen remains static.

Compose utilities to customize a shared class, for example `card border-0 gap-sm` or `btn-primary shadow-card`. For actual interactive controls, attach handlers separately and use `active:bg-primary-pressed` or `disabled:opacity-50` when appropriate. Do not construct partial class names such as `bg-${color}`; use complete literal alternatives so Tailwind can discover them.

| Purpose | Classes |
| --- | --- |
| Screen | `app-shell`, `screen` |
| Layout | `stack`, `row`, `row-between`, `wrap`, `full-width` |
| Spacing | `gap-xs`, `gap-sm`, `gap-md`, `gap-lg`, `gap-xl`, `px-margin` |
| Cards | `card`, `card-prompt`, `card-floating`, `card-header`, `card-excerpt` |
| Buttons | `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost` |
| Button text | `btn-primary-text`, `btn-secondary-text`, `btn-danger-text`, `btn-ghost-text` |
| Chips | `chip-success`, `chip-warning`, `chip-danger`, plus matching `-text` classes |
| Fields | `field`, `input`, `input-search`, `textarea`, `field-error` |
| Lists | `list`, `list-row`, `list-row-divider` |
| Retention | `strength-meter`, `strength-segment`, `strength-filled` |
| Recording visuals | `record-button`, `waveform`, `waveform-bar` |
| Typography | `display-lg`, `display-lg-mobile`, `headline-lg/md/sm`, `body-lg/md/sm`, `label-lg/md/sm` |
| Text colors | `text-primary`, `text-secondary`, `text-muted`, `text-danger-text` |

`--spacing-sm` creates spacing utilities such as `gap-sm` and `p-sm`. `--color-primary` creates `bg-primary`, `text-primary`, and `border-primary`. Typography is applied explicitly on native. The existing 16px root baseline is preserved; the `tablet:` breakpoint begins at 600px. Fonts use NativeWind's platform defaults; Plus Jakarta Sans still requires separately loaded font assets.

## Native components and platform details

Core React Native components support `className` through the Metro integration. Use `contentContainerClassName` for the inner content of a `ScrollView`. Use `textAlignVertical="top"` on multiline inputs. Preserve safe-area handling via `react-native-safe-area-context` and avoid adding the same insets twice.

Wrap third-party components that accept a `style` prop with `styled` when needed:

```tsx
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

const StyledSafeAreaView = styled(SafeAreaView);

// <StyledSafeAreaView className="app-shell" edges={['top', 'bottom']} />
```

Component-specific props such as `SymbolView.tintColor` and `TextInput.placeholderTextColor` still use [color tokens](../../apps/mobile/src/styles/tokens.ts). Keep those colors aligned with `@theme` when changing the palette. All review layout and typography now come from Tailwind; the old `styles/ui.ts` presets were removed after migrating their only screen consumer.

Browser-only selectors are isolated under `@supports selector(div > div)` in `globals.css`. Native layout uses flexbox. Tailwind preflight also applies to web, so check authentication screens when changing global rules. Build success does not replace a device check for safe areas, shadows, text scaling, or third-party components.

## Static design preview

Raw `globals.css` now requires compilation. From `apps/mobile`, run:

```sh
bun run design:preview
```

Open `docs/design/dist/index.html` in a browser. The command compiles the actual Tailwind stylesheet and copies the existing reference HTML alongside it. Generated preview files are ignored by Git. The HTML source is included in Tailwind's `@source` paths, so classes used only by the preview are generated too.

## Verification

From `apps/mobile`:

```sh
bun run typecheck
bun run design:preview
bunx expo export --platform all --output-dir /tmp/explain-back-export --max-workers 2
```

Static web export additionally needs the app's normal Clerk configuration and valid Expo Router routes. On a device, check the review screen's scrolling, input placeholder wrapping, bottom navigation, safe areas, and text scaling. This migration adds no app functionality.

References: [NativeWind installation](https://www.nativewind.dev/v5/getting-started/installation), [configuration](https://www.nativewind.dev/v5/customization/configuration), [Tailwind custom styles](https://tailwindcss.com/docs/adding-custom-styles).
