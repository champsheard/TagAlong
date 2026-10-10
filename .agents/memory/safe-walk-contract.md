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
private QR pairing. On 2026-10-09, they updated native sharing to match saved
contacts against opted-in, verified, discoverable Safe Walk devices. They chose
email verification for the sender's own device. A match receives an explicit
in-app trip share, inbox entry, and best-effort push; a non-match receives a
private link through the native messaging/share UI. Safe Walk remains account-free.

**Why:** This latest choice supersedes the earlier native link-only direction.
Sharing a live location remains a deliberate action; merely syncing a contact
must not expose an active trip.

**How to apply:** Read names and raw contact details locally, and send only
locally hashed phone/email identifiers for matching. The verification email goes
to the sender, never the selected contact. Require the recipient to have opted
in and verified an identifier; add successful shares to the recipient inbox
without a second acceptance step. Keep the private-link path for unmatched
contacts, keep notification delivery best-effort, and never claim delivery merely
because a notification was queued. Preserve explicit enrollment removal.

Background recipient widgets do not authorize background walker GPS collection.

**Why:** The current expansion is contact matching and recipient tracking, not
a change to the foreground-only walking contract.

**How to apply:** Keep the foreground requirement clear even when recipient
widgets support background status updates.

Before a walk, foreground location may center the map. An explicit nearby-place
search may send the position to Safe Walk for in-memory result ranking; pass only
a rounded neighborhood area to the public geocoder, and never log or persist the
exact point. Contact location sharing still begins only with an active walk.

**Why:** Nearby search needs a useful starting point without broadening the
existing trip-sharing or public-geocoder privacy contract.

**How to apply:** Request foreground permission for map focus, send location only
on a deliberate search, and keep the exact position out of caches and logs.
