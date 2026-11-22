# 0009 The API's replies are checked on the server, and the browser carries no zod

Accepted, 2026-11-22.

**Context.** The browser checked every API reply against the shared zod schemas, so every page loaded all of zod in its entry, before anything else. The shared domain modules also mixed plain values (limits, lists) with schemas, and the browser imports those values, so zod came along with them even where nothing was checked. The exercise builders built spec schemas that nothing ever parsed. Every page was over the 150 KB limit because of it.

Whether to check replies in the browser is a judgment call. Some respected advice says to (TkDodo, "Type-safe React Query", 2023): TypeScript types exist only while code is written, and a reply that differs from them fails far from its cause. No authoritative source says what most teams do.

**Decision.** The server is where data is checked, both ways.

- **Requests.** Each route checks its body against the shared schema, as it did.
- **Replies.** Each route's response schema checks what is sent before it leaves the server.
- **The browser client** (`lib/api.ts`) types each reply from the shared schemas and does not check it again. It still says so when a reply is not JSON at all (`unreadable_response`), and still carries the server's own errors.
- **Runs a device kept** are sent as they are. `POST /runs` checks each one on its own and skips, and logs, one it cannot read instead of refusing the rest, so a run an older release wrote cannot hold the queue back. The reply says how many it skipped.
- **The shared package keeps schemas apart from values.** Each domain module's plain values stay in `domain/<name>.ts`, and its schemas move to `domain/<name>-schemas.ts`. The builders' spec schemas move to `learning/practice-specs.ts`, and the builders take only their types.
- **The two reply shapes the client wrote out a second time** (the piano catalog and a registered keyboard) are now shared schemas (`instrumentsSchema`, `registeredDeviceSchema`), used by their routes.
- **`check:budgets` fails if any browser chunk carries zod,** naming the chunk.

**Consequences.** The entry went from 153 KB to 130 KB gzipped. The sign-in page went from 165 KB to 142 KB, the first page under the 150 KB limit, so its ceiling is gone. The dashboard went to 198.6 KB and the workspace to 277.2 KB, and their ceilings came down to 199 and 278.

What is given up: a clear error in the browser if a deploy ever changes a reply's shape that an open tab still relies on. Keeping API shapes as they are, unless a change is asked for, is what guards that. If that rule is ever relaxed, check replies again, with `zod/mini` or Valibot, loaded on demand.
