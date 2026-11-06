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

Then regenerate the English bundle list and reseed (next section). Strings that are
protocol values, such as graph names or provider ids, stay literal.

## Seeding from Understand's translations

Understand's own translations live in the `sti` repository as Qt files,
`conf/translations/understand_<lang>.ts` and `codecheck_<lang>.ts`. The script
below fills the extension's files with every string whose English they already
translate, exactly or with a loose match (case, a trailing colon or ellipsis,
Qt's `&` accelerators, `%1` placeholders against `{0}`):

```
python -I scripts/l10n/seed_from_qt.py . C:/sti
```

It rewrites `l10n/bundle.l10n.json` from the sources, writes
`package.nls.<lang>.json` and `l10n/bundle.l10n.<lang>.json` for each language
with matches, keeps anything a translator already put there, and lists what is
still untranslated in `l10n/untranslated.<lang>.txt`, one line per string:
where it is used, the key, the English. A language with nothing to seed gets no
files.

## Translating the rest

Fill in `package.nls.<lang>.json` and `l10n/bundle.l10n.<lang>.json` by hand, or
from `untranslated.<lang>.txt`. In the bundle the key is the English text and
`{0}`, `{1}` are placeholders that must stay in the translation. Run the seeding
script again afterwards: it keeps hand-written entries and refreshes the lists.

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
