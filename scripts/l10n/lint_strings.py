"""Find user-facing text written without a translation call.

  python -I scripts/l10n/lint_strings.py <ext root>

A string reaches the translators only through l10n.t() in TypeScript or t()
in a webview script (seed_from_qt.py lists those), so a literal handed
straight to something a person reads is text nobody can translate. This
scans the sinks where such text lands: labels, titles, descriptions,
tooltips, prompts, placeholders, status and message calls, tree items and
element text, and reports every quoted or template string there that looks
like words rather than an identifier, an icon, a %key% or a path. Exits 1
when it finds any."""
import os
import re
import sys

EXT = sys.argv[1]
TS_SINKS = r"(?:show(?:Information|Warning|Error)Message|setStatusBarMessage|new TreeItem|new SectionItem|super)\("
PROPS = r"(?:label|title|description|tooltip|detail|prompt|placeHolder|placeholder|text|textContent|innerText|innerHTML|message)"
LITERAL = r"""(['"`])((?:(?!\1)[^\\]|\\.)*)\1"""
TRANSLATED = re.compile(r"^\s*(?:vscode\.)?(?:l10n\.)?t\(")
SINK = re.compile(r"(?:%s\s*|\b%s\s*[:=]\s*)(.*)$" % (TS_SINKS, PROPS))
SKIP_FILES = {"markdown-it.min.js", "graph.js", "templateRules.js", "treemap.js.map"}
WORDS = re.compile(r"[A-Za-z]{2,}")


def looks_like_text(s):
    """Words a person reads, not an id, icon, key, path or format."""
    body = re.sub(r"\$\([\w-]+\)|\$\{[^}]*\}|%[\w.]+%|\{\d+\}", " ", s).strip()
    if len(WORDS.findall(body)) == 0:
        return False
    if re.fullmatch(r"[\w.:/\\-]+", body):          # identifier, key, path
        return False
    if re.fullmatch(r"[A-Z]{4}-[A-Z]{2}-[A-Z]{2}", body):  # date format
        return False
    if re.search(r"</?\w+[^>]*>", body) and not re.search(r">\s*[A-Za-z]{2,}", body):
        return False                                  # markup without words
    body = re.sub(r"\s+", " ", body)
    return bool(re.search(r"[A-Za-z]{2,}\s+[A-Za-z]{2,}|^[A-Z][a-z]+(?:\s|…|\.\.\.|:|$)", body))


found = []
for folder, ext in (("src", ".ts"), ("src/graphView", ".js"), ("res/views", ".js")):
    for dirpath, _dirs, files in os.walk(os.path.join(EXT, folder)):
        if "test" in dirpath.replace("\\", "/").split("/"):
            continue
        for name in sorted(files):
            if not name.endswith(ext) or name in SKIP_FILES:
                continue
            path = os.path.join(dirpath, name)
            for number, line in enumerate(open(path, encoding="utf-8"), 1):
                stripped = line.split("//")[0] if "//" in line and not re.search(r"['\"`][^'\"`]*//", line) else line
                for m in SINK.finditer(stripped):
                    rest = m.group(1)
                    if TRANSLATED.match(rest):
                        continue
                    lit = re.match(r"\s*" + LITERAL, rest)
                    if not lit:
                        continue
                    text = lit.group(2)
                    if looks_like_text(text):
                        rel = os.path.relpath(path, EXT).replace("\\", "/")
                        found.append("%s:%d: %s" % (rel, number, text[:80]))
for f in found:
    print(f)
print("%d untranslated string(s)" % len(found))
sys.exit(1 if found else 0)
