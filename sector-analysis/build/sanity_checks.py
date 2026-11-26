"""Automated first screen of a sector's figures before review.

Usage: python sanity_checks.py <root_dir> [sector keys...]
Writes data/<slug>/sanity.csv and prints a summary. Flags (not errors in themselves):
  missing        a core figure is absent for a period the company reports
  relation       an impossible or implausible relation (gross profit above revenue, EBITDA above revenue,
                 equity above assets, attributable above total profit by more than minorities, negative revenue)
  jump           year-on-year change beyond +150% / -60% in revenue, total assets or equity
  ytd_vs_fy      9M figure above 95% of the full year it belongs to, or below 40% (seasonality aside, a sign of a
                 wrong column or a mislabelled period)
  restated_big   a restated comparative differs from the original by more than 10%
"""
from __future__ import annotations

import csv
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sectors  # noqa: E402

CORE = {"corporate": ["REV", "NI", "NI_ATTR", "PBT", "DA_CF", "CFO", "CAPEX", "TA", "TE", "EQ_ATTR", "CASH"],
        "bank": ["TOI", "NSCI", "NI_ATTR", "TA", "LOANS", "DEPOSITS", "EQ_ATTR"],
        "reit": ["REV", "NI", "NI_ATTR", "DA_CF", "TA", "DEBT", "CASH", "EQ_ATTR", "DIST"]}
FY = ["FY2022", "FY2023", "FY2024", "FY2025"]


def main(root, *keys):
    ds = json.load(open(os.path.join(root, "data", "dataset.json")))
    for s in sectors.load(root):
        if (keys and s["key"] not in keys) or s["key"] not in ds:
            continue
        S = ds[s["key"]]
        facts = list(csv.DictReader(open(os.path.join(root, "data", s["slug"], "facts.csv"), encoding="utf-8")))
        fx = {(r["ticker"], r["period"], r["metric_code"]): r for r in facts}
        out = []

        def v(t, p, m):
            r = fx.get((t, p, m))
            try:
                return float(r["value_sar_m"]) if r and r["value_sar_m"] not in ("", None) else None
            except ValueError:
                return None

        for t in S["tickers"]:
            for p in FY + ["9M2025", "9M2026"]:
                if not any((t, p, m) in fx for m in CORE[s["template"]][:2]):
                    out.append((t, p, "missing", "no top line or profit for this period", ""))
                    continue
                for m in CORE[s["template"]]:
                    if v(t, p, m) is None:
                        out.append((t, p, "missing", m, ""))
                if s["template"] == "corporate":
                    rev, gp, eb = v(t, p, "REV"), v(t, p, "GP"), v(t, p, "EBITDA_C")
                    if rev is not None and rev < 0:
                        out.append((t, p, "relation", "negative revenue", rev))
                    if rev and gp is not None and gp > rev * 1.001:
                        out.append((t, p, "relation", "gross profit above revenue", f"GP {gp:.1f} > REV {rev:.1f}"))
                    if rev and eb is not None and rev > 10 and eb > rev * 1.0:
                        out.append((t, p, "relation", "EBITDA above revenue", f"EBITDA {eb:.1f} > REV {rev:.1f}"))
                ta, te = v(t, p, "TA"), v(t, p, "TE")
                if ta is not None and te is not None and te > ta:
                    out.append((t, p, "relation", "equity above total assets", f"TE {te:.1f} > TA {ta:.1f}"))
                ni, na, nn = v(t, p, "NI"), v(t, p, "NI_ATTR"), v(t, p, "NI_NCI")
                if ni is not None and na is not None and abs(ni - na - (nn or 0.0)) > max(1.0, abs(ni) * 0.01):
                    out.append((t, p, "relation", "profit attributable + minorities differs from profit", f"NI {ni:.1f}, attributable {na:.1f}, NCI {nn}"))
                r = fx.get((t, p, CORE[s["template"]][0]))
                if r and r.get("provenance") == "R" and r.get("original_value") not in ("", None):
                    try:
                        o, u = float(r["original_value"]), float(r["value_sar_m"])
                        if o and abs(u - o) / abs(o) > 0.10:
                            out.append((t, p, "restated_big", r["metric_code"], f"{o:.1f} -> {u:.1f}"))
                    except ValueError:
                        pass
            for m in (CORE[s["template"]][0], "TA", "EQ_ATTR"):
                for a, b in zip(FY, FY[1:]):
                    x, y = v(t, a, m), v(t, b, m)
                    if x and y is not None and x > 0:
                        g = y / x - 1
                        if g > 1.5 or g < -0.6:
                            out.append((t, b, "jump", m, f"{x:.1f} -> {y:.1f} ({g:+.0%})"))
            top = CORE[s["template"]][0]
            for ytd, fy in (("9M2025", "FY2025"),):
                a, b = v(t, ytd, top), v(t, fy, top)
                r = fx.get((t, ytd, top))
                months = float(r.get("period_months") or 9) if r else 9
                if a is not None and b and months == 9 and not (0.4 <= a / b <= 0.95):
                    out.append((t, ytd, "ytd_vs_fy", top, f"9M {a:.1f} vs FY {b:.1f} ({a / b:.0%})"))
        p = os.path.join(root, "data", s["slug"], "sanity.csv")
        with open(p, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["ticker", "period", "flag", "item", "detail"])
            w.writerows(out)
        from collections import Counter
        print(s["key"], len(out), "flags", dict(Counter(x[2] for x in out)))


if __name__ == "__main__":
    main(sys.argv[1], *sys.argv[2:])
