# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Understand for VS Code is the VS Code extension for Understand. Commit
subjects without `internal:` become build notes that users read.

## Commit Messages

- **Subject only, most of the time.** One line, under ~72 chars, imperative
  mood. Prefix with the area when it helps: `Graph:`, `AI Chat:`,
  `Explore Violations:`.
- **Commit sparingly** — one commit per coherent change, not one per step.
  Show the proposed commit message and wait for approval before committing.
- **Reference issues with a trailing `#NNNN`**, e.g.
  `AI Chat: Stop sending a message while the IME is composing #688`.
  Never use closing keywords (`Fix #NNNN`, `Fixes`, `Closes`, `Resolves`) —
  they auto-close the issue, and issues stay open until testing is done.
- **`internal:` is the default**, and keeps the commit out of the build notes.
  Drop it only if you can name the thing the user sees — a view, panel,
  command, setting, button or message. No name, it stays internal.
  Lowercase, first word of the subject.
- **Build, dependency, release and docs changes are always `internal:`.**
  Makefile and npm script fixes, `npm audit` bumps, dev-only CVE fixes,
  version bumps and README edits change nothing a user sees. Don't use
  conventional prefixes like `fix:` or `chore:` either.
- **A user-facing subject is a build note — apply the reader test.** Write it
  for someone who uses the extension and has never seen the code. Name the
  thing they touch — the view, panel, command, setting or button — and say
  what is different for them now. "Improve sync" or "Fix graph bugs" fails:
  the reader can't tell what changed or whether it affects them. If you
  can't write a subject that passes, the commit is `internal:`.
- **Don't hide a feature behind `internal:`.** A new button, view, setting or
  export is user-facing even when it is one step of a larger feature. If a
  step isn't ready for users, say so in the subject of the commit that
  finishes it instead.
- **An `internal:` subject names what a developer recognises** — the npm
  script, Makefile target or source area — and what happened to it. Write for
  a reader who knows this repo but has never opened the code you changed.
- **In a body, `internal:` is a section marker** — everything after it is
  dropped. Issue refs go on the subject as `#NNNN`.
- **A user-facing commit keeps its internal detail behind the marker.**
  Write the user-facing subject, then `internal:` on its own line, then any
  root cause or constraint worth preserving.
- **Add a body only when the diff can't explain itself** — a subtle root
  cause, a constraint, a regression source. Write it as short prose
  explaining *why*, usually a sentence or two.
- **Never** use bullet-list bodies, `## Summary` / `## Test plan` sections,
  "This commit..." phrasing, restatements of the diff, or Co-Authored-By /
  Generated-with trailers.
- **Never add workflow tags** like `[autosync]` or `[!]` — scripts own those.

Good: `Graph: Save a graph as PNG or SVG`
Good: `Add settings to turn off views you don't use, to speed up large projects`
Good: `Keep sidebar views in step with the active editor #44`
Good: `internal: Fix npm run build on Windows`
Good: `internal: Release 1.1.4`
Bad:  `Improve sync #44`
      (sync of what? the user can't tell what changed)
Bad:  `Add options to increase performance by disabling unused features`
      (which options, and where does the user find them?)
Bad:  `internal: save graph as raster or svg`
      (a feature users would want to hear about, hidden from the build notes)
Bad:  `fix makefile`, `1.1.3`, `fix: bump lodash via npm audit fix`
      (build and release work shipped as build notes)
