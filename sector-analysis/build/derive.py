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
import os
import sys

PERIODS = ["FY2021", "FY2022", "FY2023", "FY2024", "FY2025", "9M2025", "9M2026"]
OPENING = {"FY2022": "FY2021", "FY2023": "FY2022", "FY2024": "FY2023", "FY2025": "FY2024",
           "9M2025": "FY2024", "9M2026": "FY2025"}
MONTHS = {p: (9 if p.startswith("9M") else 12) for p in PERIODS}


def load(path):
    return list(csv.DictReader(open(path, encoding="utf-8")))


HOLDING = {"2030"}   # investment-holding companies (no operating revenue)


def main(sector, facts_csv, overrides_csv, out_csv):
    root = os.path.dirname(os.path.dirname(os.path.abspath(overrides_csv)))
    oneoffs = [o for o in load(os.path.join(root, "data", "one_offs.csv"))] if os.path.exists(os.path.join(root, "data", "one_offs.csv")) else []
    reasons = {(r["ticker"], r["period"], r["metric_code"]): r for r in load(os.path.join(root, "data", "restatement_reasons.csv"))} if os.path.exists(os.path.join(root, "data", "restatement_reasons.csv")) else {}
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
    # 2b. bank ECL on loans and financing from the credit-risk notes (comparable cost-of-risk numerator)
    ecl_path = os.path.join(os.path.dirname(os.path.abspath(out_csv)), "ecl_loans.csv")
    if sector == "Banks" and os.path.exists(ecl_path):
        for e in load(ecl_path):
            if e["value_sar_m"] in ("", None):
                continue
            key = (e["ticker"], e["period"], "ECL_LOANS")
            ref = facts.get((e["ticker"], e["period"], "IMPAIR_FIN")) or {}
            facts[key] = {
                "fact_id": "-".join(key), "sector": sector, "ticker": e["ticker"], "company": companies.get(e["ticker"], ""),
                "period": e["period"], "period_end": ref.get("period_end", ""), "period_months": MONTHS.get(e["period"], ""),
                "metric_code": "ECL_LOANS", "value_sar_m": float(e["value_sar_m"]), "value_original": "", "unit_original": "",
                "currency_original": "SAR", "provenance": e["provenance"], "source_id": e["source_pdf"],
                "location": f'PDF p.{e["page"]}', "line_item_label": e["basis_note"][:200], "reported_in_filing": e["source_pdf"],
                "original_value": "", "original_source": "", "assurance": ref.get("assurance", ""), "n_documents": "",
                "pdf_file": e["source_pdf"], "pdf_status": "manual_confirmed", "pdf_pages": e["page"],
                "note": f'Basis: {e["basis"].replace("_", " ")}' + (f'; {e["flags"]}' if e["flags"] else "") + ". Read from the credit-risk note by an independent analyst.",
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
                add(t, p, "NI_ATTR", val(t, p, "NI"), "Profit for the period (no non-controlling interests reported, so all profit is attributable)", [(p, "NI")])
                facts[(t, p, "NI_ATTR")]["provenance"] = facts[(t, p, "NI")]["provenance"]
            if val(t, p, "EQ_ATTR") is None and val(t, p, "TE") is not None and val(t, p, "NI_NCI") is None:
                add(t, p, "EQ_ATTR", val(t, p, "TE"), "Total equity (no non-controlling interests reported)", [(p, "TE")])
            if sector == "Energy":
                # One operating-income definition for every company (METHODOLOGY s.6):
                # PBT + finance costs - finance income - share of results of JVs/associates.
                # Investment-holding companies (no revenue) keep investment results inside operating income.
                if val(t, p, "PBT") is not None:
                    pbt, fc, fi, jv = (val(t, p, m) or 0.0 for m in ("PBT", "FIN_COST", "FIN_INC", "SHARE_JV"))
                    if t in HOLDING:
                        add(t, p, "OPINC", pbt + fc - fi, "PBT + finance costs - finance income (investment holding: investment results kept in operating income)",
                            [(p, "PBT"), (p, "FIN_COST"), (p, "FIN_INC")])
                    else:
                        add(t, p, "OPINC", pbt + fc - fi - jv, "PBT + finance costs - finance income - share of results of JVs/associates",
                            [(p, "PBT"), (p, "FIN_COST"), (p, "FIN_INC"), (p, "SHARE_JV")])
                if val(t, p, "OPINC") is not None and val(t, p, "DA_CF") is not None:
                    ebitda = val(t, p, "OPINC") + val(t, p, "DA_CF") + (val(t, p, "IMPAIR_CF") or 0.0)
                    add(t, p, "EBITDA_C", ebitda, "OPINC + D&A (cash-flow) + impairment add-backs (cash-flow)",
                        [(p, "OPINC"), (p, "DA_CF"), (p, "IMPAIR_CF")])
                    adj = sum(float(o["amount_sar_m"]) * (1 if o["direction"] == "gain" else -1)
                              for o in oneoffs if o["ticker"] == t and o["period"] == p and o["in_metric"] == "OPINC")
                    ids = ", ".join(o["oneoff_id"] for o in oneoffs if o["ticker"] == t and o["period"] == p)
                    add(t, p, "EBITDA_U", ebitda - adj, "EBITDA_C less identified one-off gains / plus one-off losses in operating income" + (f" ({ids})" if ids else " (none identified)"),
                        [(p, "EBITDA_C")])
                if val(t, p, "REV") is not None:
                    add(t, p, "REV_M", val(t, p, "REV") + (val(t, p, "OIRS") or 0.0),
                        "Revenue + other income related to sales (margin base; equals revenue where there is no such income)",
                        [(p, "REV"), (p, "OIRS")])
                if val(t, p, "CFO") is not None and val(t, p, "CAPEX") is not None:
                    add(t, p, "FCF", val(t, p, "CFO") - val(t, p, "CAPEX"), "CFO - capex", [(p, "CFO"), (p, "CAPEX")])
            if sector == "Banks":
                if val(t, p, "TOI") is not None and val(t, p, "OPEX_PRE") is not None:
                    add(t, p, "PPOP", val(t, p, "TOI") - val(t, p, "OPEX_PRE"), "TOI - OPEX_PRE", [(p, "TOI"), (p, "OPEX_PRE")])
                if val(t, p, "EQ_ATTR") is not None:
                    s = val(t, p, "T1_SUKUK") or 0.0
                    add(t, p, "EQ_ORD", val(t, p, "EQ_ATTR") - s, "EQ_ATTR - T1_SUKUK (0 if none)", [(p, "EQ_ATTR"), (p, "T1_SUKUK")])
    for k in [k for k in facts if k[2] == "OPINC_REP"]:
        del facts[k]   # superseded by the single operating-income definition (OPINC); not published
    ISLAMIC = {"1120", "1140", "1150", "1020"}
    for k, r in facts.items():
        if k[2] == "NSCI" and k[0] in ISLAMIC:
            r["note"] = (r.get("note", "") + " " if r.get("note") else "") + "Islamic bank: 'net income from financing and investments' mapped to net special commission income."
        if k[2] == "SHARE_JV" and k[0] in HOLDING:
            r["note"] = (r.get("note", "") + " " if r.get("note") else "") + "XBRL subtotal of investment results (dividends, associates, fair-value changes), not share of associates alone; kept inside operating income for this investment holding."
    for k, r in facts.items():
        # lines the bank parser computed (e.g. other operating income = TOI - NSCI - fees) are calculated, not disclosed
        if r.get("line_item_label", "").startswith("calc:") and r.get("provenance") in ("D", "R") and not r.get("note", "").startswith("OVERRIDE"):
            if r["provenance"] == "R":
                r["note"] = (r.get("note", "") + " " if r.get("note") else "") + "Inputs restated in a later filing."
            r["provenance"] = "C"
            r["location"] = "formula: " + r["line_item_label"][5:].strip()
    # full-trace results (data/trace/full_trace.csv): page and method for every fact, applied only when the value is unchanged
    tp = os.path.join(os.path.dirname(os.path.abspath(out_csv)), "..", "trace", "full_trace.csv")
    if os.path.exists(tp):
        for t in csv.DictReader(open(tp, encoding="utf-8")):
            r = facts.get((t["ticker"], t["period"], t["metric_code"]))
            if not r or str(r.get("value_sar_m")) != t["value_sar_m"]:
                continue
            r["trace_status"] = t["trace_status"]
            if t["pages"] and t["trace_status"] not in ("calculated_ok", "calculated_rule"):
                if not r.get("pdf_pages") or r.get("pdf_status") == "not_found":
                    r["pdf_pages"] = t["pages"]
                    if t["pdf_used"]:
                        r["pdf_file"] = t["pdf_used"].split("/", 1)[1]
                r["pdf_status"] = t["trace_status"]
    for k, r in facts.items():
        rr = reasons.get(k)
        if rr:
            if rr["reason"].startswith("NOT A RESTATEMENT") and r.get("provenance") == "R":
                r["provenance"] = "D"
            r["note"] = (r.get("note", "") + " " if r.get("note") else "") + f'Restatement/reclassification note: {rr["reason"]} [{rr["source"]}]'
    out = sorted(facts.values(), key=lambda r: (r["ticker"], r["period"], r["metric_code"]))
    fields = ["fact_id", "sector", "ticker", "company", "period", "period_end", "period_months", "metric_code",
              "value_sar_m", "value_original", "unit_original", "currency_original", "provenance", "source_id",
              "location", "line_item_label", "reported_in_filing", "original_value", "original_source",
              "assurance", "n_documents", "pdf_file", "pdf_status", "pdf_pages", "trace_status", "note"]
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader(); w.writerows(out)
    print(f"{len(out)} facts ({sum(1 for r in out if r['provenance']=='C')} calculated, {len(ovs)} overrides) -> {out_csv}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
