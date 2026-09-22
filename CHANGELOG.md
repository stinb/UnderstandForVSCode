# Change Log

# [Unreleased]
- Change: the Checks view is gone; a violation's check opens as a card in the field editor window — from the Violations row's book button or menu, the lightbulb, or the check-id link in the Problems panel and hover — with its description and, per configuration, its severity and the options as set
- Change: the `understand.checksView.enabled` setting is removed with the view
- Add: `understand.annotations.gutterIcons` hides the gutter icons and scrollbar marks while keeping the annotations, their hover, the Annotate lens and the Browser; `understand.annotations.enabled` turns the whole annotation surface off, gutter icons included
- Add: a new annotation's form shows the Metadata its template will stamp, labelled "Metadata (updated and added on Create)" and expanded for the line it is anchored to
- Change: Create keeps the field editor open and moves it to the new annotation's card, the way Save does; a refused Create leaves the draft up with what was typed
- Change: Save in the field editor is offered only once a field or the note differs from what the annotation holds
- Add: the gutter icon of an annotation that still lacks a required field is red, like its Browser row and its scrollbar mark
- Add: the field editor says where the annotation sits, in an italic line under the template name — file, line and the entity or node — with the file name a link that shows the place
- Add: on a line with a violation the CodeLens offers "Ignore <check>" and "Ignore <check> Inline" per check, the same two ignores as the quick fixes
- Change: a new annotation's template is chosen on the form, in a Template droplist above the fields, instead of a picker; the draft starts on the project's default template (or the last one used, when the project says so) and switching keeps the values of fields both templates have and the note
- Fix: the Analyze commands save open editors first, and the inline ignore saves the file it comments, so an ignore just written is not analyzed away
- Fix: the extension activates once the window has started, not only when the search for a `.und` project finishes or an Understand view is shown; a development host opened on the Explorer never activated it
- Add: a Delete button (a boxed minus) in the Annotation Browser's title bar deletes the selected annotations after one question; it is enabled only while an annotation row is selected, and rows can be multi-selected; deleting the annotation the field editor is showing closes the window
- Change: a template's Metadata is read-only always: it is stamped at the head of every annotation created from VS Code, note or no note; the card and the form show it in a block of its own above the note, and Save sends the note alone, so an edit can never change or drop the stamp
- Add: an ignored violation's annotation reads yellow — its Browser row and icon, its gutter icon and its scrollbar mark (`understand.annotationRulerIgnore`); a missing required field still reads red
- Change: the quick fixes are named the same way: "Ignore <check>" stores an annotation with a template (formerly "Ignore <check> with Details..."), "Ignore <check> Inline" writes the UndCC_Line comment (formerly "Ignore <check>")

# [1.1.7] - 2026 Aug 26
- Add: license code setting for containers and other environments, with optional deregister on exit (#27)
- Add: file status on the status bar — in project, analyzed, or needs analysis (#6)
- Add: Checks view listing the configured CodeCheck configs and their checks; click a check for its detailed description (#39)
- Fix: AI Overview spacing, button tooltips, spinner stuck after a failed generation, and a misleading "manually disabled" error when the AI provider is unreachable

# [1.1.6] - 2026 Jun 5
- Add: Edit Understand AI Provider Settings panel (#692)
- Improve: AI provider settings with model fetch, persistence, and UX improvements
- Fix: build script for esbuild 0.25+ native binary on Node 24

# [1.1.5] - 2026 May 21
- Add: Explore Violations sidebar with sort by line, fast file-switch, analyze this file, and related locations (#34)
- Fix: build on Windows

# [1.1.4] - 2026 Apr 27
- Fix: AI chat no longer sends while IME is composing (#688)
- Fix: invoke esbuild via node_modules/.bin to support esbuild 0.25+
- Bump dependencies (brace-expansion, lodash, picomatch)

# [1.1.3] - 2025 Mar 24
- Add options to increase performance by disabling unused features

# [1.1.2] - 2025 Jan 27
- Graph: Add ability to click on graph nodes for entities and locations
- Graph: Improve colors to use theme text color

# [1.1.1] - 2025 Jan 14
- Add view: Metrics

# [1.1.0] - 2025 Oct 24
- Improve sync for the sidebar views
- AI Chat: Add regenerate button for last response
- AI Chat: add button to delete all messages

# [1.0.22] - 2025 Oct 09
- Add graph feature
- Add AI chat feature
- Add setting for file watcher to reduce CPU usage and prevent unintentional analyses

# [1.0.21] - 2025 Aug 15
- Fix issue with hidden settings on WSL

# [1.0.20] - 2025 Aug 12
- Add token-streaming to AI Overview

# [1.0.19] - 2025 Jun 6
- Add view: AI Overview
- Add view: Annotations
- Add view: References

# [1.0.18] - 2025 May 1
- Add command `understand.ai.generateAiOverview`
- Simplify setting: `understand.project.paths` to `understand.project.path`
- Improve actions and status in bottom-left status bar items

# [1.0.17] - 2025 Apr 17
- Fix problem with inter-process communication on Mac

# [1.0.16] - 2025 Apr 11
- Fix conflict between other extensions with code highlighting

# [1.0.15] - 2025 Apr 4
- Automatically find userver in normal installation location on Mac OS

# [1.0.14] - 2024 Dec 16
- Add missing messages for deleted or renamed folders

# [1.0.13] - 2024 Sep 13
- Update README.md

# [1.0.12] - 2024 Aug 13
- Update README.md

# [1.0.11] - 2024 Jul 25
- Update README.md

# [1.0.10] - 2024 Jul 1
- Add command to create a new project in Understand

# [1.0.9] - 2024 Jun 27
- Add support for PATH environment variable to find userver on non-Windows platforms

# [1.0.8] - 2024 Jun 11
- Update README.md

# [1.0.7] - 2024 Jun 5
- Improve accessibility of commands
- Make Analyzing icon different from Connecting icon

# [1.0.6] - 2024 May 29
- Update README.md

# [1.0.5] - 2024 May 23
- Add command to stop analyzing files
- Show current language for Ada, Assembly, Delphi, Fortran, JOVIAL, Pascal, and VHDL
- Update README.md

# [1.0.4] - 2024 May 2
- Update README.md

# [1.0.3] - 2024 Apr 2
- Fix graceful shutdown to release license

# [1.0.2] - 2024 Apr 1
- Prevent starting the extension without .und folder
- Update README.md

# [1.0.1] - 2024 Mar 13
- Update README.md

# [1.0.0] - 2024 Mar 13
- Initial release
