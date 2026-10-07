# Socratic Precision UI styles

Use the shared styles instead of repeating colors, card borders, button sizes, or typography in each screen.

- [Web CSS](../../apps/mobile/src/globals.css): imported once by the root layout; classes work on DOM elements in `.web.tsx` components.
- [Native presets](../../apps/mobile/src/styles/ui.ts): `import { ui, colors } from '@/styles/ui'`; use `style={ui.card}` on React Native components. These presets also work with React Native Web.
- [Native tokens](../../apps/mobile/src/styles/tokens.ts): colors, spacing, corner radii, layout measurements, and shadows.
- [Visual class reference](./preview.html): open this local HTML file in a browser to inspect the web components and resize the layout.

The chosen palette is the **warm off-white and royal indigo from the detailed component descriptions** in the supplied DESIGN.md. Its opening lavender token table is a different palette and is not mixed into this implementation. This is the supplied light theme; no dark palette is invented. Existing `ThemedView`/`ThemedText` and navigation retain their current theme until a screen explicitly adopts these presets.

## Web: use classes

`globals.css` is already imported by `src/app/_layout.tsx`. The old `global.css` remains a compatibility import. Outside this Expo app, import `globals.css` once in your entry point. There are no Tailwind or other CSS-library dependencies.

Place DOM markup in a `.web.tsx` component; ordinary native `View`, `Text`, and `Pressable` do **not** accept these CSS classes. Use the native presets for shared React Native screens.

```tsx
// ExamplePanel.web.tsx
export function ExamplePanel({ onStart }: { onStart: () => void }) {
  return (
    <main className="app-shell">
      <div className="screen stack">
        <h1 className="display-lg">Explain It Back</h1>
        <section className="card card-prompt stack">
          <span className="chip-warning">Needs review</span>
          <h2 className="headline-md">Explain this concept in your own words.</h2>
          <p className="body-md text-secondary">Start with the idea, then give an example.</p>
          <button type="button" className="btn-primary" onClick={onStart}>
            Start explaining
          </button>
        </section>
      </div>
    </main>
  );
}
```

Button and chip variants work by themselves. Card modifiers compose with the base: `card card-prompt`, `card card-floating`. Similarly, use `input input-search`. Combine layout/type utilities such as `stack gap-lg`, `body-md text-muted`, or `label-lg tabular-nums`.

## Native: use style presets

The camelCase names correspond to the CSS names. Text styles go on `Text`, not its containing `View` or `Pressable`: React Native does not inherit text color or typography through containers.

```tsx
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing, ui } from '@/styles/ui';

export function ExamplePanel({ onStart, disabled = false }: {
  onStart: () => void;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const tablet = useWindowDimensions().width >= layout.tablet;
  const margin = tablet ? layout.tabletMargin : layout.margin;

  return (
    <ScrollView style={ui.appShell} contentContainerStyle={[
      ui.screen,
      ui.stack,
      {
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        paddingLeft: insets.left + margin,
        paddingRight: insets.right + margin,
      },
    ]}>
      <Text style={tablet ? ui.displayLg : ui.displayLgMobile}>Explain It Back</Text>
      <View style={[ui.card, ui.cardPrompt, ui.stack]}>
        <View style={ui.chipWarning}>
          <Text style={ui.chipWarningText}>Needs review</Text>
        </View>
        <Text style={ui.headlineMd}>Explain this concept in your own words.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onStart}
          style={({ pressed }) => [
            ui.btnPrimary,
            pressed && !disabled && ui.primaryPressed,
            disabled && ui.disabled,
          ]}>
          <Text style={ui.btnPrimaryText}>Start explaining</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

`ui.pressed` adds the optional tactile transform and pressed shadow. Only apply it when reduced motion is off (query/observe React Native's `AccessibilityInfo`); `ui.primaryPressed` changes color without motion. Native styles do not attach handlers, disable presses, animate, or load fonts by themselves.

For a focused native input, use state and attach the matching presets:

```tsx
import { useState } from 'react';
import { TextInput } from 'react-native';
import { colors, ui } from '@/styles/ui';

export function ExplanationInput() {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      multiline
      accessibilityLabel="Your explanation"
      placeholder="Explain it in your own words…"
      placeholderTextColor={colors.placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[ui.textarea, focused && ui.inputFocused]}
    />
  );
}
```

Use `ui.inputInvalid` after `ui.inputFocused` for an error, and render the error text with `ui.fieldError`. Use `editable={false}` plus `ui.inputDisabled` to disable editing. Native textarea auto-growth requires `onContentSizeChange` and a height state; the preset provides a minimum height, not behavior.

## Reference

| Element | Web classes | Native styles |
| --- | --- | --- |
| Canvas / screen | `app-shell`, `screen` | `appShell`, `screen`, `screenTablet` |
| Layout | `stack`, `row`, `row-between`, `wrap`, `full-width` | `stack`, `row`, `rowBetween`, `wrap`, `fullWidth` |
| Gaps | `gap-sm`, `gap-lg`, `gap-xl` | `gapSm`, `gapLg`, `gapXl` |
| Cards | `card`, `card-prompt`, `card-floating` | `card`, `cardPrompt`, `cardFloating` |
| Card sections | `card-header`, `card-excerpt` | `cardHeader`, `cardExcerpt` |
| Primary button | `btn-primary` | `btnPrimary` + `btnPrimaryText` |
| Other buttons | `btn-secondary`, `btn-danger`, `btn-ghost` | `btnSecondary`, `btnDanger`, `btnGhost` + corresponding `Text` style |
| Mastered / review / critical | `chip-success`, `chip-warning`, `chip-danger` | `chipSuccess`, `chipWarning`, `chipDanger` + corresponding `Text` style |
| Chip dot | `chip-dot` inside a chip | `chipDot` + `dotSuccess`, `dotWarning`, or `dotDanger` |
| Input | `field`, `input`, `input-search`, `textarea`, `field-error` | `field`, `input`, `inputSearch`, `textarea`, `fieldError` |
| Concept list | `list`, `list-row` | `list`, `listRow`, `listRowDivider` on rows after the first |
| Strength meter | `strength-meter`, `strength-segment`, `is-filled` | `strengthMeter`, `strengthSegment`, `strengthFilled` |
| Recording | `action-zone`, `record-button`, `is-recording` | `actionZone`, `recordButton`, `recording` |
| Waveform | `waveform`, `waveform-bar` | `waveform`, `waveformBar` |
| Metrics | `tabular-nums` | `tabularNums` |
| Text utilities | `text-secondary`, `text-muted`, `text-primary`, `text-center`, `link` | `textSecondary`, `textMuted`, `textPrimary`, `textCenter`, `link` |

Typography: `display-lg` (28px on phones, 36px at 600px+), `display-lg-mobile`, `headline-lg/md/sm`, `body-lg/md/sm`, and `label-lg/md/sm`. Native uses camelCase; choose `displayLgMobile` / `displayLg` from the current width. Native letter spacing converts the source's `em` values to pixels.

Web `layout-grid` has 4 columns below 600px and 8 above, with `layout-main` and `layout-aside` spanning the full width on phones and 5/3 columns on larger screens. Native: combine `layoutGrid` + conditional `layoutGridTablet`, and apply `layoutMainTablet` / `layoutAsideTablet` to the children at 600px+. Safe-area padding is automatic in web `screen`; use `useSafeAreaInsets()` for native. Avoid adding the same inset twice if an enclosing navigator already handles it.

## Fonts, states, and scope

- **Font loading:** CSS declares Plus Jakarta Sans, but font binaries are not bundled. Load it using a self-hosted `@font-face` before expecting that exact typeface; otherwise the system fallback is used. On native, load/register your fonts using the existing `expo-font` dependency, then call `createUIStyles('YourRegisteredFontFamily')`. For separately registered weight files, assign the corresponding registered family on text styles; `fontWeight` alone cannot select unrelated family names. The exported `ui` deliberately uses system fonts until then.
- **Accessibility:** use real web buttons and their `disabled` attribute. `aria-disabled` styles alone do not block events on links or custom elements. Provide visible labels for fields, labels for icon-only recording controls, error descriptions (`aria-describedby`), and text labels for status/strength indicators. Destructive button text uses the darker diagnostic rose for readability. Inputs use 16px type to avoid focus zoom on mobile browsers; other type sizes follow the design.
- **Motion:** web hover/press/focus/disabled states and a reduced-motion override are included. Native recording pulses and waveform amplitude updates must be driven by the audio UI; styles do not implement recording. Set web `--amplitude` or native bar height from real amplitude data. Native `boxShadow`/outline presets target this project's React Native 0.86 setup; shadow rendering can vary on older Android devices.
- **Theme:** apply `app-shell` / `ui.appShell` to a new light-design screen. Avoid nesting dark `ThemedView` defaults inside light cards; use plain `View` / `Text` with these presets or explicitly override their styles. These are reusable building blocks, not an automatic redesign of existing screens.
- **Maintenance:** update matching colors in `globals.css` and `styles/tokens.ts` together. CSS dimensions use rem (16px baseline); native uses density-independent units and native text scaling. The shared names make the mapping explicit without adding a CSS-to-native library.

Platform reference: [Expo web CSS](https://docs.expo.dev/guides/tailwind/) and [Expo font loading](https://docs.expo.dev/develop/user-interface/fonts/).
