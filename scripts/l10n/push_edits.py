"""Carry translations edited in this repository to the translations repo.

  python -I push_edits.py <ext root> <commit before the push> <sti-translations checkout>

Compares each package.nls.<lang>.json and l10n/bundle.l10n.<lang>.json with
the commit before the push and applies only the entries that changed to the
same file in the checkout's vscode/ folder. Copying whole files would undo
whatever translators pushed there since this repository last synced."""
import json
import os
import re
import subprocess
import sys

EXT, BEFORE, QT = sys.argv[1], sys.argv[2], sys.argv[3]
OUT = os.path.join(QT, "vscode")


def old_version(path):
    shown = subprocess.run(["git", "-C", EXT, "show", "%s:%s" % (BEFORE, path)],
                           capture_output=True, text=True, encoding="utf-8")
    return json.loads(shown.stdout) if shown.returncode == 0 else {}


paths = [f for f in os.listdir(EXT) if re.fullmatch(r"package\.nls\.[\w-]+\.json", f)]
paths += ["l10n/" + f for f in os.listdir(os.path.join(EXT, "l10n"))
          if re.fullmatch(r"bundle\.l10n\.[\w-]+\.json", f)]
for path in sorted(paths):
    new = json.load(open(os.path.join(EXT, path), encoding="utf-8"))
    old = old_version(path)
    changed = [k for k in new.keys() | old.keys() if new.get(k) != old.get(k)]
    if not changed:
        continue
    target = os.path.join(OUT, os.path.basename(path))
    out = json.load(open(target, encoding="utf-8")) if os.path.exists(target) else {}
    for k in changed:
        if k in new:
            out[k] = new[k]
        else:
            out.pop(k, None)
    os.makedirs(OUT, exist_ok=True)
    with open(target, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent="\t")
        f.write("\n")
    print("%s: %d entries" % (path, len(changed)))
