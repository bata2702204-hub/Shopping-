#!/usr/bin/env python3
"""
Update Carrefour's REAL prices from a computer in Israel, then push to GitHub.

prices.carrefour.co.il refuses connections from outside Israel, so the cloud workflow can't reach it.
Run this from your own PC (Israeli IP), once a day or whenever you like:

    python scripts/update_carrefour_local.py            # fetch, update, commit, push
    python scripts/update_carrefour_local.py --no-push  # try it without pushing
    python scripts/update_carrefour_local.py --url https://...   # if Carrefour moves its files

What it does:
  1. git pull (so you build on the latest daily data from the cloud)
  2. downloads Carrefour's newest PriceFull file and replaces ONLY Carrefour's prices in
     public/real_prices.json — every other chain stays exactly as it was (--merge)
  3. if Node.js is installed: re-tags departments and rebuilds name-matched fresh groups
  4. copies the file to docs/ (what GitHub Pages serves) and commits + pushes

The daily cloud run keeps Carrefour's last local prices (status "local", dated), never drops them.
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
SITE = ROOT / "docs" / "real_prices.json"


def sh(*cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    print("$", " ".join(cmd))
    return subprocess.run(cmd, cwd=ROOT, check=check, text=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-push", action="store_true", help="update files locally only")
    ap.add_argument("--no-pull", action="store_true", help="skip git pull")
    ap.add_argument("--url", action="append", help="Carrefour price-files page (can repeat); overrides the default")
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
    if a.url:
        env["CARREFOUR_URLS"] = " ".join(a.url)
    print("\n— Fetching Carrefour (only Carrefour's column changes) —")
    # Work on a copy; the real file is replaced only if Carrefour was fetched successfully.
    tmp = Path(tempfile.mkdtemp()) / "real_prices.json"
    shutil.copyfile(DATA, tmp)
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_real_prices.py"),
                        "--only", "carrefour", "--merge", "--out", str(tmp)], cwd=ROOT, env=env, text=True)
    data = json.loads(tmp.read_text(encoding="utf-8")) if r.returncode == 0 else {}
    meta = next((c for c in data.get("chains", []) if c["id"] == "carrefour"), {})
    if meta.get("status") != "ok":
        print(f"\nCarrefour was not fetched: {meta.get('error') or 'see the output above'}\n"
              "Nothing was changed or pushed. Send the output above if it keeps failing.", file=sys.stderr)
        return 1
    shutil.copyfile(tmp, DATA)
    print(f"\nCarrefour: {meta.get('items')} items · store {meta.get('storeId')} {meta.get('storeName') or ''}"
          f" · ChainId in file: {meta.get('chainCode')} · file {meta.get('file')}")

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
    sh("git", "commit", "-m", f"Carrefour prices {stamp} (local run)")
    sh("git", "push")
    print("\nDone — GitHub Pages will show the new Carrefour prices in a minute or two.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
