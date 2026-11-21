"""Decide which scripts to turn into videos in this GitHub Actions run."""
import subprocess
import sys
from pathlib import Path

from .util import ROOT


def changed(before, sha):
    if not before or set(before) == {"0"}:
        return []
    r = subprocess.run(["git", "diff", "--name-only", "--diff-filter=AM", before, sha],
                       capture_output=True, text=True, cwd=ROOT)
    return [f for f in r.stdout.splitlines() if f.startswith("scripts/") and f.endswith(".txt")]


def newest():
    files = sorted((ROOT / "scripts").glob("*.txt"),
                   key=lambda p: subprocess.run(["git", "log", "-1", "--format=%ct", "--", str(p)],
                                                capture_output=True, text=True, cwd=ROOT).stdout.strip() or "0")
    return [str(files[-1].relative_to(ROOT))] if files else []


def main():
    event, before, sha, wanted = (sys.argv[1:] + ["", "", "", ""])[:4]
    if wanted.strip():
        w = wanted.strip()
        if not w.startswith("scripts/"):
            w = "scripts/" + w
        if not w.endswith(".txt"):
            w += ".txt"
        picked = [w]
    elif event == "push":
        picked = changed(before, sha) or newest()
    else:
        picked = newest()
    picked = [p for p in picked if (ROOT / p).exists()]
    Path(ROOT / ".picked.txt").write_text("\n".join(picked), encoding="utf-8")
    print("Scripts:", picked or "none")


if __name__ == "__main__":
    main()
