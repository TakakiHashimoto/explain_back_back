# Replacing the App Icon

> Audience: Explain It Back team members (A / B / C) who need to change the app icon or splash.
> Last updated: 2026-10-28 (current icon: concept F "You & Tutor")

## Summary

1. Edit the **SVG masters** in `apps/mobile/assets/icon-source/`. The PNGs in `assets/images/` are generated from them; never edit the PNGs by hand.
2. Re-export the PNGs with Inkscape (commands in §3).
3. Run `npx expo prebuild --clean`. `android/` and `ios/` are generated and gitignored, so a new icon does not show up until the native projects are regenerated.

## 1. Files

All paths are relative to `apps/mobile/`.

| SVG master (`assets/icon-source/`) | PNG output (`assets/images/`) | Size | Used by (`app.json`) |
|---|---|---|---|
| `icon.svg` | `icon.png` | 1024×1024 | `expo.icon` (iOS + fallback) |
| `icon.svg` | `favicon.png` | 48×48 | `web.favicon` |
| `android-foreground.svg` | `android-icon-foreground.png` | 1024×1024 | `android.adaptiveIcon.foregroundImage` |
| `android-background.svg` | `android-icon-background.png` | 1024×1024 | `android.adaptiveIcon.backgroundImage` |
| `android-monochrome.svg` | `android-icon-monochrome.png` | 1024×1024 | `android.adaptiveIcon.monochromeImage` |
| `splash.svg` | `splash-icon.png` | width 698 | `expo-splash-screen` plugin `image` |
| `splash.svg` | `logo.png`, `logo@2x.png`, `logo@3x.png` | width 32 / 64 / 96 | In-app header logo (`src/components/app-header.tsx`, `require('@/assets/images/logo.png')`) |

Colors are also set in `app.json`. Update them together with the SVGs:

- `android.adaptiveIcon.backgroundColor`
- `expo-splash-screen` → `backgroundColor` (and `imageWidth`, the splash image width in dp)

## 2. Rules for each variant

### `icon.svg` (full icon)
- Square, 1024×1024, **opaque background, no rounded corners, no transparency.** iOS and Android apply their own mask; App Store rejects icons with transparency.

### Android adaptive icon (`android-foreground.svg` / `android-background.svg`)
An adaptive icon is two layers on a 108dp canvas. Launchers crop it to different shapes (circle, squircle, rounded square) and may move the layers for a parallax effect.

- Only the **center 72dp** is shown, and only a **circle of 66dp diameter** is guaranteed to be visible on every shape.
  In a 1024px canvas: visible area ≈ 683px, safe circle ≈ 626px diameter (radius ≈ 313px) around the center.
- Foreground: **transparent background**, motif scaled to fit the safe circle. The current file does this with a group transform:
  `translate(512 512) scale(0.64) translate(-<motif center x> -<motif center y>)`.
- Background: a solid color (or a simple pattern) that fills the full canvas.

### `android-monochrome.svg` (themed icon, Android 13+)
When the user turns on themed icons, Android paints this layer **in a single color** from the wallpaper palette. Colors are ignored; only the alpha matters.

- One color (white) on transparent, same scale and position as the foreground.
- Details that were drawn in another color (text lines, check mark, the gap between overlapping shapes) must become **cut-outs**, or they disappear. The current file uses an SVG `<mask>`: white = keep, black = cut.

### `splash.svg`
- Motif only, transparent background. Set the `viewBox` tight around the motif; `app.json` paints the background and sets the size (`imageWidth`).

## 3. Exporting the PNGs

Requires Inkscape 1.x (`sudo apt install inkscape` / `brew install --cask inkscape`). Run from `apps/mobile/assets/icon-source/`:

```sh
O=../images
inkscape icon.svg               --export-type=png --export-filename=$O/icon.png                    -w 1024
inkscape icon.svg               --export-type=png --export-filename=$O/favicon.png                 -w 48
inkscape android-foreground.svg --export-type=png --export-filename=$O/android-icon-foreground.png -w 1024
inkscape android-background.svg --export-type=png --export-filename=$O/android-icon-background.png -w 1024
inkscape android-monochrome.svg --export-type=png --export-filename=$O/android-icon-monochrome.png -w 1024
inkscape splash.svg             --export-type=png --export-filename=$O/splash-icon.png             -w 698
inkscape splash.svg             --export-type=png --export-filename=$O/logo.png                    -w 32
inkscape splash.svg             --export-type=png --export-filename=$O/logo@2x.png                 -w 64
inkscape splash.svg             --export-type=png --export-filename=$O/logo@3x.png                 -w 96
```

The header logo uses React Native's density suffixes: `require('…/logo.png')` loads `@2x` / `@3x` automatically on high-density screens. Unlike the app icon, the logo is bundled JS-side, so it updates with a normal reload (no `prebuild`).

Pass only `-w`. The height follows the `viewBox` aspect ratio.

Then check the sizes (`identify ../images/*.png`, from ImageMagick) and confirm that `npx expo config --type public` still loads.

## 4. Checking before you commit

Preview the adaptive icon under launcher masks without building. From `assets/images/`:

```sh
# Composite the layers, keep the visible 72/108 area, then apply a circle mask
magick android-icon-background.png android-icon-foreground.png -composite \
  -gravity center -crop 683x683+0+0 +repage -resize 300x300 /tmp/adaptive.png
magick /tmp/adaptive.png \( -size 300x300 xc:none -fill white -draw "circle 150,150 150,0" \) \
  -compose DstIn -composite /tmp/adaptive-circle.png
```

Check that:

- [ ] Nothing is clipped by the circle mask
- [ ] The monochrome layer is still readable when tinted (details are cut out, not lost)
- [ ] The icon is recognizable at 48px (`favicon.png`)
- [ ] The splash looks right on the `app.json` background color

## 5. Applying it to a build

`android/` and `ios/` are generated by **Continuous Native Generation (CNG)** and are gitignored. Expo copies the icon into them during `prebuild`. Changing `app.json` or the PNGs does not update an existing native project.

```sh
cd apps/mobile
npx expo prebuild --clean --platform android   # deletes and regenerates android/
cd ../.. && bun run dev:android                # root script: backend + Android
```

`--clean` deletes manual edits inside `android/`. Every native setting should live in `app.json` or a config plugin, so nothing should be lost; check first if you are unsure.

On the emulator, check the launcher, the app drawer, and the themed icon (long-press the home screen → Wallpaper & style → Themed icons).

EAS builds run `prebuild` themselves, so they pick up the new icon automatically.

## 6. iOS notes

- iOS currently uses `icon.png` (the top-level `expo.icon`). The `ios.icon` override that pointed at `assets/expo.icon` (the Expo template's Icon Composer bundle) was removed. That folder is no longer used.
- To use iOS 26 Liquid Glass layering, create an `.icon` bundle with Apple's **Icon Composer** (Mac only), put it in `assets/`, and set `ios.icon` to it in `app.json`.
- iOS has not been verified yet (no Mac on the team's dev machines so far).

## 7. Known gaps

- No dark-mode splash (`expo-splash-screen` supports a `dark` block; not configured).
- No dark / tinted iOS icon variants (they require Icon Composer, §6).
