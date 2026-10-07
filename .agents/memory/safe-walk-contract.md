---
name: Safe Walk delivery and privacy
description: User-defined milestone pauses and privacy boundaries for the Safe Walk product.
---

The user requires milestone delivery and a stop after each milestone so they can test before work proceeds.

**Why:** The build brief explicitly says “deliver in milestones (stop after each so I can test it).”

**How to apply:** Deliver only the current milestone, report what was verified, and wait for the user's next instruction before implementing the next milestone. Do not add stretch features before the MVP works.

Safe Walk must have no user accounts, no collection of names, emails, or phone numbers, and no ads, analytics, or third-party trackers. Live location sharing is limited to an active trip and must stop on arrival or expiry. Precise coordinates must never be written to server logs.

**Why:** These are explicit product privacy and safety rules in the user's build brief, not optional implementation preferences.

**How to apply:** Preserve these boundaries when adding maps, trips, tracking, storage, logging, or external services. Do not add authentication or analytics as incidental improvements.
