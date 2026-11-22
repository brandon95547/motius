# 0010 Budgets are measured on a production build

Accepted, 2026-11-22. Corrects the figures in 0003, 0007, 0008 and 0009.

**Context.** The root `.env` sets `NODE_ENV=development` for the API, and Vite reads it into a build too. So every local `npm run build` shipped React's development build, about 58 KB gzipped more on every page. CI has no `.env` and built production React. The sizes measured locally, and the ceilings set from them, were too high by that much. CI caught it when the dashboard turned out to be under the limit.

**Decision.** A build is always production. The web app's `build` script sets `NODE_ENV=production`, and a Vite plugin (`productionBuildsOnly` in `apps/web/vite.config.ts`) refuses any build whose resolved config is not production, naming the cause. Sizes are measured only on such a build.

**Consequences.** The real figures, gzipped JavaScript:

| Page         | Size     |
| ------------ | -------- |
| Sign-in page | 84.3 KB  |
| Dashboard    | 138.5 KB |
| Workspace    | 212.0 KB |

The sign-in page and the dashboard are under the 150 KB limit and have no ceiling. The workspace's ceiling is 213 KB. The sizes in earlier records were measured on development builds; their before-and-after comparisons hold, because both sides carried the same extra React code.
