# 0002 Feature folders, imports one way

Accepted, 2026-11-20.

**Context.** Features had begun importing each other (the keyboard and its hands imported one another), and the stores imported lesson data from a feature, so a change in one place reached unrelated ones.

**Decision.** The web app is `ui/`, `lib/`, `state/`, `audio/` and `midi/` (shared), `components/` (the app's frame) and `features/<name>/`. A feature imports shared code only, never another feature or the frame; shared code imports no feature and not the frame. What two need moves down: the lesson outline to `lib/outline/`, the keyboard's geometry to `lib/keyboard-layout.ts`, the run meter to `ui/`. ESLint enforces this (`eslint.config.js`), reading the feature list from the tree. A feature's styles live beside it and are imported, in cascade order, by `src/styles/motius.css`.

**Consequences.** A cross-feature need is a design question settled by moving code, not by an import.
