# Optional contacts, notifications, and native widgets

## What stays account-free

Planning a walk, location sharing and opening any private tracking link work
without enrollment. Starting a walk does not automatically open the share sheet;
the walker chooses an app contact or shares the link through their normal app.

Contact names and raw address-book entries remain on the phone. On-device
normalization uses E.164 numbers and lowercased email, with a user-selected country
for numbers without a country prefix. Names are held in screen memory, not uploaded.
Only SHA-256 identifier digests are submitted for lookup. The server applies
HMAC with `SESSION_SECRET` before storing/querying the index. These are matching
identifiers, not anonymous data; do not advertise this as zero identifier processing.

Proving ownership requires sending **the user's own** normalized identifier to
the verification provider, transiently through the server. The six-digit challenge
expires after ten minutes, permits five attempts, and is stored as a keyed hash.
Device tokens are kept in SecureStore on native devices. Web enrollment uses
local browser storage and is not advertised as a mobile app match.

Only verified, discoverable iOS/Android enrollments seen in the past 30 days match.
Discovery can be hidden; deleting enrollment removes identifiers, push tokens,
inbox associations and widget subscriptions. Inactive enrollments are purged
after 90 days. Phone contacts are never deleted. Existing private trip links
continue to work according to their original six-hour/four-hour expiry.

## Configure verification

Connect **Twilio** for SMS and/or **Resend** for email in the workspace integration
flow. The server uses `@replit/connectors-sdk` so integration credentials are
handled by Replit; never put credentials in the mobile bundle.

- Twilio codes use the **Messaging API**, not an unconfigured Verify service.
  The account needs an SMS-capable sender, recipient permissions and balance.
  `TWILIO_SMS_FROM` optionally selects the sender; otherwise the server selects
  an SMS-enabled number returned by the account.
- Resend needs `VERIFICATION_EMAIL_FROM`, a sender on a verified domain.
  Configure this as a non-secret environment variable.
- `SESSION_SECRET` must be set as a server secret and remain stable.
- Unconnected/unconfigured providers return explicit unavailable errors. There
  are no pretend successful verifications, default development codes or demo users.

After enrollment, **Sync my phone contacts** asks for contacts permission, reads
only accessible contacts (including iOS limited access), matches in batches, and
ranks mobile matches first. The sync limit is 5,000 accessible contacts. Non-app
contacts use the ordinary system share sheet; Safe Walk does not claim to choose
the destination inside another app's share sheet.

## Native build and push

Push and widgets require native builds, not Expo Go. Optional native widget
modules are loaded only in those builds so core walking still works in Expo Go.

1. Link this app to an Expo/EAS project and configure its push credentials.
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` and `EXPO_PUBLIC_API_URL` in the **build**
   environment. The API URL must be its real HTTPS origin.
3. Build using the provided `eas.json` preview or production profile; for example,
   `npx eas-cli build --platform android --profile preview`. An iOS build requires
   the appropriate Apple signing/provisioning.
4. On a physical phone, verify your identifier and select **Enable app notifications**.
5. Enroll a second phone and share an active trip through its matched app contact.

The app inbox works independently of push permission. Android notification
channel `walks` is created before permission is requested. Tapping a notification
opens `/track/<code>`. Notifications are queued with bounded retries; acceptance
by Expo is **not proof of delivery or that a person saw the message**.
Location updates produce Android widget-data notifications at most once per minute.
Arrival/help produces a visible status notification. OS/device/network restrictions
can delay or suppress notifications and background tasks.

## Tracking widgets

Recipients open a tracking map and explicitly choose the widget action.

- **iOS:** Adds a lock-screen Live Activity/Dynamic Island summary showing ETA,
  demo/help/arrival/older-location status and a deep link to the map. One selected
  activity is kept per device. Activity-specific push tokens are registered with
  the API; local updates work while the tracking screen is open.
- **Android:** Selects the walk for the `SafeWalkTrackingWidget` home-screen
  widget. The user adds that widget through the launcher. Background notification
  tasks and home-screen widget refreshes update the snapshot. The displayed
  last-fix time and snapshot label do not claim continuous live GPS.

For iOS background Live Activity updates configure these **server secrets** using
the secure secrets flow: `APNS_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`.
Optional non-secret settings:

| Variable | Purpose |
| --- | --- |
| `IOS_BUNDLE_IDENTIFIER` | Match the signed app; defaults to `app.safewalk.mobile`. |
| `APNS_SANDBOX` | Defaults to sandbox; set `false` for production APNs. |

The server signs ES256 APNs requests, updates subscribed activities no more than
once per minute, and ends them on arrival/help/expiry. The activity gets a
two-minute stale deadline. Without APNs configuration, the UI explicitly warns
that iOS background updates are unavailable. APNs is not a location source.

The walker still needs Safe Walk open in the foreground. **No background walker
location permission has been added.** Widgets cannot make a stopped or missing
GPS fix current. Help does not call emergency services; contact the walker
directly and call emergency services yourself when needed.

## Verification limits

Backend tests use isolated in-memory SQLite and synthetic gateway/notification
adapters; they never send real SMS/email/push. Web/iOS/Android bundle checks do not
verify OS permissions, provisioning, phone contacts, APNs, or delivery. Before
shipping, exercise contact sync, notifications, widget updates, help/arrival,
denied permission and offline behavior on actual iOS and Android devices.
