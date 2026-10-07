import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { colors as c, layout, radii as r, shadows, spacing as s } from './tokens';

export { colors, layout, radii, shadows, spacing } from './tokens';

/**
 * Native equivalent of globals.css. View and Text styles are separate because
 * React Native does not inherit text styles from a parent View.
 * Supply a registered font family after loading it with expo-font if desired.
 */
export function createUIStyles(fontFamily = Platform.select({ ios: 'System', web: 'var(--font-sans)', default: 'sans-serif' })) {
  const type = (fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight'], letterSpacing = 0): TextStyle => ({
    fontFamily, fontSize, lineHeight, fontWeight, letterSpacing, color: c.text,
  });
  const button: ViewStyle = {
    minHeight: 48, paddingVertical: 12, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s.sm,
    borderRadius: r.full, borderWidth: 1, borderColor: 'transparent',
  };
  const buttonLabel: TextStyle = { ...type(14, 20, '600', 0.14), textAlign: 'center' };
  const chip: ViewStyle = {
    minHeight: 28, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderRadius: r.full,
  };
  const input: TextStyle = {
    ...type(16, 24, '400'), minHeight: 48, padding: s.md, width: '100%',
    borderWidth: 1, borderColor: c.border, borderRadius: r.md, backgroundColor: c.surface,
  };

  return StyleSheet.create({
    appShell: { flex: 1, backgroundColor: c.background },
    // Add useSafeAreaInsets() to screen padding; see the usage guide.
    screen: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingVertical: s.md, paddingHorizontal: layout.margin },
    screenTablet: { paddingHorizontal: layout.tabletMargin },
    stack: { flexDirection: 'column', gap: s.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.md },
    wrap: { flexWrap: 'wrap' },
    fullWidth: { width: '100%' },
    gapSm: { gap: s.sm },
    gapLg: { gap: s.lg },
    gapXl: { gap: s.xl },
    layoutGrid: { flexDirection: 'column', gap: layout.gutter },
    layoutGridTablet: { flexDirection: 'row' },
    layoutMain: { minWidth: 0 },
    layoutAside: { minWidth: 0 },
    layoutMainTablet: { flexGrow: 5, flexBasis: 0 },
    layoutAsideTablet: { flexGrow: 3, flexBasis: 0 },

    displayLg: type(36, 44, '800', -1.08),
    displayLgMobile: type(28, 34, '800', -0.7),
    headlineLg: type(24, 32, '700', -0.48),
    headlineMd: type(20, 28, '600', -0.3),
    headlineSm: type(18, 24, '600', -0.18),
    bodyLg: type(17, 26, '400', -0.085),
    bodyMd: type(15, 22, '400'),
    bodySm: type(13, 18, '400'),
    labelLg: type(14, 20, '600', 0.14),
    labelMd: type(12, 16, '600', 0.24),
    labelSm: type(11, 14, '700', 0.44),
    textSecondary: { color: c.textSecondary },
    textMuted: { color: c.textMuted },
    textPrimary: { color: c.primary },
    textCenter: { textAlign: 'center' },
    tabularNums: { fontVariant: ['tabular-nums'] },
    link: { ...type(15, 22, '400'), color: c.primary, textDecorationLine: 'underline' },

    btnPrimary: { ...button, minHeight: 52, backgroundColor: c.primary, boxShadow: shadows.primary },
    btnSecondary: { ...button, backgroundColor: c.surfaceMuted, borderColor: c.border },
    btnDanger: { ...button, backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
    btnGhost: { ...button, backgroundColor: 'transparent' },
    btnPrimaryText: { ...buttonLabel, color: c.onPrimary },
    btnSecondaryText: buttonLabel,
    btnDangerText: { ...buttonLabel, color: c.dangerText },
    btnGhostText: { ...buttonLabel, color: c.primary },
    pressed: { transform: [{ translateY: 1 }, { scale: 0.98 }], boxShadow: shadows.pressed },
    primaryPressed: { backgroundColor: c.primaryPressed },
    disabled: { opacity: 0.5, boxShadow: 'none' },
    focusRing: { outlineColor: c.primary, outlineWidth: 2, outlineOffset: 3, outlineStyle: 'solid' },

    card: { padding: s.md, borderWidth: 1, borderColor: c.border, borderRadius: r.lg, backgroundColor: c.surface, boxShadow: shadows.card },
    cardPrompt: { borderRadius: r.prompt },
    cardFloating: { borderRadius: r.xl, boxShadow: shadows.floating },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.sm, marginBottom: s.md },
    cardExcerpt: { ...type(15, 22, '400'), marginVertical: s.md, color: c.textSecondary, fontStyle: 'italic' },

    chipSuccess: { ...chip, backgroundColor: c.successSoft, borderColor: c.successBorder },
    chipWarning: { ...chip, backgroundColor: c.warningSoft, borderColor: c.warningBorder },
    chipDanger: { ...chip, backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
    chipSuccessText: { ...type(12, 16, '600'), color: c.successText },
    chipWarningText: { ...type(12, 16, '600'), color: c.warningText },
    chipDangerText: { ...type(12, 16, '600'), color: c.dangerText },
    chipDot: { width: 6, height: 6, borderRadius: r.full },
    dotSuccess: { backgroundColor: c.success },
    dotWarning: { backgroundColor: c.warning },
    dotDanger: { backgroundColor: c.danger },

    field: { gap: s.sm },
    input,
    inputSearch: { borderRadius: r.full },
    textarea: { ...input, minHeight: 160, textAlignVertical: 'top' },
    inputFocused: { borderColor: c.primary, boxShadow: shadows.focus },
    inputInvalid: { borderColor: c.danger },
    inputDisabled: { opacity: 0.6, backgroundColor: c.surfaceMuted },
    fieldError: { ...type(13, 18, '400'), color: c.dangerText },

    list: { borderWidth: 1, borderColor: c.border, borderRadius: r.lg, backgroundColor: c.surface },
    listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.md, padding: s.md },
    listRowDivider: { borderTopWidth: 1, borderTopColor: c.divider },
    strengthMeter: { flexDirection: 'row', gap: 3 },
    strengthSegment: { width: 16, height: 6, borderRadius: r.full, backgroundColor: c.border },
    strengthFilled: { backgroundColor: c.success },
    actionZone: { alignItems: 'center', gap: s.md, padding: s.md },
    recordButton: { ...button, width: 72, height: 72, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: c.primary, boxShadow: shadows.floating },
    recording: { backgroundColor: c.danger },
    waveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s.xs, height: 32 },
    waveformBar: { width: 4, height: 8, maxHeight: '100%', borderRadius: r.default, backgroundColor: c.danger },
  });
}

/** Ready to use with system fonts; see createUIStyles for custom fonts. */
export const ui = createUIStyles();
