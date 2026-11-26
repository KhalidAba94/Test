"""Select one value per ticker x period x metric from extracted candidates.

Usage: python select_facts.py <candidates.csv> <sector> <out_facts.csv> <out_checks.csv>

Rules (METHODOLOGY s.1-2):
* Analysis periods: FY2021 (opening balances only), FY2022-FY2025, 9M2025, 9M2026.
  Balance sheets: BS@YYYY-12-31 -> FYYYYY, BS@YYYY-09-30 -> 9MYYYY.
* Value used = latest restated: candidate from the document covering the most
  recent period that presents this period (audited annual preferred over a Q4
  interim of the same year; filing date only breaks remaining ties, because old
  periods are sometimes re-filed).
* Original = value from the document where the period is the current period.
* Any difference > 0.5% between documents is written to the checks file
  (restatement, reclassification or unit-declaration error) for review.
"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict

PERIODS = {"FY2021", "FY2022", "FY2023", "FY2024", "FY2025", "9M2025", "9M2026"}


def norm_period(p, fye_month=12):
    """Balance-sheet dates -> analysis periods. The fiscal-year-end balance goes to the FY slot (non-December
    year-ends: the calendar year holding most of the fiscal year's months, as in extract_facts.fiscal_year);
    the 30 September balance goes to the 9M slot."""
    if p.startswith("BS@"):
        y, m, d = p[3:].split("-")
        y, m = int(y), int(m)
        if m == fye_month and m in (12, 3, 6, 7, 9) and d in ("31", "30"):
            return f"FY{y if fye_month >= 6 else y - 1}"
        if m == 9 and d == "30":
            return f"9M{y}"
        return None
    return p


def ytd_doc(fye_month):
    """Interim document type whose period ends on 30 September (Q3 for December year-ends)."""
    q = ((9 - fye_month) % 12) // 3
    return {1: "Q1", 2: "Q2", 3: "Q3"}.get(q)


def main(cand_csv, sector, out_csv, checks_csv):
    rows = list(csv.DictReader(open(cand_csv, encoding="utf-8")))
    groups = defaultdict(list)
    for r in rows:
        p = norm_period(r["period"], int(r.get("fye_month") or 12))
        if p not in PERIODS or r["value_sar_m"] == "":
            continue
        r["_p"] = p
        groups[(r["ticker"], p, r["metric_code"])].append(r)
    facts, checks = [], []
    for (t, p, m), cands in sorted(groups.items()):
        def key(r):
            # latest document = latest period covered (not filing date: old periods are sometimes re-filed),
            # then audited annual over a same-period interim, then latest filing date
            y, lab = r["file"].split("_")[:2]
            order = {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4, "Annual": 4}[lab]
            return (int(y), order, 1 if lab == "Annual" else 0, r["filed"])
        is_bs = cands[0]["period"].startswith("BS@")
        doc = lambda r: r["file"].split("_")[1]
        pool = cands
        if not is_bs:
            # flows: compare like documents only (annual with annual for FY; Q3 with Q3 for 9M)
            want = "Annual" if p.startswith("FY") else ytd_doc(int(cands[0].get("fye_month") or 12))
            same = [c for c in cands if doc(c) == want]
            if same:
                pool = same
        latest = max(pool, key=key)
        cur = [c for c in pool if c["column_role"] == "current"]
        if is_bs and p.startswith("FY"):
            cur = [c for c in cur if doc(c) == "Annual"] or cur
        original = min(cur, key=key) if cur else min(pool, key=key)
        used = float(latest["value_sar_m"])
        orig = float(original["value_sar_m"])
        vals = sorted({round(float(c["value_sar_m"]), 3) for c in cands})
        prov = "D"
        diff = abs(used - orig) / abs(orig) if orig else (0.0 if used == orig else 1.0)
        if latest is not original and diff > 0.005:
            prov = "R"
        if len(vals) > 1:
            lo, hi = min(vals), max(vals)
            rel = (hi - lo) / max(abs(lo), abs(hi), 1e-9)
            if rel > 0.005:
                ratio = (abs(hi) / abs(lo)) if lo else None
                kind = "possible unit error" if ratio and 900 < ratio < 1100 else ("restated (like documents)" if prov == "R" else "differs across document types (not a restatement)")
                checks.append({"ticker": t, "period": p, "metric_code": m, "kind": kind,
                               "values": " | ".join(f'{c["file"]}={float(c["value_sar_m"]):.3f}' for c in sorted(cands, key=key)),
                               "used_file": latest["file"], "used": used, "original": orig})
        facts.append({
            "fact_id": f"{t}-{p}-{m}", "sector": sector, "ticker": t, "company": latest["entity_name"],
            "period": p, "period_end": latest["period_end"], "period_months": latest["period_months"],
            "metric_code": m, "value_sar_m": round(used, 4), "value_original": latest["value_original"],
            "unit_original": latest["rounding"], "currency_original": latest.get("currency") or "SAR", "provenance": prov,
            "source_id": latest["company_dir"] + "/" + latest["file"],
            "location": f'XBRL xls section {latest["section_code"]}, row(s) {latest["xls_rows"]}',
            "line_item_label": latest["labels"], "reported_in_filing": latest["file"],
            "original_value": round(orig, 4), "original_source": original["company_dir"] + "/" + original["file"],
            "assurance": latest["status"], "n_documents": len(cands),
        })
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(facts[0].keys()))
        w.writeheader(); w.writerows(facts)
    with open(checks_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["ticker", "period", "metric_code", "kind", "values", "used_file", "used", "original"])
        w.writeheader(); w.writerows(checks)
    print(f"{len(facts)} facts -> {out_csv}; {len(checks)} cross-document differences -> {checks_csv}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
