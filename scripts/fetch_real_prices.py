#!/usr/bin/env python3
"""
Fetch REAL supermarket prices from the Israeli Food Act price-transparency files
(חוק המזון – שקיפות מחירים) and write public/real_prices.json for the app.

For each chain it downloads the newest PriceFull file of one representative store,
parses the XML and keeps the real item name, barcode (ItemCode), manufacturer and
shelf price (ItemPrice, ₪). Products from all chains are merged by barcode, so a
comparison is always the same product. A chain whose file doesn't list a barcode gets
null for it — nothing is ever estimated or invented. A chain that can't be fetched is
recorded with status "error" and all its prices stay null.

Usage:
    python scripts/fetch_real_prices.py                 # all chains
    python scripts/fetch_real_prices.py --only shufersal
    python scripts/fetch_real_prices.py --out public/real_prices.json

Department/catalog tagging is done afterwards by scripts/enrich_prices.mjs, which reuses
the app's own categorizer (src/services/categorizer.js) so there is one source of truth.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import html
import io
import json
import os
import re
import sys
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin

import requests
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
# Rami Levy / Yochananof / Tiv Taam publish on url.publishedprices.co.il behind a login with each
# chain's public guest user. Off unless explicitly enabled (repo variable in the daily workflow).
PUBLISHEDPRICES_ENABLED = os.environ.get("PUBLISHEDPRICES_ENABLED", "").lower() in ("1", "true", "yes")
DEFAULT_OUT = ROOT / "public" / "real_prices.json"
TIMEOUT = 90
UA = "Mozilla/5.0 (compatible; smart-shopping-price-sync/1.0)"

# Order must match src/data/chains.js
CHAIN_ORDER = ["shufersal", "ramiLevy", "victory", "yochananof", "tivTaam", "carrefour"]


@dataclass
class ChainConfig:
    id: str
    name: str
    kind: str                       # "shufersal" | "cerberus" | "listing"
    store_id: str | None = None     # representative store; None → largest/newest file
    username: str | None = None     # cerberus (url.publishedprices.co.il) public user
    urls: list[str] = field(default_factory=list)   # listing pages, tried in order
    chain_code: str | None = None   # only used to filter multi-chain listings
    expected_code: str | None = None  # ChainId the file should carry (verified); mismatch → warning
    disabled: str | None = None     # reason the chain isn't fetched (no verified source yet)
    local_only: bool = False        # fetched from a PC in Israel (scripts/update_carrefour_local.py)


CHAINS: list[ChainConfig] = [
    # Verified: open portal, files on Azure blob storage. Store 123 = שופרסל דיל חולון-גולדה.
    ChainConfig("shufersal", "שופרסל", "shufersal", store_id="123"),
    # Cerberus portal (url.publishedprices.co.il), each chain's public guest user, empty password.
    # Usernames and ChainIds verified by logging in and reading the files (14.11.2026).
    ChainConfig("ramiLevy", "רמי לוי", "cerberus", username="RamiLevi", expected_code="7290058140886",
                store_id="055"),   # רמת החייל — pinned so day-to-day prices are from the same store
    ChainConfig("yochananof", "יוחננוף", "cerberus", username="yohananof", expected_code="7290803800003",
                store_id="017"),   # מודיעין ישפרו
    ChainConfig("tivTaam", "טיב טעם", "cerberus", username="TivTaam", expected_code="7290873255550",
                store_id="014"),   # ראשון מזרח
    # No verified source yet. Add the chain's published guest user here to enable it.
    # Victory publishes on laibcatalog.co.il (a listing shared by several chains), which blocks access
    # from outside Israel → fetched from a PC in Israel with scripts/update_local.py. chain_code selects
    # Victory's files on that shared listing; it's from memory, not yet verified — if no file matches,
    # the error lists the chain codes that ARE there.
    ChainConfig("victory", "ויקטורי", "listing", local_only=True, chain_code="7290696200003",
                urls=os.environ.get("VICTORY_URLS", "").split() or
                ["https://laibcatalog.co.il/", "http://laibcatalog.co.il/"],
                disabled="portal blocks connections from outside Israel — run scripts/update_local.py from Israel"),
    # prices.carrefour.co.il refuses connections from outside Israel (GitHub runners included), so
    # Carrefour is fetched from a PC in Israel: scripts/update_carrefour_local.py. Its ChainId is read
    # from its own file (7290058140886 is Rami Levy's code, verified from Rami Levy's files).
    ChainConfig("carrefour", "קרפור", "listing", local_only=True,
                urls=os.environ.get("CARREFOUR_URLS", "").split() or
                ["https://prices.carrefour.co.il/", "https://prices.ybitan.co.il/", "http://prices.ybitan.co.il/"],
                disabled="portal blocks connections from outside Israel — run scripts/update_carrefour_local.py from Israel"),
]


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = UA
    return s


def get(s: requests.Session, url: str, **kw) -> requests.Response:
    last = None
    for attempt in range(3):
        try:
            r = s.get(url, timeout=TIMEOUT, **kw)
            r.raise_for_status()
            return r
        except requests.RequestException as e:  # retry transient errors with backoff
            last = e
            time.sleep(2 ** attempt)
    raise last  # type: ignore[misc]


def decompress(data: bytes) -> bytes:
    if data[:2] == b"\x1f\x8b":
        return gzip.decompress(data)
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            return z.read(z.namelist()[0])
    return data


FILE_TS = re.compile(r"-(\d{8})(\d{4})?(?:\d{2})?[^\d]*$")


def file_time(name: str) -> str | None:
    """PriceFull7290027600007-002-123-20261114-030000.gz → 2026-11-14T03:00:00"""
    base = re.sub(r"(\.(gz|xml|zip))+$", "", name.split("?")[0].rsplit("/", 1)[-1], flags=re.I)  # .xml.gz too
    m = re.search(r"(\d{8})-?(\d{4,6})?$", base)
    if not m:
        return None
    d, t = m.group(1), (m.group(2) or "0000").ljust(6, "0")
    try:
        return dt.datetime.strptime(d + t, "%Y%m%d%H%M%S").isoformat()
    except ValueError:
        return None


# ── Fetchers: each returns (xml_bytes, meta) ───────────────────────────────────

def fetch_shufersal(cfg: ChainConfig) -> tuple[bytes, dict]:
    s = session()
    page = get(s, "https://prices.shufersal.co.il/FileObject/UpdateCategory",
               params={"catID": 2, "storeId": cfg.store_id or 0, "page": 1}).text
    links = [html.unescape(u) for u in re.findall(r'href="(https://[^"]+PriceFull[^"]+)"', page)]
    if not links:
        raise RuntimeError("no PriceFull link on Shufersal listing")
    links.sort(key=lambda u: file_time(u) or "", reverse=True)
    url = links[0]
    data = decompress(get(s, url).content)
    store_name = None
    m = re.search(r"<td>(\d+ - [^<]+)</td>", page)
    if m:
        store_name = html.unescape(m.group(1)).split(" - ", 1)[-1]
    name = url.split("?")[0].rsplit("/", 1)[-1]
    return data, {"file": name, "fileTime": file_time(name), "storeName": store_name}


def fetch_cerberus(cfg: ChainConfig) -> tuple[bytes, dict]:
    """url.publishedprices.co.il — login with the chain's public user (empty password)."""
    base = "https://url.publishedprices.co.il"
    s = session()
    token = re.search(r'name="csrftoken"\s+content="([^"]+)"', get(s, f"{base}/login").text)
    r = s.post(f"{base}/login/user", timeout=TIMEOUT, data={
        "r": "", "username": cfg.username, "password": "", "Submit": "Sign in",
        "csrftoken": token.group(1) if token else "",
    })
    r.raise_for_status()
    files_page = get(s, f"{base}/file")
    if "/login" in files_page.url:
        raise RuntimeError(f"guest login '{cfg.username}' was not accepted")
    token = re.search(r'name="csrftoken"\s+content="([^"]+)"', files_page.text)
    listing = s.post(f"{base}/file/json/dir", timeout=TIMEOUT, data={
        "sEcho": 1, "iColumns": 5, "iDisplayStart": 0, "iDisplayLength": 100000,
        "sSearch": "PriceFull", "cd": "/", "csrftoken": token.group(1) if token else "",
    })
    listing.raise_for_status()
    files = [f for f in listing.json().get("aaData", []) if "pricefull" in f.get("fname", "").lower()]
    pinned = [f for f in files if cfg.store_id and f"-{cfg.store_id.zfill(3)}-" in f["fname"]]
    if not files:
        raise RuntimeError("no PriceFull files listed")
    if pinned:
        # The pinned store's newest file (a store can publish several a day; the latest is most current).
        pick = max(pinned, key=lambda f: file_time(f["fname"]) or "")
    else:
        # Fallback: the biggest store among the newest day's files.
        newest = max(file_time(f["fname"]) or "" for f in files)
        candidates = [f for f in files if (file_time(f["fname"]) or "") >= newest[:10]]
        pick = max(candidates, key=lambda f: int(f.get("size") or 0))
        if cfg.store_id:
            print(f"[warn]  {cfg.id:10} store {cfg.store_id} not listed today — using {pick['fname']}", file=sys.stderr)
    data = decompress(get(s, f"{base}/file/d/{pick['fname']}").content)
    meta = {"file": pick["fname"], "fileTime": file_time(pick["fname"])}
    store = re.search(r"-(\d{3,})-\d{8}", pick["fname"])
    if store:
        meta["storeName"] = _cerberus_store_name(s, base, token.group(1) if token else "", store.group(1))
    return data, meta


def _cerberus_store_name(s: requests.Session, base: str, csrf: str, store_id: str) -> str | None:
    """Best effort: the chain's newest Stores file → name of the store. Never fails the fetch."""
    try:
        r = s.post(f"{base}/file/json/dir", timeout=TIMEOUT, data={
            "sEcho": 1, "iDisplayStart": 0, "iDisplayLength": 1000, "sSearch": "Stores", "cd": "/", "csrftoken": csrf})
        names = sorted(f["fname"] for f in r.json().get("aaData", []) if f.get("fname", "").lower().startswith("stores"))
        if not names:
            return None
        xml = decompress(get(s, f"{base}/file/d/{names[-1]}").content)
        want = int(store_id)
        for _, el in etree.iterparse(io.BytesIO(xml), events=("end",), recover=True):
            if isinstance(el.tag, str) and el.tag.lower() == "store":
                f = {c.tag.lower(): (c.text or "").strip() for c in el if isinstance(c.tag, str)}
                if f.get("storeid", "").isdigit() and int(f["storeid"]) == want:
                    return f.get("storename") or None
                el.clear()
    except Exception as e:  # store name is cosmetic
        print(f"[warn]  store name lookup failed: {e}", file=sys.stderr)
    return None


def fetch_listing(cfg: ChainConfig) -> tuple[bytes, dict]:
    errors = []
    for url in cfg.urls:
        try:
            s = session()
            page = get(s, url).text
            hrefs = [urljoin(url, html.unescape(h)) for h in re.findall(r'href="([^"]+)"', page, flags=re.I)]
            files = [h for h in hrefs if re.search(r"pricefull", h, re.I) and re.search(r"\.(gz|xml|zip)(\?|$)", h, re.I)]
            # Carrefour's portal renders its listing from JS: `const path = 'YYYYMMDD'; const files = [{name,...}]`
            # and links are origin/path/name — no <a href>s in the HTML.
            mp = re.search(r"const\s+path\s*=\s*'([^']*)'", page)
            mf = re.search(r"const\s+files\s*=\s*(\[.*?\]);", page, flags=re.S)
            if mf:
                base = urljoin(url, "/" + (mp.group(1) + "/" if mp and mp.group(1) else ""))
                for f in json.loads(mf.group(1)):
                    n = f.get("name", "")
                    if re.search(r"pricefull", n, re.I) and re.search(r"\.(gz|xml|zip)$", n, re.I):
                        files.append(base + n)
            if cfg.chain_code:
                # Shared listings (several chains): keep only this chain's files, never fall back to others.
                seen = sorted({m for h in files for m in re.findall(r"PriceFull(\d{13})", h, re.I)})
                files = [h for h in files if cfg.chain_code in h]
                if not files and seen:
                    raise RuntimeError(f"no PriceFull files for chain {cfg.chain_code}; chain codes on this page: "
                                       f"{', '.join(seen)} — set chain_code in scripts/fetch_real_prices.py")
            if cfg.store_id:
                files = [h for h in files if f"-{cfg.store_id.zfill(3)}-" in h] or files
            if not files:
                raise RuntimeError("no PriceFull links found")
            files.sort(key=lambda u: file_time(u) or "", reverse=True)
            data = decompress(get(s, files[0]).content)
            name = files[0].split("?")[0].rsplit("/", 1)[-1]
            return data, {"file": name, "fileTime": file_time(name), "source": url}
        except Exception as e:  # try the next URL
            errors.append(f"{url}: {e}")
    raise RuntimeError(" | ".join(errors))


FETCHERS = {"shufersal": fetch_shufersal, "cerberus": fetch_cerberus, "listing": fetch_listing}


# ── XML parsing ────────────────────────────────────────────────────────────────

def _num(v: str | None) -> float | None:
    try:
        n = float((v or "").strip())
        return n if n > 0 else None
    except ValueError:
        return None


def _qty(q: str | None, unit: str | None) -> str:
    n = _num(q)
    unit = (unit or "").strip()
    if not n or not unit or unit.startswith("לא"):
        return ""
    return f"{n:g} {unit}"


def parse_pricefull(xml: bytes) -> tuple[dict[str, dict], dict]:
    """Return ({barcode: item}, header). Tag names vary in case between chains."""
    items: dict[str, dict] = {}
    header: dict[str, str] = {}
    for _, el in etree.iterparse(io.BytesIO(xml), events=("end",), recover=True, huge_tree=True):
        tag = el.tag.lower() if isinstance(el.tag, str) else ""
        if tag in ("chainid", "storeid", "subchainid") and el.getparent() is not None \
                and el.getparent().tag.lower() not in ("item", "product"):
            header.setdefault(tag, (el.text or "").strip())
        if tag not in ("item", "product"):
            continue
        f = {c.tag.lower(): (c.text or "").strip() for c in el if isinstance(c.tag, str)}
        el.clear()
        code = f.get("itemcode", "").lstrip("0")
        price = _num(f.get("itemprice"))
        name = re.sub(r"\s+", " ", f.get("itemname", "")).strip()
        if not code or not price or not name:
            continue
        items[code] = {
            "name": name,
            "manufacturer": f.get("manufacturername", ""),
            "unit": _qty(f.get("quantity"), f.get("unitqty")),
            "weighted": f.get("bisweighted", "0") == "1",
            "price": round(price, 2),
        }
    return items, header


# ── Main ───────────────────────────────────────────────────────────────────────

def _load_previous(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


# Codes shorter than 8 digits, and 7290000000xxx, are store-internal (mostly produce & meat sold by
# weight). The same internal code can mean different things in different chains, so those are never
# merged across chains — they're kept per chain under "chainId:code".
INTERNAL_CODE = re.compile(r"^(\d{1,7}|7290000000\d{3})$")


def product_key(chain_id: str, code: str) -> str:
    return f"{chain_id}:{code}" if INTERNAL_CODE.match(code) else code


def _carry(previous: dict, cid: str) -> dict:
    """Last real prices of one chain from the previous output (key → item)."""
    order = previous.get("chainOrder", CHAIN_ORDER)
    if cid not in order:
        return {}
    idx = order.index(cid)
    carried = {}
    for row in previous.get("products", []):
        price = row[5][idx] if len(row) > 5 and idx < len(row[5]) else None
        if price is not None:
            carried[row[0]] = {"name": row[1], "manufacturer": row[2], "unit": row[3],
                               "weighted": bool(row[4]), "price": price, "_key": row[0]}
    return carried


def run(only: list[str] | None, out: Path, merge: bool = False) -> int:
    previous = _load_previous(out) or {}
    prev_meta = {m["id"]: m for m in previous.get("chains", [])}
    results: dict[str, dict] = {}
    chain_meta: list[dict] = []
    fetched_now: list[str] = []

    for cfg in CHAINS:
        requested = bool(only) and cfg.id in only
        if only and not requested:
            # --merge keeps the other chains exactly as they were; otherwise they are just skipped.
            pm = prev_meta.get(cfg.id)
            if merge and pm:
                carried = _carry(previous, cfg.id)
                if carried:
                    results[cfg.id] = carried
                chain_meta.append(pm)
            else:
                chain_meta.append({"id": cfg.id, "name": cfg.name, "status": "skipped"})
            continue
        if cfg.disabled and not requested:
            reason = "local" if cfg.local_only else "disabled"
            chain_meta.append({"id": cfg.id, "name": cfg.name, "status": "disabled", "reason": reason, "error": cfg.disabled})
            print(f"[off]   {cfg.id:10} {cfg.disabled}")
            continue
        if cfg.kind == "cerberus" and not PUBLISHEDPRICES_ENABLED and not requested:
            chain_meta.append({"id": cfg.id, "name": cfg.name, "status": "disabled", "reason": "needs-variable",
                               "error": "publishedprices login is off (set PUBLISHEDPRICES_ENABLED=true)"})
            print(f"[off]   {cfg.id:10} publishedprices login disabled (PUBLISHEDPRICES_ENABLED)")
            continue
        t0 = time.time()
        try:
            xml, meta = FETCHERS[cfg.kind](cfg)
            items, header = parse_pricefull(xml)
            if not items:
                raise RuntimeError("file parsed but contained no priced items")
            code = (header.get("chainid") or "").strip()
            if cfg.expected_code and code and code != cfg.expected_code:
                print(f"[warn]  {cfg.id:10} ChainId in file is {code}, expected {cfg.expected_code}", file=sys.stderr)
            results[cfg.id] = items
            fetched_now.append(cfg.id)
            chain_meta.append({
                "id": cfg.id, "name": cfg.name, "status": "ok",
                **({"reason": "local"} if cfg.local_only else {}),
                "chainCode": header.get("chainid"), "storeId": header.get("storeid"),
                "items": len(items), **meta,
            })
            print(f"[ok]    {cfg.id:10} {len(items):6} items  {meta.get('file')}  ChainId={code}  ({time.time() - t0:.1f}s)")
        except Exception as e:
            reason = "local" if cfg.local_only else "failed"
            chain_meta.append({"id": cfg.id, "name": cfg.name, "status": "error", "reason": reason, "error": str(e)[:300]})
            print(f"[error] {cfg.id:10} {e}", file=sys.stderr)

    # A chain not fetched this time keeps its last REAL prices, clearly dated (never estimated):
    #   local-only chain (Carrefour) → status "local"; publishedprices waiting for the variable →
    #   "stale"/needs-variable; a failed fetch → "stale"/failed.
    for i, meta in enumerate(chain_meta):
        cid = meta["id"]
        pm = prev_meta.get(cid)
        if meta["status"] in ("ok", "skipped") or cid in results or not pm \
                or pm.get("status") not in ("ok", "stale", "local"):
            continue
        carried = _carry(previous, cid)
        if not carried:
            continue
        results[cid] = carried
        status = "local" if meta.get("reason") == "local" else "stale"
        chain_meta[i] = {**pm, "status": status, "reason": meta.get("reason") or "failed",
                         "error": meta.get("error"), "items": len(carried)}
        print(f"[{status}] {cid:10} kept {len(carried)} real prices from {pm.get('fileTime')}")

    if not results:
        print("No chain could be fetched — keeping the previous file untouched.", file=sys.stderr)
        return 1

    # Merge by barcode (internal codes stay per chain). Display name: first chain in CHAIN_ORDER.
    merged: dict[str, dict] = {}
    for cid in CHAIN_ORDER:
        for code, it in results.get(cid, {}).items():
            key = it.get("_key") or product_key(cid, code)
            p = merged.setdefault(key, {**{k: it[k] for k in ("name", "manufacturer", "unit", "weighted")},
                                        "prices": {c: None for c in CHAIN_ORDER}})
            p["prices"][cid] = it["price"]

    # Keep existing department tags so a run without Node (home PC) doesn't lose them;
    # scripts/enrich_prices.mjs recomputes them whenever it runs.
    pf = previous.get("fields", [])
    ic, idd = (pf.index("category") if "category" in pf else None), (pf.index("dictId") if "dictId" in pf else None)
    tags = {row[0]: (row[ic] if ic is not None else None, row[idd] if idd is not None else None)
            for row in previous.get("products", [])}

    products = [
        [key, p["name"], p["manufacturer"], p["unit"], 1 if p["weighted"] else 0,
         [p["prices"][c] for c in CHAIN_ORDER], *tags.get(key, (None, None))]
        for key, p in sorted(merged.items(), key=lambda kv: kv[1]["name"])
    ]
    file_times = [m["fileTime"] for m in chain_meta if m.get("status") in ("ok", "stale", "local") and m.get("fileTime")]
    payload = {
        "version": 2,
        "source": "Israeli Food Act price-transparency files (PriceFull)",
        "lastUpdated": max(file_times) if file_times else None,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "chainOrder": CHAIN_ORDER,
        "chains": chain_meta,
        "fields": ["barcode", "name", "manufacturer", "unit", "weighted", "prices", "category", "dictId"],
        "products": products,
        # Name-matched fresh groups are rebuilt by scripts/enrich_prices.mjs; kept meanwhile.
        "freshGroups": previous.get("freshGroups", []),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} — {len(products)} products, fetched now: {', '.join(fetched_now) or 'none'}")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", help="chain ids to fetch (default: all)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--merge", action="store_true",
                    help="with --only: keep every other chain's data and status from the existing file")
    a = ap.parse_args()
    sys.exit(run(a.only, a.out, merge=a.merge))
