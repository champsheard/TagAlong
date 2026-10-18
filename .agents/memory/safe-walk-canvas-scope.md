---
name: Tagalong canvas targeting
description: User expects visual edits to affect the explicitly selected Tagalong frame; home and map redesigns are separate scopes.
---

When making Tagalong visual changes, identify and edit only the explicitly selected canvas frame and its referenced visual. The home-screen redesign and map-screen redesign are separate UI tasks; completing one does not update the other.

**Why:** The user reported that changes were not visible after earlier work affected the map prototype while the selected frame was the home redesign.

**How to apply:** Before coding, inspect the selected frame's component path and visual reference. After editing, capture that same frame to confirm the visible change.
