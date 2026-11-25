"""Extract mapped metrics from parsed XBRL long tables into candidate facts.

Usage: python extract_facts.py <parsed_long.csv> <meta.csv> <mapping.json> <out_candidates.csv>

For every file x mapped metric x column context, writes one candidate row with:
  ticker, period (FY2024 / 9M2026 / H12026 / Q12026 / 3M-Q32026 / BS@2026-09-30),
  value in SAR m (scaled by the file's declared rounding), the file, its filing
  date, whether the column is the file's current or comparative period, and the
  exact labels used. Period selection (latest restated vs original) is done in
  select_facts.py so that the choice is auditable.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date

SCALE = {"Actuals": 1e-6, "Thousands": 1e-3, "Millions": 1.0}
BALANCE_SECTIONS = {"300200", "300100", "300210", "300220"}


def d(s):
    try:
        y, m, dd = map(int, str(s)[:10].split("-"))
        return date(y, m, dd)
    except Exception:
        return None


def period_label(start, end, is_balance):
    e = d(end)
    if e is None:
        return None, None
    if is_balance:
        return f"BS@{e.isoformat()}", 0
    s = d(start)
    if s is None:
        return None, None
    months = (e.year - s.year) * 12 + (e.month - s.month) + 1
    if months == 12 and e.month == 12 and e.day == 31:
        return f"FY{e.year}", 12
    if s.month == 1 and s.day == 1:
        return {3: f"Q1{e.year}", 6: f"H1{e.year}", 9: f"9M{e.year}"}.get(months, f"{months}M{e.year}"), months
    if months == 3:
        q = (e.month - 1) // 3 + 1
        return f"3M-Q{q}{e.year}", 3
    return f"{months}M-{e.isoformat()}", months


def main(long_csv, meta_csv, mapping_json, out_csv):
    raw_map = json.load(open(mapping_json))
    mapping = {k: v for k, v in raw_map.items() if not k.startswith("_")}
    balance_sections = set(raw_map.get("_balance_sections", BALANCE_SECTIONS))
    wanted_sections = {s for v in mapping.values() for s in v["sections"]}
    meta = {}
    for m in csv.DictReader(open(meta_csv, encoding="utf-8")):
        meta[(m["company_dir"], m["file"])] = m
    # index rows: (company_dir, file, section, label, col) -> first value
    idx = {}
    dup = defaultdict(int)
    ctx = {}
    for r in csv.DictReader(open(long_csv, encoding="utf-8")):
        if r["section_code"] not in wanted_sections:
            continue
        if r["member"] and r["member"] not in ("English [member]",):
            continue  # skip dimensional (segment/component) values here
        key = (r["company_dir"], r["file"], r["section_code"], r["label"], r["col"])
        if key in idx:
            dup[key] += 1
            continue
        if r["value"] in ("", None):
            continue
        idx[key] = (float(r["value"]), r["row"])
        ctx[(r["company_dir"], r["file"], r["section_code"], r["col"])] = (r["start"], r["end"])
    out = []
    files = sorted({(k[0], k[1]) for k in idx})
    colmap = defaultdict(set)
    for k in idx:
        colmap[(k[0], k[1], k[2])].add(k[4])
    for comp, f in files:
        m = meta.get((comp, f), {})
        scale = SCALE.get(m.get("rounding", ""), None)
        ticker = comp.split("_", 1)[0]
        filed = re.search(r"filed(\d{4}-\d{2}-\d{2})", f)
        filed = filed.group(1) if filed else ""
        for metric, spec in mapping.items():
            for sec in spec["sections"]:
                cols = sorted(colmap.get((comp, f, sec), ()), key=int)
                for col in cols:
                    st, en = ctx.get((comp, f, sec, col), ("", ""))
                    is_bal = sec in balance_sections
                    plabel, months = period_label(st, en, is_bal)
                    if plabel is None:
                        continue
                    found, labels_used, rows_used = [], [], []
                    for lab in spec["labels"]:
                        v = idx.get((comp, f, sec, lab, col))
                        if v is not None:
                            found.append(v[0]); labels_used.append(lab); rows_used.append(v[1])
                            if not spec.get("sum"):
                                break
                    if not found:
                        continue
                    val = sum(found)
                    if spec.get("abs"):
                        val = abs(val)
                    role = "current" if (en == m.get("end") or (is_bal and en == m.get("end"))) else "comparative"
                    out.append({
                        "ticker": ticker, "company_dir": comp, "metric_code": metric,
                        "period": plabel, "period_months": months, "period_start": st, "period_end": en,
                        "value_original": val, "rounding": m.get("rounding", ""),
                        "value_sar_m": (val * scale) if scale is not None else "",
                        "file": f, "filed": filed, "column_role": role, "section_code": sec,
                        "labels": " + ".join(labels_used), "xls_rows": ",".join(str(int(x) + 1) for x in rows_used),
                        "status": m.get("status", ""), "entity_name": m.get("entity_name", ""),
                    })
                if out and out[-1]["file"] == f and out[-1]["metric_code"] == metric and out[-1]["company_dir"] == comp:
                    break  # metric found in an earlier-listed section; don't double count
    fields = list(out[0].keys()) if out else []
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(out)
    print(f"{len(out)} candidate values -> {out_csv}; duplicate-label rows skipped: {len(dup)}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
