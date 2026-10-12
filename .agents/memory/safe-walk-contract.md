---
name: Safe Walk delivery and privacy
description: User-defined milestone pauses and privacy boundaries for the Safe Walk product.
---

The user requires milestone delivery and a stop after each milestone so they can test before work proceeds.

**Why:** The build brief explicitly says “deliver in milestones (stop after each so I can test it).”

**How to apply:** Deliver only the current milestone, report what was verified, and wait for the user's next instruction before implementing the next milestone. Do not add stretch features before the MVP works.

Walk planning and link tracking stay account-free. No ads, analytics or third-party
trackers may be added. Location sharing is limited to an active trip and must stop
on arrival, help or expiry. Precise coordinates and identifiers must not enter logs.

**Why:** These are explicit product privacy and safety rules in the user's build brief, not optional implementation preferences.

**How to apply:** Preserve these boundaries when adding maps, trips, tracking,
storage or services. Do not turn optional contact enrollment into mandatory login.

On 2026-10-06, the user selected automatic phone/email matching rather than
private QR pairing. On 2026-10-09, they chose local matching against opted-in,
verified, discoverable Safe Walk devices and email verification for the sender.
On 2026-10-10, they chose default-on automatic sharing to all such matches from
the sender's device address book, with a user-accessible opt-out for future walks.
This is not a broadcast to every Safe Walk installation. Safe Walk remains
account-free.

**Why:** The user's latest choice supersedes the prior explicit-share-only rule,
while preserving control over which contacts can match and whether future walks
are shared automatically.

**How to apply:** Keep names and raw contact details local; send only locally
hashed phone/email identifiers for discovery. Require the sender to be verified,
use Contacts permission only if already granted (never prompt at walk start),
and match only recipient devices that are verified, opted in, and discoverable.
Auto-share real walks only, not simulated demos. Turning auto-share off affects
future walks and does not revoke a current share. Non-matches receive a private
link only when the user chooses to send one. Keep push delivery best-effort and
never claim delivery merely because a notification was queued. Preserve
enrollment removal.

After the server accepts a walker's confirmed arrival, notify enrolled trusted
app contacts who received that trip and have registered push tokens. Link-only
recipients can see the arrival status when they reopen the private link. Delivery
is best-effort.

**Why:** The user requested an arrival notification for trusted contacts, while
the existing privacy boundary only permits push to contacts enrolled and already
shared into that trip.

**How to apply:** Trigger on the server's active-to-arrived transition, not while
the local end command is pending; never notify unmatched contacts.

The user approved background location for all real active walks after a one-time
OS background-permission grant. If permission is denied or unavailable, keep
updates foreground-only. Never collect background location for demos or after
arrival, help, or expiry.

**Why:** The user explicitly requested background updates for shared walks and
chose automatic use after granting the system permission once. A locked phone
also needs narrowly scoped access to the trip token so the background task can
authenticate location updates.

**How to apply:** Explain the behavior before requesting permission, request it
only after foreground permission and walk consent, stop the location task when
sharing ends, and keep exact coordinates out of persistent storage and logs.
Only small trip credentials may use after-first-unlock Keychain access, and only
when background permission is granted.

Before a walk, foreground location may center the map. An explicit nearby-place
search may send the position to Safe Walk for in-memory result ranking; pass only
a rounded neighborhood area to the public geocoder, and never log or persist the
exact point. Contact location sharing still begins only with an active walk.

**Why:** Nearby search needs a useful starting point without broadening the
existing trip-sharing or public-geocoder privacy contract.

**How to apply:** Request foreground permission for map focus, send location only
on a deliberate search, and keep the exact position out of caches and logs.

Post-arrival feedback is optional and sent only after an explicit submit action.
Keep it anonymous: do not store account identity, precise coordinates, or the
private trip link. The user approved 90-day retention and wants the form to
disclose that entered street names can reveal where someone walked. Ask for a
1–5 route rating first, then optional user-entered street/block lighting ratings
and notes. “Plan another walk” must remain available without sending feedback.

**Why:** The user chose anonymous feedback to Safe Walk with bounded retention,
and street-level reports can reveal sensitive location context.

**How to apply:** Validate and rate-limit feedback server-side. Use entered street
or block descriptions because the route API does not provide street names.
Automatically delete reports after 90 days and never log sensitive fields.

Collect arrival feedback only after a real walk is confirmed arrived; omit demos,
help-status trips, and expirations.

**Why:** Simulated routes and lighting must not be mistaken for real street
conditions, and help or expiry is not a confirmed arrival.

**How to apply:** Show the survey after the arrival status reaches the server and
the pending end command clears. Keep it optional and leave “Plan another walk”
available without submission.
