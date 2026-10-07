/** Socratic Precision: keep these tokens aligned with ../globals.css. */
export const colors = {
  background: '#fbfbf9',
  surface: '#ffffff',
  surfaceMuted: '#f7f6f2',
  text: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  placeholder: '#94a3b8',
  border: '#e7e5df',
  divider: '#f1efe9',
  primary: '#3b5ee8',
  primaryPressed: '#2d4cd2',
  primaryLip: '#203db5',
  primarySoft: '#eef2ff',
  onPrimary: '#ffffff',
  success: '#10b981',
  successSoft: '#ecfdf5',
  successBorder: '#a7f3d0',
  successText: '#065f46',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  warningBorder: '#fde68a',
  warningText: '#92400e',
  danger: '#f43f5e',
  dangerSoft: '#fff1f2',
  dangerBorder: '#fecdd3',
  dangerText: '#9f1239',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radii = { sm: 4, default: 8, md: 12, lg: 16, prompt: 20, xl: 24, full: 9999 } as const;
export const layout = { tablet: 600, maxWidth: 1024, margin: 20, tabletMargin: 24, gutter: 16 } as const;
export const shadows = {
  card: '0 1px 3px rgba(15, 23, 42, 0.03), 0 6px 16px -4px rgba(15, 23, 42, 0.05)',
  floating: '0 4px 6px -1px rgba(15, 23, 42, 0.04), 0 12px 28px -6px rgba(15, 23, 42, 0.08)',
  pressed: '0 1px 2px rgba(15, 23, 42, 0.04)',
  primary: `0 2px 0 ${colors.primaryLip}`,
  focus: '0 0 0 3px rgba(59, 94, 232, 0.12)',
} as const;
