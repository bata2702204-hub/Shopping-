#!/usr/bin/env python3
"""Kept for convenience: same as `python scripts/update_local.py --chains carrefour` (extra args pass through)."""
import runpy
import sys
from pathlib import Path

sys.argv = [str(Path(__file__).with_name("update_local.py")), "--chains", "carrefour", *sys.argv[1:]]
runpy.run_path(sys.argv[0], run_name="__main__")
