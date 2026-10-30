import type { ConfigContext, ExpoConfig } from 'expo/config';

import pkg from './package.json';

/** Extends app.json; package.json is the single source of truth for the app version. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'mobile',
  slug: config.slug ?? 'mobile',
  version: pkg.version,
});
