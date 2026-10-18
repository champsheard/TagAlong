---
name: Tagalong provider constraints
description: Public Nominatim usage boundaries and least-privilege email-provider setup.
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

OSM raster-tile probes from the shell should include a descriptive User-Agent
and Referer.

**Why:** A headerless request returned an OSM tile-policy denial in this
environment, while an identified request for a nearby tile returned a PNG.

**How to apply:** When diagnosing tile access with curl, include both headers
before concluding that the tile host is blocked or changing the app's provider.

Resend send-only authorization need not be broadened just to discover sender domains.

**Why:** The connected authorization rejected domain listing with “This API key
is restricted to only send emails.” That restriction is compatible with sending
verification codes; an inability to list domains is not proof of a broken connection.

**How to apply:** If domain discovery is permission-blocked, ask for a sender
address on a Resend-verified domain and configure it through the environment
variable flow. Do not replace the key or default to a restricted test-domain
sender for general recipients.

OpenRouteService directions should use `api.heigit.org/openrouteservice/v2`,
not the deprecated `api.openrouteservice.org/v2` host. The provider says the
existing API key remains valid on the new URL.

**Why:** The provider deprecated the old host on April 28, 2026 and reduced its
quota before its planned November 2026 shutdown. A real route request through
the old host timed out in this project.

**How to apply:** Keep ORS requests on the HeiGIT host and verify actual routes
against the provider's status page when route requests time out.
