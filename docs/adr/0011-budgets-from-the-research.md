# 0011 Budgets from the research, and a growth alarm in place of ceilings

Accepted, 2026-11-26. Replaces the ceilings of 0003, 0008 and 0010 and the 150 KB limit they were measured against.

**Context.** The limit for an app page was 150 KB of gzipped JavaScript. The workspace has been over it since the app was split (0008), so it kept a ceiling at what it weighed, which could only come down. That left it under a kilobyte of room: every feature on the workspace failed the check, however small, and the only ways through were to take something away or to move code to wherever it would fit. Neither is a reason to put code anywhere. The code was already split by page and by tool; the number was the problem.

Alex Russell's _Performance Inequality Gap, 2024_ works out what a phone and a network at the 75th percentile can load in 3 seconds: about 365 KB of compressed JavaScript for a JavaScript-heavy site, and about 75 to 100 KB for a markup-heavy one. Motius is the first kind: a piano engine, a staff, audio and MIDI.

**Decision.**

- **Budgets per page, from that research** (gzipped): 350 KB of JavaScript for an app screen (the dashboard, the workspace), 100 KB for the sign-in page, 60 KB of CSS for any page, and 100 KB of its own for a chunk loaded on demand.
- **A growth alarm instead of a ceiling.** `scripts/page-sizes.json` records each page's size. `check:budgets` prints each page's change since the record and fails one that grew more than 10 KB, until `npm run check:budgets -- --record` updates the record in that change, which says why the page grew. Ordinary features fit; a library or another tool's code landing on the wrong page is named.
- **Code lives where its job puts it.** When a page goes over, the fix is the feature that is on a page it does not belong to, loaded with its own page or tool. Nothing moves to fit a number.
- The real targets stay what people feel: LCP under 2.5 s and INP under 200 ms on a mid-range phone. The bytes stand in for them in CI.

**Consequences.** `scripts/budgets.json` is gone. Recorded today: the sign-in page 84.3 KB, the dashboard 138.9 KB, the workspace 208.4 KB, each within its budget with room to grow. The checks that the workspace, the builders and the lesson sections load on demand, and that no chunk carries zod, are unchanged.
