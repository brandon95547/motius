# 0005 A MIDI keyboard's settings belong to an account

Accepted, 2026-11-20.

**Context.** The devices table had no owner, so any signed-in player could read, change or delete every keyboard's settings.

**Decision.** Migration 6 gives each device a `user_id` (primary key `(user_id, id)`, deleted with the account). Every device query is scoped to the signed-in account, and another account's device answers 404. Existing devices went to the lowest user id, or were dropped where there was none.

**Consequences.** The same keyboard on two accounts is two rows, each with its own settings.
