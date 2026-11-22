# 0007 Lessons are content, loaded a section at a time

Accepted, 2026-11-21.

**Context.** Every written lesson's exercise was compiled into the signed-in app, so each new lesson made the first screen heavier for everyone. The four Fingers & Hands songs took the app 2.2 KB over its ceiling at fourteen lessons, with hundreds outlined.

**Decision.** The app is the player and the lessons are its content. Each section's lessons, their notes and their introductions, are a module of their own in `packages/shared/src/learning/` (`keyboard-layout-lessons.ts`, `hand-position-lessons.ts`), and `lesson-exercise.ts` holds only their names (`LESSON_SECTIONS`) and the loading: `loadLessons` fetches a lesson's section once, and `lessonExercise` and `lessonAbout` read from what is loaded. The outline keeps only each lesson's name and which exercise it plays. The store asks for the section when a lesson is set and puts it on the keys when it arrives; a unit's page starts loading its sections' lessons as it opens, unless the player saves data. A failed fetch reloads the page once (`lib/load-chunk.ts`), as panels do. Tests and other code that is not a page build any lesson at once with `buildLessonExercise` (`lesson-builders.ts`), which the app does not import.

**Consequences.** The signed-in app went from 306.7 KB to 301.8 KB with eight more lessons than it had, and its ceiling came down to 302 KB. A new lesson adds nothing to the first screen. The next step, if lessons are ever written or changed without a release, is to serve these modules' data from the API; the loading is already in place for it.
