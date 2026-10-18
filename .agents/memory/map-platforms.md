---
name: Tagalong map providers
description: Platform-specific basemap choice and matching attribution.
---

On iOS, use native Apple Maps as the basemap instead of overlaying OSM raster
tiles. Android and web may continue using OSM where Apple Maps is not the native
provider. Show attribution only for the provider actually displayed.

**Why:** The product prefers Apple Maps' visual detail at close zoom. An OSM
overlay caused Apple imagery to flash through before replacing it and did not
provide enough detail at house-level zoom.

**How to apply:** Keep native map-provider selection and attribution conditional
on platform. Do not layer OSM tiles over the iOS MapKit basemap.
