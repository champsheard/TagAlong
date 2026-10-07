import type { ConfigContext, ExpoConfig } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config, name: config.name ?? "Safe Walk", slug: config.slug ?? "safe-walk",
  ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? {
    extra: { ...config.extra, eas: { ...config.extra?.eas, projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } },
  } : {}),
});
