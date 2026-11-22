# 0004 A lesson's address outlives its title

Accepted, 2026-11-20.

**Context.** A lesson's address was made from its title, and the address is the key its runs and admin settings are saved under. Shortening the titles would have orphaned them.

**Decision.** A renamed lesson keeps its old address with `id` in its outline entry (`lib/outline/categories.ts`). Only a new lesson takes its address from its title.

**Consequences.** An address can differ from the title it shows. Changing an address means moving the saved runs and settings with it, in the same change.
