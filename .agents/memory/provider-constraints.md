---
name: Safe Walk provider constraints
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

Resend send-only authorization need not be broadened just to discover sender domains.

**Why:** The connected authorization rejected domain listing with “This API key
is restricted to only send emails.” That restriction is compatible with sending
verification codes; an inability to list domains is not proof of a broken connection.

**How to apply:** If domain discovery is permission-blocked, ask for a sender
address on a Resend-verified domain and configure it through the environment
variable flow. Do not replace the key or default to a restricted test-domain
sender for general recipients.
