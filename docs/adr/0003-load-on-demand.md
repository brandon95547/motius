# 0003 Load what is off the first screen on demand

Accepted, 2026-11-20.

**Context.** The app shipped as one 1.3 MB script (367 KB gzipped), so the sign-in page carried the whole app.

**Decision.** The entry holds only the sign-in check. The sign-in page and the signed-in app are chunks of their own; every panel, dialog, the song chooser and its file readers, Progress and the admin's page load the first time they open (`ui/OnDemand.tsx`). `npm run check:budgets`, run in CI after the build, measures each screen. The global limit is 150 KB of JavaScript; the screens still over it have a ceiling in `scripts/budgets.json` at what they weigh, which only comes down.

**Consequences.** The sign-in page went from 367 KB to 168 KB and the signed-in app to 306 KB. What is left: the shared schemas bring all of zod to the entry (moving them to `zod/mini` would shrink it), and the stores import the exercise builders, so the dashboard loads the practice workspace's code (loading the workspace on demand would remove it).
