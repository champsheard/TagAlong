---
name: Tagalong video demo
description: Constraints for a video-ready capture of the Tagalong app.
---

**Rule:** Video demos should show the actual Tagalong interface, not recreated screens. Keep the showcase isolated from saved trips, contacts, and live location, and use simulated routes.

**Why:** The user explicitly asked for a demo using the real app UI. Narrow capture viewports can make React Native Web layouts wrap badly, so keep the embedded app at a standard phone viewport and scale it into the presentation frame. Expo may also briefly return a startup 503 before Metro is ready.

**How to apply:** For future capture work, preserve the showcase mode, fit the standard phone layout to the frame, and retry transient web-preview startup responses instead of treating them as permanent failures.
