---
name: Safe Walk driving support
description: Driving route and live-sharing limits chosen for the current Safe Walk milestone.
---

Driving routes use the car-routing profile and may be up to 300 km. The route ETA is capped at five hours so the existing six-hour active-trip expiry leaves time for the trip to complete. The six-hour sharing lifetime is unchanged.

**Why:** The user requested driving routes with a much longer limit for live safety tracking but did not specify an exact distance. The initial 300 km limit and five-hour ETA are implementation choices that preserve a bounded sharing window.

**How to apply:** Keep the walking limits (15 km start separation and 25 km route length) unchanged. Drive estimates are not turn-by-turn navigation and do not include live traffic rerouting or road-closure alerts. Do not show walking-lighting scores for driving. Keep mode visible in the shared tracking page, inbox, and widgets while preserving existing private-link and active-trip privacy rules.
