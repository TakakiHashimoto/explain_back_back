import type { ConfigContext, ExpoConfig } from 'expo/config';

import pkg from './package.json';

/** Extends app.json; package.json is the single source of truth for the app version. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Explain It Back',
  slug: config.slug ?? 'explain-it-back',
  version: pkg.version,
});
