"""Position-aware classification of bank income-statement lines (XBRL section 300200).

Usage: python bank_is.py <banks_xbrl_long.csv> <banks_meta.csv> <out_candidates.csv>

Why: Saudi banks label fee and impairment lines inconsistently across banks
and years (gross vs net fee lines; impairments inside total operating
expenses; 'other operating expenses' deducted inside operating income). For
each filing column the statement is split into:
  * income block  = lines above "Total operating income"
  * expense block = lines between "Total operating income" and "Total operating expenses"
and classified:
  FEES_NET     = sum of fee lines at the shallowest depth among fee lines
  OTHER_OI     = TOI - NSCI - FEES_NET                     (calculated)
  IMPAIR_TOTAL = expense-block lines matching impairment / provision / credit loss
  IMPAIR_FIN   = impairment lines on loans / financing / credit losses
  OPEX_PRE     = expense-block lines that are not impairments
Checks: OPEX_PRE + IMPAIR_TOTAL must equal Total operating expenses.
"""
from __future__ import annotations

import csv
import re
import sys
from collections import defaultdict

from extract_facts import SCALE, period_label

IMP_RE = re.compile(r"impair|provision|credit loss|expected credit", re.I)
FIN_RE = re.compile(r"loan|financ|credit loss|advances", re.I)
FEE_RE = re.compile(r"\bfee", re.I)
NSCI_LABEL = "Special commission income (expense)/ financing and investment income (expense), net"


def main(long_csv, meta_csv, out_csv):
    meta = {(m["company_dir"], m["file"]): m for m in csv.DictReader(open(meta_csv, encoding="utf-8"))}
    cols = defaultdict(list)   # (comp, file, col) -> rows in order
    for r in csv.DictReader(open(long_csv, encoding="utf-8")):
        if r["section_code"] != "300200" or r["value"] == "":
            continue
        if r["member"] and r["member"] != "English [member]":
            continue
        cols[(r["company_dir"], r["file"], r["col"])].append(r)
    out = []
    for (comp, f, col), rows in cols.items():
        rows.sort(key=lambda r: int(r["row"]))
        labels = [r["label"] for r in rows]
        if "Total operating income" not in labels or "Total operating expenses" not in labels:
            continue
        m = meta.get((comp, f), {})
        scale = SCALE.get(m.get("rounding", ""))
        i_toi = labels.index("Total operating income")
        i_opx = labels.index("Total operating expenses")
        inc, exp = rows[:i_toi], rows[i_toi + 1:i_opx]
        v = lambda r: float(r["value"])
        toi = v(rows[i_toi]); opx = v(rows[i_opx])
        nsci = next((v(r) for r in inc if r["label"] == NSCI_LABEL), None)
        fee_rows = [r for r in inc if FEE_RE.search(r["label"])]
        fees = None
        if fee_rows:
            dmin = min(int(r["depth"]) for r in fee_rows)
            fees = sum(v(r) for r in fee_rows if int(r["depth"]) == dmin)
            fee_labels = " + ".join(r["label"] for r in fee_rows if int(r["depth"]) == dmin)
        imp_rows = [r for r in exp if IMP_RE.search(r["label"])]
        cost_rows = [r for r in exp if not IMP_RE.search(r["label"])]
        imp_total = sum(v(r) for r in imp_rows)
        imp_fin = sum(v(r) for r in imp_rows if FIN_RE.search(r["label"]))
        opex_pre = sum(v(r) for r in cost_rows)
        recon = opex_pre + imp_total - opx
        st, en = rows[0]["start"], rows[0]["end"]
        plabel, months = period_label(st, en, False)
        filed = re.search(r"filed(\d{4}-\d{2}-\d{2})", f).group(1)
        role = "current" if en == m.get("end") else "comparative"
        base = {"ticker": comp.split("_")[0], "company_dir": comp, "period": plabel, "period_months": months,
                "period_start": st, "period_end": en, "rounding": m.get("rounding", ""), "file": f,
                "filed": filed, "column_role": role, "section_code": "300200", "status": m.get("status", ""),
                "entity_name": m.get("entity_name", "")}
        def add(metric, val, labs, rws):
            if val is None:
                return
            out.append({**base, "metric_code": metric, "value_original": val,
                        "value_sar_m": val * scale if scale else "", "labels": labs, "xls_rows": rws,
                        "check": f"opex recon diff={recon:.0f}"})
        rr = lambda rs: ",".join(str(int(r["row"]) + 1) for r in rs)
        if fees is not None:
            add("FEES_NET", fees, fee_labels, rr([r for r in fee_rows if int(r["depth"]) == dmin]))
            if nsci is not None:
                add("OTHER_OI", toi - nsci - fees, "calc: TOI - NSCI - FEES_NET", "")
        add("OPEX_PRE", opex_pre, " + ".join(r["label"] for r in cost_rows), rr(cost_rows))
        add("IMPAIR_TOTAL", imp_total, " + ".join(r["label"] for r in imp_rows) or "(none)", rr(imp_rows))
        add("IMPAIR_FIN", imp_fin, " + ".join(r["label"] for r in imp_rows if FIN_RE.search(r["label"])) or "(none)",
            rr([r for r in imp_rows if FIN_RE.search(r["label"])]))
        add("OPEX_RECON_DIFF", recon, "check: OPEX_PRE + IMPAIR_TOTAL - Total operating expenses", "")
    fields = ["ticker", "company_dir", "metric_code", "period", "period_months", "period_start", "period_end",
              "value_original", "rounding", "value_sar_m", "file", "filed", "column_role", "section_code",
              "labels", "xls_rows", "status", "entity_name", "check"]
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader(); w.writerows(out)
    bad = [o for o in out if o["metric_code"] == "OPEX_RECON_DIFF" and abs(o["value_original"]) > 1]
    print(f"{len(out)} candidates -> {out_csv}; opex reconciliation failures: {len(bad)}")
    for b in bad[:20]:
        print("  RECON", b["company_dir"], b["file"], b["period"], b["value_original"])


if __name__ == "__main__":
    main(*sys.argv[1:4])
