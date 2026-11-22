# 0006 Badges, titles and streaks are worked out from the runs

Accepted, 2026-11-20.

**Context.** Players should see where they stand and what to aim for, as a game shows it: a title, a practice streak, a weekly goal, the course's progress and badges, and the moment a badge unlocks.

**Decision.** Nothing earned is stored. Badges, the title, the streak and the course journey are worked out from the player's runs every time (`apps/web/src/lib/achievements/`), with one list of badges in `badges.ts`. The account keeps only what cannot be worked out: the weekly goal the player chose, and which badges they have seen unlock, so a reveal is shown once on any device (`GET /goals`, `PUT /goals/weekly`, `POST /goals/seen`). Starting the lessons over forgets the course badges seen; starting fresh forgets the goal and every badge seen. A title comes from how far the player is in the course, not from points. The streak forgives one day off a week. The badges and their rules load only where they are shown — the Progress page, the dashboard's next goal and a lesson's results — so the first screen does not carry them.

**Consequences.** A reset takes the badges away with the runs, and earning one again shows its reveal again. A badge is added by one entry in the list. The badge pictures are placeholder shields until art is drawn (`ui/AchievementBadge.tsx`).
