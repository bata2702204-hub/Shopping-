#!/usr/bin/env python3
"""
Update the chains that block access from outside Israel — Carrefour and Victory — from a computer
in Israel, then push to GitHub. (The cloud workflow can't reach their portals.)

    python scripts/update_local.py                       # Carrefour + Victory: fetch, update, commit, push
    python scripts/update_local.py --chains victory      # only Victory
    python scripts/update_local.py --no-push             # try it without pushing
    python scripts/update_local.py --url victory=https://...   # if a chain moves its files

What it does:
  1. git pull (so you build on the latest daily data from the cloud)
  2. downloads each chain's newest PriceFull file and replaces ONLY those chains' prices in
     public/real_prices.json — every other chain stays exactly as it was (--merge)
  3. if Node.js is installed: re-tags departments and rebuilds name-matched fresh groups
  4. copies the file to docs/ (what GitHub Pages serves) and commits + pushes

Works on a temporary copy: the real file changes only if at least one chain was fetched. A chain that
fails keeps its previous real prices. The daily cloud run keeps these chains' last local prices
(status "local", dated) and never drops them.
Requirements: Python 3.9+, `pip install requests lxml`, git with push access to the repo.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "real_prices.json"
# Chains whose portals block non-Israeli access → fetched here. Value: env var with URL overrides.
LOCAL_CHAINS = {"carrefour": "CARREFOUR_URLS", "victory": "VICTORY_URLS"}
SITE = ROOT / "docs" / "real_prices.json"


def sh(*cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    print("$", " ".join(cmd))
    return subprocess.run(cmd, cwd=ROOT, check=check, text=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-push", action="store_true", help="update files locally only")
    ap.add_argument("--no-pull", action="store_true", help="skip git pull")
    ap.add_argument("--chains", nargs="+", default=list(LOCAL_CHAINS), choices=list(LOCAL_CHAINS),
                    help="which chains to update (default: all local-only chains)")
    ap.add_argument("--url", action="append", default=[], metavar="CHAIN=URL",
                    help="override a chain's price-files page, e.g. victory=https://... (can repeat)")
    a = ap.parse_args()

    try:
        import lxml  # noqa: F401
        import requests  # noqa: F401
    except ImportError:
        print("Missing packages. Run:  pip install requests lxml", file=sys.stderr)
        return 2

    if not a.no_pull:
        sh("git", "pull", "--rebase", "--autostash")

    env = dict(os.environ)
    for item in a.url:
        chain, _, url = item.partition("=")
        if chain not in LOCAL_CHAINS or not url:
            print(f"--url expects CHAIN=URL with CHAIN in {', '.join(LOCAL_CHAINS)}", file=sys.stderr)
            return 2
        env[LOCAL_CHAINS[chain]] = (env.get(LOCAL_CHAINS[chain], "") + " " + url).strip()
    names = ", ".join(a.chains)
    print(f"\n— Fetching {names} (only these chains' prices change) —")
    # Work on a copy; the real file is replaced only if Carrefour was fetched successfully.
    tmp = Path(tempfile.mkdtemp()) / "real_prices.json"
    shutil.copyfile(DATA, tmp)
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_real_prices.py"),
                        "--only", *a.chains, "--merge", "--out", str(tmp)], cwd=ROOT, env=env, text=True)
    data = json.loads(tmp.read_text(encoding="utf-8")) if r.returncode == 0 else {}
    metas = {c["id"]: c for c in data.get("chains", [])}
    fetched = [c for c in a.chains if metas.get(c, {}).get("status") == "ok"]

    print("\n— Summary —")
    for c in a.chains:
        m = metas.get(c, {})
        if m.get("status") == "ok":
            print(f"  ✅ {c}: {m.get('items')} items · store {m.get('storeId')} {m.get('storeName') or ''}"
                  f" · ChainId in file: {m.get('chainCode')} · {m.get('file')}")
        else:
            kept = f" (kept previous prices from {m.get('fileTime')})" if m.get("status") == "local" else ""
            print(f"  ❌ {c}: {m.get('error') or 'see the output above'}{kept}")
            if "page saved to" in (m.get("error") or ""):
                print("     → please send that file (it shows how the portal lists its files):\n"
                      "       git add -f debug && git commit -m \"Debug: portal page\" && git push")
    if not fetched:
        print("\nNothing was fetched — nothing was changed or pushed. Send the output above if it keeps failing.",
              file=sys.stderr)
        return 1
    shutil.copyfile(tmp, DATA)
    if shutil.which("node"):
        sh("node", "scripts/enrich_prices.mjs")
    else:
        print("Node.js not found — departments for new Carrefour items will be tagged by the next cloud run.")

    SITE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(DATA, SITE)

    if a.no_push:
        print("\nUpdated public/real_prices.json and docs/real_prices.json (not pushed).")
        return 0
    sh("git", "add", str(DATA.relative_to(ROOT)), str(SITE.relative_to(ROOT)))
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        print("No price changes.")
        return 0
    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    sh("git", "commit", "-m", f"{', '.join(c.capitalize() for c in fetched)} prices {stamp} (local run)")
    sh("git", "push")
    print(f"\nDone — GitHub Pages will show the new {names} prices in a minute or two.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
