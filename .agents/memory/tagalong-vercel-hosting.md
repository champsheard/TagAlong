---
name: Tagalong Vercel hosting choice
description: The selected Vercel Hobby-only deployment trade-off and its effect on background alerts.
---

The user chose Vercel Hobby only rather than adding a separate always-on worker. Background notifications and remote-drive alerts must be converted to event-driven, best-effort processing; they may be delayed or missed compared with the current five-second workers.

**Why:** The user selected the Vercel-only option after being told that Hobby Cron runs only once per day and cannot preserve the app's current five-second worker timing.

**How to apply:** When adapting Tagalong to serverless functions, process work during requests or bounded function execution. Clearly retain the app's safety caveats and never promise exact alert timing or delivery.

Vercel cannot resolve Replit's internal package-firewall host if an npm lockfile contains tarball URLs pointing to it. Those URLs include an extra `/npm/` path segment, so replacing only the hostname creates invalid public registry paths; normalize the full URL prefix before installation.

**Why:** Replit-generated npm lockfiles can retain internal tarball URLs that fail with `ENOTFOUND` in Vercel's build environment. `--replace-registry-host=always` alone preserves the `/npm/` segment and can lead to npm 404 responses.

**How to apply:** Before installing, replace `http://package-firewall.replit.internal/npm/` with `https://registry.npmjs.org/`, then run npm with the public registry. Treat npm's unknown `cache-dir` warning as separate from registry failures.

Use a static-output preset for the public app service with the custom Expo build, and expose Express as a separate API service with explicit public `/api` routing. Do not switch the whole app service to the Express preset or rely on an API-directory function inside the static service.

**Why:** The Express preset routed page requests into the API handler. HTML rewrites could not make Express serve the static export. A subsequent API-directory function inside the static service was not publicly available in the reported deployment. Services have separate route ownership, and the first matching top-level service selection is final; no fallback discovers backend routes elsewhere.

**How to apply:** Keep the Vite static-output preset with the custom Expo build (this does not migrate the product to Vite). Give the API service the Express preset and an explicit server entrypoint, not Expo's package main. Put API-specific top-level rewrites before the frontend catch-all. Preserve the original `/api/...` path that Express expects. Service-level `framework` does not accept null in Vercel's schema.
