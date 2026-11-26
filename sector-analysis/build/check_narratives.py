"""Consistency checks on narrative text before the HTML is built.

Usage: python check_narratives.py <root_dir>

1. Every reference chip (company fact "TTTT-PERIOD-METRIC" or policy item id)
   in company narratives, sector narratives, policy impacts and the budget
   assessment must resolve to a value in dataset.json, a row in facts.csv or a
   policy item. Unresolved references fail the build (exit code 1).
2. Ratio levels quoted in company narratives ("EBITDA margin ... 54.5%",
   "cost-to-income 29.0%", "ROE 15.1%", "net margin ...") must match the
   company's calculated ratio for some period within 0.15 pp (cost of risk:
   "N bp" within rounding; a cost-of-risk quote in % is checked to 0.006 pp). Mismatches are
   listed as warnings so the text can be corrected or the basis stated.
"""
from __future__ import annotations

import csv
import glob
import json
import os
import re
import sys

import yaml

REF_RE = re.compile(r"^(\d{4})-(FY20\d\d|9M20\d\d)-([A-Z0-9_]+)$")
# phrase -> ratio keys it may refer to
RATIO_WORDS = [
    (re.compile(r"EBITDA margin[^.;%]{0,90}?(-?\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (-?\d{1,3}\.\d)%)?", re.I), ["EBITDA_M", "EBITDA_M_U"]),
    (re.compile(r"net margin[^.;%]{0,60}?(-?\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (-?\d{1,3}\.\d)%)?", re.I), ["NET_M"]),
    (re.compile(r"operating margin[^.;%]{0,60}?(-?\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (-?\d{1,3}\.\d)%)?", re.I), ["OP_M"]),
    (re.compile(r"cost-to-income[^.;%]{0,60}?(\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (\d{1,3}\.\d)%)?", re.I), ["CI"]),
    (re.compile(r"\bROE\b[^.;%]{0,40}?(-?\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (-?\d{1,3}\.\d)%)?"), ["ROE"]),
    # cost of risk is quoted in basis points; a percentage quote is flagged too
    (re.compile(r"cost of risk(?:(?!bp)[^.;%]){0,40}?(\d\.\d\d?)%(?:(?:(?!bp)[^.;%]){0,24}?(?:to|vs) (\d\.\d\d?)%)?", re.I), ["COR"]),
    (re.compile(r"cost of risk[^.;%]{0,60}?(\d{1,3}) ?bp(?:[^.;%]{0,40}?(?:to|vs|from) (\d{1,3}) ?bp)?", re.I), ["COR_BP"]),
    # SEVEN set: gross margin, FFO margin, LTV, payout and net debt / EBITDA multiples
    (re.compile(r"gross margin[^.;%]{0,60}?(-?\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (-?\d{1,3}\.\d)%)?", re.I), ["GP_M"]),
    (re.compile(r"FFO margin[^.;%]{0,60}?(-?\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (-?\d{1,3}\.\d)%)?", re.I), ["FFO_M"]),
    (re.compile(r"\bLTV\b[^.;%]{0,40}?(\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (\d{1,3}\.\d)%)?"), ["LTV"]),
    (re.compile(r"payout[^.;%]{0,40}?(\d{1,3}\.\d)%(?:[^.;%]{0,12}?to (\d{1,3}\.\d)%)?", re.I), ["PAYOUT"]),
    (re.compile(r"net debt[^.;]{0,25}?(?:/|÷|to|over) ?EBITDA[^.;x]{0,50}?(-?\d{1,3}\.\d) ?x(?:[^.;x]{0,12}?to (-?\d{1,3}\.\d) ?x)?", re.I), ["ND_EBITDA_X"]),
    (re.compile(r"net debt[^.;]{0,80}?(-?\d{1,3}\.\d) ?x (?:annualised )?EBITDA()", re.I), ["ND_EBITDA_X"]),
]


def walk(o, path=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk(v, f"{path}[{i}]")
    else:
        yield path, o


def collect_refs(o):
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "refs" and isinstance(v, list):
                out += [str(x) for x in v]
            else:
                out += collect_refs(v)
    elif isinstance(o, list):
        for v in o:
            out += collect_refs(v)
    return out


def main(root):
    ds = json.load(open(os.path.join(root, "data", "dataset.json")))
    facts = set()
    for f in glob.glob(os.path.join(root, "data", "*", "facts.csv")):
        for r in csv.DictReader(open(f, encoding="utf-8")):
            if r["value_sar_m"] not in ("", None):
                facts.add((r["ticker"], r["period"], r["metric_code"]))
    series = set()
    for S in ds.values():
        for t, c in S["companies"].items():
            for m, ser in c["series"].items():
                for p in ser:
                    series.add((t, p, m))
    pol = os.path.join(root, "data", "policy")   # sets without a policy section (e.g. sets/seven) have no policy folder
    items = {r["item_id"] for r in csv.DictReader(open(os.path.join(pol, "items.csv"), encoding="utf-8"))} if os.path.exists(os.path.join(pol, "items.csv")) else set()
    impacts = list(csv.DictReader(open(os.path.join(pol, "impacts.csv"), encoding="utf-8"))) if os.path.exists(os.path.join(pol, "impacts.csv")) else []
    impact_ids = {r.get("impact_id", "") for r in impacts}

    sources = {}
    for p in sorted(glob.glob(os.path.join(root, "data", "narratives", "*.yaml"))):
        sources[os.path.basename(p)] = yaml.safe_load(open(p, encoding="utf-8")) or {}
    assess = (yaml.safe_load(open(os.path.join(pol, "assessment.yaml"), encoding="utf-8")) or {}) if os.path.exists(os.path.join(pol, "assessment.yaml")) else {}
    refs = [(n, r) for n, y in sources.items() for r in collect_refs(y)]
    refs += [("assessment.yaml", r) for r in collect_refs(assess)]
    refs += [("impacts.csv", r) for row in impacts for r in re.split(r"[;, ]+", row.get("evidence_item_ids", "")) if r]

    unresolved, via_facts = [], []
    for where, r in refs:
        m = REF_RE.match(r)
        if m:
            key = (m.group(1), m.group(2), m.group(3))
            if key in series:
                continue
            if key in facts:
                via_facts.append(r)
                continue
            unresolved.append((where, r))
        elif r in items or r in impact_ids:
            continue
        else:
            unresolved.append((where, r))
    print(f"references: {len(refs)} checked, {len(set(via_facts))} resolved from facts.csv (supporting facts), {len(unresolved)} unresolved")
    for w, r in unresolved:
        print(f"  UNRESOLVED {w}: {r}")

    # ratio levels quoted in company narratives
    warns = 0
    for name, y in sources.items():
        t = str(y.get("ticker", ""))
        comp = next((S["companies"][t] for S in ds.values() if t in S["companies"]), None)
        if not comp:
            continue
        vals = {k: [v for v in comp["ratios"].get(k, {}).values() if isinstance(v, (int, float))] for k in
                ("EBITDA_M", "EBITDA_M_U", "NET_M", "OP_M", "CI", "ROE", "COR", "GP_M", "FFO_M", "LTV", "PAYOUT", "ND_EBITDA")}
        for path, text in walk(y):
            if not isinstance(text, str) or ".data_notes" in path or "lfl_basis" in path:
                continue
            for rx, keys in RATIO_WORDS:
                for mt in rx.finditer(text):
                    for g in (mt.group(1), mt.group(2) if mt.re.groups > 1 else None):
                        if not g:
                            continue
                        bp = keys == ["COR_BP"]
                        mult = keys == ["ND_EBITDA_X"]   # multiples are quoted as 2.3x, not percentages
                        x = float(g) if mult else float(g) / (10000 if bp else 100)
                        cands = [v for k in (["COR"] if bp else ["ND_EBITDA"] if mult else keys) for v in vals.get(k, [])]
                        # bp quotes are whole numbers: allow rounding (0.5 bp)
                        tol = 0.0000501 if bp else (0.06 if mult else (0.00006 if keys == ["COR"] else 0.0015))
                        if cands and not any(abs(x - v) <= tol for v in cands):
                            warns += 1
                            near = min(cands, key=lambda v: abs(v - x))
                            print(f"  WARN {name}{path}: '{mt.group(0)[:70]}' {g}{' bp' if bp else 'x' if mult else '%'} not in calculated {'/'.join(keys)} (nearest {near if mult else near*(10000 if bp else 100):.1f}{' bp' if bp else 'x' if mult else '%'})")
    print(f"ratio quotes: {warns} warning(s)")
    return 1 if unresolved else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
