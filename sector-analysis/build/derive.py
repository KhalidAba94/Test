"""Apply documented overrides, derive calculated metrics and build the analysis dataset.

Usage: python derive.py <sector> <facts_xbrl.csv> <overrides.csv> <out_facts_final.csv>

Order:
 1. Start from selected XBRL facts (provenance D/R, with source + location).
 2. Apply overrides from data/overrides.csv (figures taken from the PDF where the XBRL is
    missing, unreadable or mis-tagged). Each override names its PDF page and reason.
 3. Derive calculated metrics (provenance C) with the formula in `location`.
"""
from __future__ import annotations

import csv
import sys

PERIODS = ["FY2021", "FY2022", "FY2023", "FY2024", "FY2025", "9M2025", "9M2026"]
OPENING = {"FY2022": "FY2021", "FY2023": "FY2022", "FY2024": "FY2023", "FY2025": "FY2024",
           "9M2025": "FY2024", "9M2026": "FY2025"}
MONTHS = {p: (9 if p.startswith("9M") else 12) for p in PERIODS}


def load(path):
    return list(csv.DictReader(open(path, encoding="utf-8")))


def main(sector, facts_csv, overrides_csv, out_csv):
    rows = load(facts_csv)
    facts = {(r["ticker"], r["period"], r["metric_code"]): r for r in rows}
    companies = {r["ticker"]: r["company"] for r in rows}
    # 2. overrides
    try:
        ovs = [o for o in load(overrides_csv) if o["sector"] == sector]
    except FileNotFoundError:
        ovs = []
    for o in ovs:
        key = (o["ticker"], o["period"], o["metric_code"])
        prev = facts.get(key)
        facts[key] = {
            "fact_id": "-".join(key), "sector": sector, "ticker": o["ticker"],
            "company": companies.get(o["ticker"], ""), "period": o["period"],
            "period_end": prev["period_end"] if prev else "", "period_months": MONTHS.get(o["period"], ""),
            "metric_code": o["metric_code"], "value_sar_m": float(o["value_sar_m"]) if o["value_sar_m"] != "" else "",
            "value_original": o.get("value_original", ""), "unit_original": o.get("unit_original", ""),
            "currency_original": "SAR", "provenance": o.get("provenance", "D"),
            "source_id": o["source"], "location": f'PDF p.{o["page"]}' if o.get("page") else o.get("location", ""),
            "line_item_label": o.get("label", ""), "reported_in_filing": o["source"],
            "original_value": prev["value_sar_m"] if prev else "", "original_source": prev["source_id"] if prev else "",
            "assurance": o.get("assurance", ""), "n_documents": "",
            "note": f'OVERRIDE: {o["reason"]}' + (f' (XBRL value was {prev["value_sar_m"]})' if prev else ""),
        }
    val = lambda t, p, m: (float(facts[(t, p, m)]["value_sar_m"]) if (t, p, m) in facts and facts[(t, p, m)]["value_sar_m"] not in ("", None) else None)

    def add(t, p, m, v, formula, inputs):
        if v is None:
            return
        srcs = sorted({facts[(t, p2, m2)]["source_id"] for (p2, m2) in inputs if (t, p2, m2) in facts})
        facts[(t, p, m)] = {"fact_id": f"{t}-{p}-{m}", "sector": sector, "ticker": t, "company": companies.get(t, ""),
                            "period": p, "period_end": "", "period_months": MONTHS.get(p, ""), "metric_code": m,
                            "value_sar_m": round(v, 6), "value_original": "", "unit_original": "", "currency_original": "SAR",
                            "provenance": "C", "source_id": " | ".join(srcs), "location": formula,
                            "line_item_label": "", "reported_in_filing": "", "original_value": "", "original_source": "",
                            "assurance": "", "n_documents": "", "note": ""}

    tickers = sorted({k[0] for k in facts})
    for t in tickers:
        for p in PERIODS:
            # attributable profit fallback: no NCI line and no attributable line -> NI
            if val(t, p, "NI_ATTR") is None and val(t, p, "NI") is not None and val(t, p, "NI_NCI") is None:
                add(t, p, "NI_ATTR", val(t, p, "NI"), "NI (no non-controlling interest line in the filing)", [(p, "NI")])
            if sector == "Energy":
                op = val(t, p, "OPINC_REP")
                if op is None and val(t, p, "PBT") is not None:
                    pbt, fc, fi, jv = (val(t, p, m) or 0.0 for m in ("PBT", "FIN_COST", "FIN_INC", "SHARE_JV"))
                    add(t, p, "OPINC", pbt + fc - fi - jv, "PBT + finance costs - finance income - share of JV/associates",
                        [(p, "PBT"), (p, "FIN_COST"), (p, "FIN_INC"), (p, "SHARE_JV")])
                elif op is not None:
                    add(t, p, "OPINC", op, "operating profit as reported", [(p, "OPINC_REP")])
                    facts[(t, p, "OPINC")]["provenance"] = facts[(t, p, "OPINC_REP")]["provenance"]
                if val(t, p, "OPINC") is not None and val(t, p, "DA_CF") is not None:
                    add(t, p, "EBITDA_C", val(t, p, "OPINC") + val(t, p, "DA_CF") + (val(t, p, "IMPAIR_CF") or 0.0),
                        "OPINC + D&A (cash-flow) + impairment add-backs (cash-flow)",
                        [(p, "OPINC"), (p, "DA_CF"), (p, "IMPAIR_CF")])
                if val(t, p, "REV") is not None and val(t, p, "OIRS") is not None:
                    add(t, p, "REV_OIRS", val(t, p, "REV") + val(t, p, "OIRS"), "Revenue + other income related to sales",
                        [(p, "REV"), (p, "OIRS")])
                if val(t, p, "CFO") is not None and val(t, p, "CAPEX") is not None:
                    add(t, p, "FCF", val(t, p, "CFO") - val(t, p, "CAPEX"), "CFO - capex", [(p, "CFO"), (p, "CAPEX")])
            if sector == "Banks":
                if val(t, p, "TOI") is not None and val(t, p, "OPEX_PRE") is not None:
                    add(t, p, "PPOP", val(t, p, "TOI") - val(t, p, "OPEX_PRE"), "TOI - OPEX_PRE", [(p, "TOI"), (p, "OPEX_PRE")])
                if val(t, p, "EQ_ATTR") is not None:
                    s = val(t, p, "T1_SUKUK") or 0.0
                    add(t, p, "EQ_ORD", val(t, p, "EQ_ATTR") - s, "EQ_ATTR - T1_SUKUK (0 if none)", [(p, "EQ_ATTR"), (p, "T1_SUKUK")])
    out = sorted(facts.values(), key=lambda r: (r["ticker"], r["period"], r["metric_code"]))
    fields = ["fact_id", "sector", "ticker", "company", "period", "period_end", "period_months", "metric_code",
              "value_sar_m", "value_original", "unit_original", "currency_original", "provenance", "source_id",
              "location", "line_item_label", "reported_in_filing", "original_value", "original_source",
              "assurance", "n_documents", "pdf_file", "pdf_status", "pdf_pages", "note"]
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader(); w.writerows(out)
    print(f"{len(out)} facts ({sum(1 for r in out if r['provenance']=='C')} calculated, {len(ovs)} overrides) -> {out_csv}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
