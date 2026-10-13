import type { ConfigContext, ExpoConfig } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = config.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return {
    ...config,
    name: config.name ?? "Safe Walk",
    slug: config.slug ?? "safe-walk",
    ...(projectId ? {
      extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
    } : {}),
  };
};
