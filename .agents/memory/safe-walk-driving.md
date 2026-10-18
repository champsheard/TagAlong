---
name: Tagalong driving support
description: Driving route and live-sharing limits chosen for Tagalong.
---

Driving routes use the car-routing profile and may be up to 300 km. The route ETA is capped at five hours so the existing six-hour active-trip expiry leaves time for the trip to complete. The six-hour sharing lifetime is unchanged.

Real, non-demo drives also use an isolated-stop warning: after the device remains within 35 m for 60 seconds and mapped buildings or places are absent within 250 m, Tagalong gives the driver 15 seconds to cancel, then queues a warning to app contacts receiving the drive. The trip remains active and location sharing continues. Map, GPS, network, and notification availability limit reliability; this is not an emergency service.

**Why:** The user requested driving routes with a much longer limit for live safety tracking and a warning for a possible carjacking; they chose a 15-second cancel window. The thresholds are explicit heuristics, not a guarantee that an area is actually remote.

**How to apply:** Keep the driving stop warning limited to active real drives; do not end the trip when it fires. Warnings go to in-app contacts shared on that drive; private-link viewers do not receive push notifications. Keep the walking limits (15 km start separation and 25 km route length) unchanged. Drive estimates are not turn-by-turn navigation and do not include live traffic rerouting or road-closure alerts. Do not show walking-lighting scores for driving. Preserve private-link and active-trip privacy rules.
