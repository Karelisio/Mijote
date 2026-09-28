import {
  argbFromHex,
  hexFromArgb,
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  type DynamicColor,
} from '@material/material-color-utilities';

export const DEFAULT_SEED = '#B5562A';

export const SEED_PRESETS = ['#B5562A', '#8E4E9E', '#3F6F3A', '#2F6690', '#A23B55', '#7A6A1E'];

const TOKENS: Record<string, DynamicColor> = {
  primary: MaterialDynamicColors.primary,
  'on-primary': MaterialDynamicColors.onPrimary,
  'primary-container': MaterialDynamicColors.primaryContainer,
  'on-primary-container': MaterialDynamicColors.onPrimaryContainer,
  secondary: MaterialDynamicColors.secondary,
  'on-secondary': MaterialDynamicColors.onSecondary,
  'secondary-container': MaterialDynamicColors.secondaryContainer,
  'on-secondary-container': MaterialDynamicColors.onSecondaryContainer,
  tertiary: MaterialDynamicColors.tertiary,
  'on-tertiary': MaterialDynamicColors.onTertiary,
  'tertiary-container': MaterialDynamicColors.tertiaryContainer,
  'on-tertiary-container': MaterialDynamicColors.onTertiaryContainer,
  error: MaterialDynamicColors.error,
  'on-error': MaterialDynamicColors.onError,
  'error-container': MaterialDynamicColors.errorContainer,
  'on-error-container': MaterialDynamicColors.onErrorContainer,
  surface: MaterialDynamicColors.surface,
  'on-surface': MaterialDynamicColors.onSurface,
  'on-surface-variant': MaterialDynamicColors.onSurfaceVariant,
  'surface-dim': MaterialDynamicColors.surfaceDim,
  'surface-bright': MaterialDynamicColors.surfaceBright,
  'surface-container-lowest': MaterialDynamicColors.surfaceContainerLowest,
  'surface-container-low': MaterialDynamicColors.surfaceContainerLow,
  'surface-container': MaterialDynamicColors.surfaceContainer,
  'surface-container-high': MaterialDynamicColors.surfaceContainerHigh,
  'surface-container-highest': MaterialDynamicColors.surfaceContainerHighest,
  outline: MaterialDynamicColors.outline,
  'outline-variant': MaterialDynamicColors.outlineVariant,
  'inverse-surface': MaterialDynamicColors.inverseSurface,
  'inverse-on-surface': MaterialDynamicColors.inverseOnSurface,
  'inverse-primary': MaterialDynamicColors.inversePrimary,
  scrim: MaterialDynamicColors.scrim,
  shadow: MaterialDynamicColors.shadow,
};

export type Palette = Record<string, string>;

/** Material 3 tonal-spot scheme generated from a seed color. */
export function paletteFromSeed(seedHex: string, dark: boolean): Palette {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seedHex)), dark, 0);
  const out: Palette = {};
  for (const [name, color] of Object.entries(TOKENS)) out[name] = hexFromArgb(color.getArgb(scheme));
  return out;
}

export function applyPalette(p: Palette, dark: boolean): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p)) root.style.setProperty(`--md-${k}`, v);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.surface ?? '#fff');
}
