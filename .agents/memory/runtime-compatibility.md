---
name: Safe Walk runtime compatibility
description: Non-obvious Expo Go peer compatibility, Expo single-output proxy behavior, and Node watch-mode env-file constraints.
---

Match native peer libraries to Expo Go's bundled versions; do not trust the
latest versions automatically installed to satisfy optional peers.

**Why:** Expo SDK 57's router installation selected newer Reanimated/Worklets
peers than the Expo native modules supported. Caret ranges also allowed React
and react-native-maps to resolve beyond the versions Expo Go expects.

**How to apply:** Run `expo install --check` after package installs or lockfile
changes, and pin React/native-module versions to Expo's compatible releases.

Keep API forwarding ahead of Expo's single-output SPA fallback.

**Why:** In this SDK 57 environment, the Metro enhanceMiddleware approach
returned HTML for /api requests despite valid backend endpoints. A front
HTTP/WebSocket development proxy makes the request ordering explicit.

**How to apply:** Verify /api returns JSON through the public web origin after
changing development tooling; a healthy backend port alone is insufficient.

Do not pass a missing optional env file to Node 22 watch mode.

**Why:** --env-file-if-exists accepted the missing file, but watch mode still
attempted to watch it and crashed with ENOENT.

**How to apply:** Include the env-file argument only when that file exists;
hosting-supplied environment variables should still work without a local file.

Check runtime imports, not only types, when adding Expo SDK 57 contact/widget APIs.

**Why:** The root contacts package exports legacy functions that type-check but
throw at runtime; supported legacy methods must come from the explicit legacy
entry point. Native-only widget libraries also require their native module at
import time and are absent from Expo Go.

**How to apply:** Use the current contacts model or explicit legacy entry point.
Guard native widget module loading before importing it, not only before calling
an exported function. Android widget task registration must still happen during
real native headless entry-point loading, before any React screen mounts.

Return from contact settings to the existing walk, not a second map route.

**Why:** Stack navigation can retain the first walking screen while a pushed
map mounts another. Both can own location-sending effects for the same trip;
browser automation can also accidentally click hidden controls from that stack.

**How to apply:** Use back navigation with replacement only for a direct-entry
fallback. Verify there is only one walking screen after round trips through
settings, and filter browser test controls by actual visibility.

Keep React-dependent preview libraries inside the isolated mockup sandbox's own
dependency tree.

**Why:** When a sandbox component imports React locally but a renderer such as
React Leaflet or React Native Web resolves from the main app's root, the browser
can load two React copies and fail at runtime with invalid hook calls even when
TypeScript passes.

**How to apply:** Declare renderer and map packages in the sandbox package
manifest, install them there, and verify the preview browser has no hook errors.
