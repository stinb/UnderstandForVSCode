# Translations

The extension shows its text in the language VS Code runs in, through VS Code's
own localization: the Marketplace language pack sets the language, and the
extension's files below supply the words. A string without a translation is
shown in English.

## Where the strings live

| What | English | Translations |
|---|---|---|
| package.json: command titles, view names, settings, welcome texts | `package.nls.json` (referenced as `%key%`) | `package.nls.<lang>.json` |
| TypeScript: messages, pickers, tooltips, status bar | the English text itself, in `vscode.l10n.t('...')` calls; listed in `l10n/bundle.l10n.json` | `l10n/bundle.l10n.<lang>.json` |
| Webview scripts (AI cards, chat, graphs, treemap) | the English text itself, in `t('...')` calls; listed in `l10n/bundle.l10n.json` | the same bundle, handed to each page as `<body data-l10n>` |

`<lang>` is VS Code's language id in lower case: `ja`, `zh-cn`, `zh-tw`, ...

## Adding a string

- TypeScript: `vscode.l10n.t('Analyze this file')`, or `vscode.l10n.t('Copied {0}', name)`
  for a placeholder. Files that import named symbols from `vscode` use `l10n.t()`.
- A webview script: `t('Hide Legend')`, or `t('Go to {0}', name)`. The helper at the top
  of each script reads VS Code's bundle from the page's `<body data-l10n>`, which
  `l10nAttribute()` in `src/other/webviewL10n.ts` writes.
- package.json: give the field a `%key%` and add the key with its English text to
  `package.nls.json`. Keys follow the pattern already there, for example
  `command.understand.analysis.analyzeAllFiles.title`.

Push it: the sync below sends the new English to the translators. Strings that are
protocol values, such as graph names or provider ids, stay literal.

## Where translators work

The translations are made in the `vscode/` folder of
[stinb/sti-translations](https://github.com/stinb/sti-translations), next to
Understand's own Qt files, on its `master` branch for this repository's `main` and
its `japanese` branch for `japanese`. Translations go both ways, as Understand's
do between sti and the translations repo: a translation fixed here reaches
`vscode/`, and one made there comes back here. If both sides change the same
string before a sync, the last push wins.

Two GitHub workflows keep them in step:

- `l10n-out.yml` runs on a push that changes strings or translations. It applies
  the translations the push changed to `vscode/`, entry by entry so it keeps
  whatever translators pushed there since the last sync, then runs the seeding
  script against the translations repo and pushes `vscode/`: the English
  (`package.nls.json`, `bundle.l10n.json`), the translations with any new strings
  Understand's Qt files already translate, and `untranslated.<lang>.txt`, one line
  per string still missing: where it is used, the key, the English.
- `l10n-in.yml` runs when `vscode/` changes (the translations repo's
  `notify-vscode.yml` asks for it) and copies `package.nls.<lang>.json` and
  `bundle.l10n*.json` here.

`l10n-in.yml` commits with `[autosync]`, and `l10n-out.yml` skips those commits,
so a sync never starts another. sti's own translation sync leaves `vscode/` alone. Both
workflows, and the translations repo's `notify-vscode.yml`, use the
`SYNC_PAT` secret, the token sti's translation sync already uses, which needs
Contents read and write on this repository and the translations repo.

## Seeding from Understand's translations

The seeding script fills every string whose English Understand's Qt files
(`understand_<lang>.ts`, `codecheck_<lang>.ts`) already translate, exactly or with
a loose match (case, a trailing colon or ellipsis, Qt's `&` accelerators, `%1`
placeholders against `{0}`). It keeps every translation already in `vscode/` and
only fills gaps. `l10n-out.yml` runs it; to run it by hand against a checkout of
the translations repo:

```
python -I scripts/l10n/seed_from_qt.py . <sti-translations>
```

It also rewrites this repository's `l10n/bundle.l10n.json`. A language with
nothing translated gets no files.

## Translating the rest

Fill in `vscode/package.nls.<lang>.json` and `vscode/bundle.l10n.<lang>.json` in the
translations repo, working from `vscode/untranslated.<lang>.txt`. In the bundle the
key is the English text and `{0}`, `{1}` are placeholders that must stay in the
translation. Pushing it brings the translations here; the list is refreshed the
next time the extension's strings change. A translation can also be fixed in this
repository's copies, and the sync carries it to `vscode/`.

## Adding a language

VS Code finds the files by its language id, so a language needs nothing but
its two files. For Korean:

1. Create `vscode/package.nls.ko.json` and `vscode/bundle.l10n.ko.json` in the
   translations repo. Each is a JSON object: the key is the `package.nls.json` key
   or the English text, the value is the translation. Keys you leave out fall back
   to English.
2. If Understand has that language, add it to `LANGS` in
   `scripts/l10n/seed_from_qt.py`:

   ```python
   "ko": ["understand_ko.ts", "codecheck_ko.ts"],
   ```

   The next sync seeds it and writes its `untranslated.ko.txt`. A language with
   nothing translated gets no files from the script; to get the list anyway,
   create the bundle file with one entry.
3. To run the language test for it, add the Marketplace language pack to
   `PACKS` in `test/l10n/run.js`, for example
   `ko: 'MS-CEINTL.vscode-language-pack-ko'`.

userver needs no change: once the bundle exists the extension starts it with
`--locale=ko`, and it loads `understand_ko.qm` if `conf/translations` has it.

## The language userver uses

The extension starts userver with `--locale=<lang>` when it has a bundle for
VS Code's language, so the text the server sends (AI overviews, card sections,
errors) matches the extension's. English, and languages without a bundle,
leave the server on the system locale as before.

## Testing

```
node test/l10n/run.js . <workspace> ja
UNDERSTAND_L10N_VISUAL=1 node test/l10n/run.js . <workspace> ja
```

The runner downloads a VS Code, installs the Marketplace language pack into its
own folders, and runs the extension in that language, checking the bundles, the
manifest and userver's switch. The visual run also opens the sidebar, a graph,
the treemap and the provider settings and screenshots them into `test/l10n/shots/`.
Language packs are built per VS Code version, so the runner pins one that has
them (the fourth argument). The workspace needs a `.vscode/settings.json` naming
the userver and the project, like the smoke test's.
