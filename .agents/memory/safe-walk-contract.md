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
