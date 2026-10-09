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

On 2026-10-06 the user selected “Automatic phone/email matching” rather than
private QR pairing, explicitly accepting verified identifier matching and a change
to the earlier no-identifier-collection promise. Optional app-recipient
notifications and native tracking widgets are now approved scope.

**Why:** The user's current request supersedes the MVP's earlier restriction;
do not block matching with the obsolete promise, or quietly expand it beyond
the consented identifiers.

**How to apply:** Keep names/address books on-device, collect only what ownership
verification needs, make discovery optional/removable, and preserve sharing links
with anyone. Hashing does not mean zero identifier processing. Help still stops
GPS and freezes the last-known fix; app notifications are best effort, never
emergency calls. Do not say a notification was delivered merely because queued.

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
