---
name: Tagalong routing failover
description: Provider precedence and attribution for live route planning.
---

**Rule:** OpenRouteService/HeiGIT remains the primary route provider. GraphHopper is a server-side backup only when OpenRouteService is unconfigured or fails; preserve the route-source disclosure and linked attribution.

**Why:** The user initially chose to keep OpenRouteService, then explicitly approved GraphHopper failover during its outage. GraphHopper fits the app's existing OpenStreetMap/Apple Maps display better than Google Routes.

**How to apply:** Keep provider keys server-only, send route coordinates to GraphHopper only during failover, and carry provider identity through planned and shared routes so attribution remains visible.
