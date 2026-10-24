# Deploy Tagalong on Vercel Hobby

Vercel serves the Expo web export from `public/` and runs the Express API as a
serverless function. Firestore is the only runtime database; the SQLite file is
kept locally as an import backup and is not deployed.

## Build and routes

- Vercel uses `pnpm run build:vercel` to export the web app to `public/`.
- The `app` service uses Vercel's Vite static-output preset with the custom Expo
  build command; the product itself remains Expo, not Vite. Do not use the
  Express preset here, because it sends page requests to the API handler.
- `/api/*` is handled by `api/[...path].ts`.
- `/contacts` and `/track/:code` load the Expo single-page app.
- `vercel.json` runs protected expired-data cleanup once daily. Hobby cron timing
  is approximate, so an expired trip link stops working at six hours, while
  physical deletion can occur later. API requests also attempt a small,
  opportunistic cleanup every 15 minutes. Cleanup caps each run to avoid
  exceeding the function time limit; unusually large deletion backlogs may
  require more than one run.

## Vercel environment variables

Set these in the Vercel project's environment settings before deploying:

| Variable | Purpose |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin service-account JSON for the Firestore project already imported |
| `SESSION_SECRET` | HMAC key for private contact matching and persistent rate-limit identifiers; use the same value used for the Firestore import |
| `CRON_SECRET` | Protects the daily cleanup route; Vercel sends it as a bearer token to Cron Jobs |
| `RESEND_API_KEY` | Direct Resend API key for Vercel email verification |
| `VERIFICATION_EMAIL_FROM` | Verified sender address for verification email |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` | Optional direct Twilio credentials and SMS sender |
| `HeiGET`, `ORS_API_KEY`, `GRAPHHOPPER_API_KEY` | Optional route-planning providers; configure at least one to enable live routing |
| `EXPO_ACCESS_TOKEN` | Optional authenticated Expo push delivery |
| `APNS_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID` | Optional Apple Live Activity delivery |
| `EXPO_PUBLIC_API_URL` | Vercel app origin when building the separate native app; leave unset for the web build |

The Replit Resend connection and `@replit/connectors-sdk` are only available to
code running on Replit. On Vercel, Tagalong calls Resend and Twilio directly
using the environment variables above. Email verification is unavailable until
the Vercel `RESEND_API_KEY` and verified sender are set; SMS requires all three
Twilio variables.

## Background work and limits

Notifications, widget updates, and remote-drive stop checks run opportunistically
after API requests via Vercel's `waitUntil`. They are best-effort: if no relevant
requests arrive, work can be delayed or missed. The daily cron is for cleanup
only; it does not restore the old five-second alert timing.

Hobby cron runs at most once daily and may be delayed. The API function has a
60-second execution limit. Expired trip links are rejected immediately by the
API even if Firestore cleanup has not run yet.
