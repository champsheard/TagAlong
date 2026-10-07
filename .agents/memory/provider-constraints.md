---
name: Safe Walk provider constraints
description: Public Nominatim's prohibition on autocomplete and provider scaling boundaries.
---

Public Nominatim must be called only after deliberate search submission, never
as a client-side autocomplete service.

**Why:** Its official usage policy explicitly forbids autocomplete, in addition
to requiring a globally enforced maximum of one request per second, identifying
User-Agent, and caching. A debounce alone does not satisfy this policy.
Source: https://operations.osmfoundation.org/policies/nominatim/

**How to apply:** Preserve an explicit Search action/keyboard submission. If
autocomplete or higher volume is requested, first choose a suitable geocoding
provider or self-hosted endpoint rather than silently using the public service.
