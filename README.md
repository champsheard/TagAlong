# Safe Walk

Safe Walk compares **Fastest** and **Best lit** walking routes, then lets a trusted
contact follow one private trip in a phone browser. The same Expo Router /
React Native TypeScript screens run on web, iOS, and Android. Express and
better-sqlite3 provide routing, lighting estimates, and time-limited trip storage.

Walk planning and link tracking need no account. Optional app contacts use verified
phone/email ownership and device enrollment. Contact names stay on-device; the
server stores keyed matching hashes, not the address book. Your own identifier is
processed transiently by the server and verification provider. No ads or analytics.
**This is not an emergency service or a safety guarantee. Call 911 when needed.**

## Requirements

- Node.js 22.13 or newer (the workspace uses Node 22)
- npm
- Expo Go matching Expo SDK 57 for core walking; native builds for push/widgets
- An OpenRouteService API key for real walking routes. Key-free Demo walk works now.

## Run in Replit

The project uses two workflows:

- **Safe Walk Web** serves the Expo web preview and API proxy on port 5000
  (Metro runs internally on 8081).
- **Safe Walk API** runs the Express API on port 3001.

The API health endpoint is `GET /api/health`.

The development web server proxies `/api` to port 3001, so web requests and
`/track/<code>` use the same origin. Add **ORS_API_KEY** through Replit Secrets.
Never put it in an `EXPO_PUBLIC_*` variable or commit it.

## Run locally

```sh
npm install
npm run dev:web
```

In a second terminal:

```sh
PORT=3001 npm run dev:server
```

Copy `.env.example` to `.env` for local setup. The API reads this optional file;
Expo also reads public variables from it. Restart the API after changing a key,
and reload the browser to refresh the routing-availability notice.

## Environment variables

| Variable | Use |
| --- | --- |
| `ORS_API_KEY` | Server-only OpenRouteService key; required for live routing. |
| `EXPO_PUBLIC_API_URL` | HTTPS API/web origin for the native app, without `/api` or a trailing slash. Web uses same-origin `/api`. |
| `PORT` | Express port; development workflow sets 3001, production defaults to 5000. |
| `DATABASE_PATH` | Optional writable SQLite path; default `data/safe-walk.sqlite`. |
| `API_PORT` | Optional development proxy target; default 3001. |
| `APP_USER_AGENT` | Optional identifiable User-Agent for Nominatim (recommended to include your app URL/contact). |
| `NOMINATIM_URL` | Optional geocoding provider base URL; lets you switch to a self-hosted/compatible service without updating the app. |

Core trips need no session secret: access is by a private trip link plus a separate
device write token. Optional contact matching requires a stable server-only
`SESSION_SECRET` for keyed identifier hashing. Enrollment tokens and trip write
tokens are hashed in the database. Rotating this secret invalidates the existing
matching index; arrange re-verification rather than silently losing matches.

## iOS / Android with Expo Go

1. Set `EXPO_PUBLIC_API_URL` to the HTTPS origin serving both `/api` and the web
   tracking page. In Replit development use the preview's public HTTPS origin,
   not `localhost` or the API's internal port.
2. Start both workflows. Use `npx expo start --tunnel` when a phone cannot reach
   the development server over the local network; scan its QR code with Expo Go.
3. Allow foreground location. Keep Safe Walk open and the screen awake during
   the trip. Background location is deliberately **not** requested or supported.

Native maps use react-native-maps `UrlTile` with OpenStreetMap tiles; web uses
React Leaflet. SDK-matched Reanimated/Worklets versions are pinned because newer
peer versions do not match the Expo Go native runtime.

See [contacts and widgets setup](docs/contacts-and-widgets.md) for optional verified
matching, provider connections, native builds, notification permissions and APNs.

## Try the complete flow without a routing key

1. Tap **Take a Demo walk instead**.
2. Compare the explicitly simulated routes and lighting scores; choose one.
3. Review consent and start the walk. Choose **Share link** or **Contacts**.
4. Open the private link in another browser/tab, or on another phone.
5. The demo dot moves along the selected route over 90 seconds, updating every
   five seconds. Mark arrival or confirm **Need help** to see the tracking status
   change. For a real route, turn on **Demo walk** to simulate only movement.

Demo fixture routes/scores are not actual routing or lighting data. Demo trips
use the real trip API and a real private link. Demo movement stops at the route's
end but sharing remains active until arrival/help/expiry; it does not pretend
the walker actually arrived.

## Lighting estimates

OpenRouteService supplies up to three foot-walking alternatives. Overpass supplies
street lamps, `lit=yes` ways, explicitly 24/7 shops/amenities, selected essential
amenities, and transit stops in a buffered area, cached for 24 hours.

Address search requires tapping **Search** or submitting with the keyboard.
Public Nominatim forbids client-side autocomplete; requests are globally limited
to one per second and cached. Review its
[usage policy](https://operations.osmfoundation.org/policies/nominatim/) before
scaling up; use a suitable provider/self-hosted endpoint for higher volumes.

`server/src/lightingConfig.ts` contains tunable weights, normalization caps,
buffers, and sparse-data threshold. The normal score is
`100 × (0.6 L + 0.3 A + 0.1 U)`:

- **L:** lamps within 25 m per 100 m, normalized and capped.
- **A:** mapped activity within 30 m per 100 m, normalized and capped.
- **U:** share of route length near `lit=yes` ways, estimated by equal-distance sampling.

Sparse lamp data switches to normalized A/U weights and an explicit limited-data
warning. Activity is a proxy, not proof of people present or a business being open
right now. An Overpass outage returns an **unavailable** estimate, never a fake
live lighting score. The two choices may share a path when fastest is also best
lit or only one route is available.

## Sharing, safety, and retention

- Location sends and contact polls run every five seconds while open, subject to
  GPS/network delays. A missing update for two minutes makes the contact banner amber.
- Web needs HTTPS for location and clipboard. Denied permission, failed GPS,
  unavailable providers, and offline requests show explicit errors.
- Native write credentials use SecureStore. Web stores them in the walker's local
  browser storage; never share them. A reload can resume an unexpired trip.
- Anyone holding the link can read the trip. Send it only to a trusted contact.
- Arrival stops updates. **Need help also stops updates**, freezes the last-known
  location, and marks the contact's tracking page red. Selected app recipients
  receive a queued status notification when available. Link-only recipients must
  view the link. No emergency call or SMS help alert is made; delivery is not guaranteed.
- If ending fails offline, this device stops sharing immediately and retries only
  the end command. Keep the screen open until it sends.
- Links expire six hours after start, or four hours after arrival/help. Expired
  links return 404 even before the hourly purge deletes their data.
- The API never logs precise coordinates or credentials. Requests to routing,
  mapping, and geocoding providers necessarily disclose relevant query/location
  data to those providers; they are not analytics or tracking integrations.

## Production web serving

```sh
npm run build
PORT=5000 npm start
```

Express serves the exported `dist` SPA and all `/api` endpoints, including browser
refreshes at `/track/<code>`. Set the server-only key in the hosting environment;
set the native public API origin to that same HTTPS host.

SQLite needs a **persistent writable filesystem and a single API instance**.
Choose hosting that guarantees this; ephemeral/multiple-instance deployments
will lose or split trip data. Back up the database if you need durable retention.

## Verification

```sh
npm run typecheck
npm test
npx expo install --check
npm run export:web
```

Backend tests use a separate in-memory database and mocked external providers.
They cover token authorization, no writes after arrival/help, expiry/purge,
validation, lighting normalization/fallback, and geocoding throttle/cache. Live
provider verification needs a valid ORS key. Native bundling is not a substitute
for checking GPS, sharing, and maps on actual iOS/Android devices.

With development workflows running and Chromium on PATH,
`node scripts/contacts-browser-smoke.cjs` checks the map-first demo walk, explicit
sharing choice, optional enrollment/removal, provider-unavailable states and
tracking/arrival at 390 px width. It writes screenshots to `/tmp/safe-walk-browser`
and creates only its own temporary demo trips/enrollment. Set `CHROMIUM_BIN` if needed.
