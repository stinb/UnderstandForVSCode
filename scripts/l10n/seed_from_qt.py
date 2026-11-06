"""Seed the extension's translation files from Understand's Qt translations.

  python -I seed_from_qt.py <ext root> <sti root>

Reads package.nls.json and every l10n.t('...') key in src (TypeScript and the
webview string table), then for each language looks the English up in
conf/translations/understand_<lang>.ts and codecheck_<lang>.ts: exact match
first, then a loose one (case, a trailing colon or ellipsis, '&' accelerators,
Qt's %1 placeholders against {0}). Writes package.nls.<lang>.json and
l10n/bundle.l10n.<lang>.json with the matches, keeping every entry a
translator already put there (VS Code falls back to English for a missing
key), l10n/bundle.l10n.json with every English key, and
l10n/untranslated.<lang>.txt listing what still needs a translator."""
import html
import json
import os
import re
import sys

EXT, STI = sys.argv[1], sys.argv[2]
LANGS = {"ja": ["understand_ja.ts", "codecheck_ja.ts"],
         "zh-cn": ["understand_zh_CN.ts", "codecheck_zh_CN.ts"],
         "zh-tw": ["understand_zh_TW.ts", "codecheck_zh_TW.ts"]}
PH = re.compile(r"%(\d)")


def norm(s):
    s = s.replace("&", "") if "&" in s and "&&" not in s else s
    s = re.sub(r"(…|\.\.\.|:)\s*$", "", s.strip())
    s = PH.sub(lambda m: "{%d}" % (int(m.group(1)) - 1), s)
    return re.sub(r"\s+", " ", s).lower()


def load_qt(paths):
    exact, loose = {}, {}
    for p in paths:
        full = os.path.join(STI, "conf", "translations", p)
        if not os.path.exists(full):
            continue
        t = open(full, encoding="utf-8").read()
        for src, tr in re.findall(r"<source>(.*?)</source>\s*(?:<comment>.*?</comment>\s*)?<translation(?: type=\"(?:unfinished)\")?>(.*?)</translation>", t, re.S):
            src, tr = html.unescape(src), html.unescape(tr)
            if not tr.strip() or tr == src:
                continue
            tr = PH.sub(lambda m: "{%d}" % (int(m.group(1)) - 1), tr)
            # Qt menu accelerators have no place in VS Code: "AI 概要 (&O)", "&File"
            tr = re.sub(r"\s*\(&[A-Za-z]\)", "", tr)
            tr = re.sub(r"&(?=[A-Za-z])", "", tr) if "&&" not in tr else tr
            exact.setdefault(src, tr)
            loose.setdefault(norm(src), (src, tr))
    return exact, loose


def keys_from_src():
    """The l10n.t() keys of the TypeScript and the t() keys of the webview
    scripts (which read VS Code's bundle through <body data-l10n>)."""
    keys = set()
    ts = re.compile(r"""\bl10n\.t\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1""")
    js = re.compile(r"""(?<![\w.])t\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1""")
    for folder, pattern, ext in (("src", ts, ".ts"), ("src/graphView", js, ".js"), ("res/views", js, ".js")):
        for dirpath, _, files in os.walk(os.path.join(EXT, folder)):
            for f in files:
                if f.endswith(ext) and f not in ("markdown-it.min.js", "graph.js", "templateRules.js"):
                    for m in pattern.finditer(open(os.path.join(dirpath, f), encoding="utf-8").read()):
                        keys.add(m.group(2).replace("\\'", "'").replace('\\"', '"'))
    return sorted(keys)


def translate(english, exact, loose):
    if english in exact:
        return exact[english], "exact"
    n = norm(english)
    if n in loose:
        src, tr = loose[n]
        # keep the English's own tail (colon, ellipsis) on the translation
        tail = re.search(r"(…|\.\.\.|:)\s*$", english)
        tail_src = re.search(r"(…|\.\.\.|:)\s*$", src)
        if tail and not tail_src:
            tr = tr + tail.group(1)
        elif tail_src and not tail:
            tr = re.sub(r"(…|\.\.\.|:|：)\s*$", "", tr)
        return tr, "loose"
    return None, None


nls = json.load(open(os.path.join(EXT, "package.nls.json"), encoding="utf-8"))
keys = keys_from_src()
os.makedirs(os.path.join(EXT, "l10n"), exist_ok=True)
with open(os.path.join(EXT, "l10n", "bundle.l10n.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump({k: k for k in keys}, f, ensure_ascii=False, indent="\t")
    f.write("\n")

report = {}
for lang, files in LANGS.items():
    exact, loose = load_qt(files)
    nls_path = os.path.join(EXT, "package.nls.%s.json" % lang)
    bundle_path = os.path.join(EXT, "l10n", "bundle.l10n.%s.json" % lang)
    # A translator's own entries stay; the Qt files only fill the gaps
    out_nls = json.load(open(nls_path, encoding="utf-8")) if os.path.exists(nls_path) else {}
    out_bundle = json.load(open(bundle_path, encoding="utf-8")) if os.path.exists(bundle_path) else {}
    out_nls = {k: v for k, v in out_nls.items() if k in nls}
    out_bundle = {k: v for k, v in out_bundle.items() if k in keys}
    missing = []
    stats = {"exact": 0, "loose": 0, "kept": len(out_nls) + len(out_bundle)}
    for key, english in nls.items():
        if key in out_nls:
            continue
        tr, how = translate(english, exact, loose)
        if tr:
            out_nls[key] = tr
            stats[how] += 1
        else:
            missing.append(("package.nls", key, english))
    for english in keys:
        if english in out_bundle:
            continue
        tr, how = translate(english, exact, loose)
        if tr:
            out_bundle[english] = tr
            stats[how] += 1
        else:
            missing.append(("bundle", english, english))
    total = len(nls) + len(keys)
    report[lang] = {"strings": total, "kept": stats["kept"], "exact": stats["exact"], "loose": stats["loose"], "missing": len(missing)}
    untranslated = os.path.join(EXT, "l10n", "untranslated.%s.txt" % lang)
    if not out_nls and not out_bundle:
        # nothing for this language: no empty files
        report[lang]["files"] = "none (nothing translated)"
        if os.path.exists(untranslated):
            os.remove(untranslated)
        continue
    with open(nls_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out_nls, f, ensure_ascii=False, indent="\t")
        f.write("\n")
    with open(bundle_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out_bundle, f, ensure_ascii=False, indent="\t")
        f.write("\n")
    with open(untranslated, "w", encoding="utf-8", newline="\n") as f:
        for where, key, english in missing:
            f.write("%s\t%s\t%s\n" % (where, key, english))
print(json.dumps(report, indent=1))
