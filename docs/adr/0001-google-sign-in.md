# 0001 Sign in with Google; sessions in a cookie

Accepted, 2026-11-20.

**Context.** Practice history and lesson settings had to follow a player across devices, and an admin had to set how lessons open for everybody.

**Decision.** Every route but health and sign-in needs an account. The browser gets Google's ID token from its sign-in button; the API verifies it against Google's keys (`apps/api/src/clients/google.ts`) and starts a session in an HttpOnly, SameSite=Lax cookie, storing only the session token's hash. Admins are the addresses in `ADMIN_EMAILS` in the root `.env`. No client secret is used.

**Consequences.** No passwords are kept. Running the app needs a Google client ID with the app's origin allowed. Runs kept on a device before accounts move to the first account that signs in there.
