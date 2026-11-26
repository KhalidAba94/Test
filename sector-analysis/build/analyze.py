"""Compute company and sector analytics from final facts -> JSON dataset.

Usage: python analyze.py <sectors.json> <out_json> <facts_final.csv> [<facts_final.csv> ...]

All formulas follow METHODOLOGY.md and use calc.py. Ratios are computed from
components (never averaged); balance-sheet denominators use the average of the
opening and closing balance and YTD ratios are annualised (x12/9).
"""
from __future__ import annotations

import csv
import json
import sys

import calc

FY = ["FY2022", "FY2023", "FY2024", "FY2025"]
YTD = ["9M2025", "9M2026"]
ALLP = FY + YTD
OPENING = {"FY2022": "FY2021", "FY2023": "FY2022", "FY2024": "FY2023", "FY2025": "FY2024",
           "9M2025": "FY2024", "9M2026": "FY2025"}
MONTHS = {p: (9 if p.startswith("9M") else 12) for p in ALLP}
PAIRS = [("FY2023", "FY2022"), ("FY2024", "FY2023"), ("FY2025", "FY2024"), ("9M2026", "9M2025")]


REVENUE_BASES = {"REV", "REV_M", "TOI"}


def num(x):
    return None if x in ("", None) else float(x)


def main(sectors_json, out_json, *facts_csvs):
    cfg = json.load(open(sectors_json))
    rows = [r for f in facts_csvs for r in csv.DictReader(open(f, encoding="utf-8"))]
    out = {}
    for sector, sc in cfg.items():
        srows = [r for r in rows if r["sector"] == sector]
        facts = calc.Facts.from_rows(srows)
        meta = {(r["ticker"], r["period"], r["metric_code"]): r for r in srows}
        # non-December year-ends: the 9M slot holds the year-to-date to 30 Sep, which can be shorter than nine
        # months (e.g. six months for a March year-end). It is annualised on its true length for the company's
        # ratios and left out of the sector's 9M totals and growth (listed in ytd_not_9m).
        # A group can set ytd_months (e.g. 6 for REITs, which report half-yearly): its YTD slot then holds H1, and only
        # companies whose YTD has that length enter the group totals.
        target = int(sc.get("ytd_months", 9))
        ytd_months, ytd_true = {}, {}
        for r in srows:
            if r["period"].startswith("9M") and str(r.get("period_months") or "").strip() not in ("", "0", "0.0"):
                mo = int(float(r["period_months"]))
                ytd_true[(r["ticker"], r["period"])] = mo
                if mo != target:
                    ytd_months[(r["ticker"], r["period"])] = mo
        # short financial years after a year-end change (e.g. SADAFCO FY2023 = 9 months): kept on the company page,
        # left out of sector totals, and growth across them is not meaningful
        short_fy = {(r["ticker"], r["period"]): int(float(r["period_months"])) for r in srows
                    if r["period"].startswith("FY") and str(r.get("period_months") or "").strip() not in ("", "0", "0.0", "12", "12.0")}
        sfacts = calc.Facts.from_rows([r for r in srows if (r["ticker"], r["period"]) not in ytd_months and (r["ticker"], r["period"]) not in short_fy])
        tickers = list(sc["constituents"].keys())

        def v(t, p, m):
            if "-" in m and m not in ("",):
                a, b = m.split("-")
                x, y = facts.get(t, p, a), facts.get(t, p, b)
                if x is None:
                    return None
                return x - (y or 0.0)
            return facts.get(t, p, m)

        def ratio(t, p, spec):
            n_m, d_m = spec[0], spec[1]
            n = v(t, p, n_m)
            if d_m.startswith("avg:"):
                dm = d_m[4:]
                c, o = v(t, p, dm), v(t, OPENING[p], dm)
                d = calc.avg2(c, o)
                n = calc.annualise(n, ytd_true.get((t, p)) or short_fy.get((t, p)) or MONTHS[p]) if n is not None else None
                if n is not None and d is not None and d <= 0:
                    return calc.NM   # a return on zero or negative average equity (or assets) is not meaningful
            elif d_m.startswith("ann:"):
                # stock over flow (e.g. net debt / EBITDA): the YTD flow is annualised
                d = v(t, p, d_m[4:])
                d = calc.annualise(d, ytd_true.get((t, p)) or short_fy.get((t, p)) or MONTHS[p]) if d is not None else None
                if n is not None and d is not None and d < calc.MIN_BASE:
                    return calc.NM   # a multiple of negative, zero or immaterial (< SAR 10m a year) EBITDA is not meaningful
            else:
                d = v(t, p, d_m)
            if n is None or d is None or d == 0:
                return None
            if d_m in REVENUE_BASES and d < calc.MIN_BASE:
                return calc.NM   # margin on an immaterial revenue base is not meaningful
            return n / d

        comp = {}
        for t in tickers:
            series = {}
            for m in set(sc["table_metrics"]) | {"T1_COST", "EQ_ORD", "NI", "OPINC_REP", "PBT", "DA_CF", "IMPAIR_CF"}:
                ser = {}
                for p in ["FY2021"] + ALLP:
                    key = (t, p, m)
                    if key in meta:
                        r = meta[key]
                        ser[p] = {"v": num(r["value_sar_m"]), "prov": r["provenance"], "src": r["source_id"],
                                  "loc": r["location"], "pdf": r.get("pdf_file", ""), "pages": r.get("pdf_pages", ""),
                                  "label": r.get("line_item_label", ""), "orig": num(r.get("original_value")),
                                  "note": r.get("note", ""), "trace": r.get("trace_status", ""), "review": r.get("review", "")}
                if ser:
                    series[m] = ser
            growth = {}
            for m in sc["table_metrics"]:
                g = {}
                for cur, pri in PAIRS:
                    g[f"{cur}/{pri}"] = (calc.NM if ((t, cur) in short_fy or (t, pri) in short_fy)
                                         else calc.growth(facts.get(t, cur, m), facts.get(t, pri, m)))
                g["CAGR_2022_2025"] = (calc.NM if any((t, y) in short_fy for y in FY)   # a short year inside the span: not three years
                                       else calc.cagr(facts.get(t, "FY2025", m), facts.get(t, "FY2022", m), 3))
                growth[m] = g
            ratios = {rk: {p: ratio(t, p, spec) for p in ALLP} for rk, spec in sc["ratios"].items()}
            comp[t] = {"name": sc["constituents"][t]["name"], "sub_industry": sc["constituents"][t]["sub_industry"],
                       "legal_name": next((r["company"] for r in srows if r["ticker"] == t and r["company"]), ""),
                       "series": series, "growth": growth, "ratios": ratios}

        # ------------------------------------------------------------- sector
        facts = sfacts   # sector totals, growth and ratios exclude year-to-date periods that are not nine months
        top, prof = sc["top_line"], sc["profit"]
        largest = calc.largest(facts, tickers, "FY2025", top)
        largest_profit = calc.largest(facts, tickers, "FY2025", prof)
        ex = [t for t in tickers if t != largest]

        def totals(tk, m):
            res = {}
            for p in ALLP:
                tot, n, miss = calc.sector_total(facts, tk, p, m)
                res[p] = {"v": tot, "n": n, "missing": miss}
            return res

        def growths(tk, m):
            res = {}
            for cur, pri in PAIRS:
                mg = calc.matched_growth(facts, tk, cur, pri, m)
                res[f"{cur}/{pri}"] = {"growth": mg["growth"], "cur": mg["cur"], "prior": mg["prior"],
                                       "sample": mg["sample"], "excluded": mg["excluded"], "contrib": mg["contrib"]}
            # CAGR on matched sample with both FY2022 and FY2025
            # companies with the metric in every year FY2022-FY2025 (a short year is left out of sector facts, which drops
            # that company from the CAGR sample: its span is not three years)
            samp = [t for t in tk if all(facts.get(t, y, m) is not None for y in FY)]
            s22 = sum(facts.get(t, "FY2022", m) for t in samp) if samp else None
            s25 = sum(facts.get(t, "FY2025", m) for t in samp) if samp else None
            res["CAGR_2022_2025"] = {"cagr": calc.cagr(s25, s22, 3), "sample": samp}
            return res

        def sector_ratios(tk):
            res = {}
            for rk, spec in sc["ratios"].items():
                res[rk] = {}
                for p in ALLP:
                    nsum = dsum = 0.0
                    used = []
                    for t in tk:
                        n_m, d_m = spec[0], spec[1]
                        n = v(t, p, n_m)
                        if d_m.startswith("avg:"):
                            dm = d_m[4:]
                            d = calc.avg2(v(t, p, dm), v(t, OPENING[p], dm))
                            n = calc.annualise(n, ytd_true.get((t, p)) or short_fy.get((t, p)) or MONTHS[p]) if n is not None else None
                        elif d_m.startswith("ann:"):
                            d = v(t, p, d_m[4:])
                            d = calc.annualise(d, ytd_true.get((t, p)) or short_fy.get((t, p)) or MONTHS[p]) if d is not None else None
                        else:
                            d = v(t, p, d_m)
                        if n is None or d is None:
                            continue
                        nsum += n; dsum += d; used.append(t)
                    val = (nsum / dsum) if used and dsum else None
                    if val is not None and spec[1] in REVENUE_BASES and dsum < calc.MIN_BASE:
                        val = calc.NM
                    res[rk][p] = {"v": val, "n": len(used),
                                  "excluded": [t for t in tk if t not in used]}
            return res

        metrics_sector = [m for m in sc["table_metrics"] if m not in ("T1_SUKUK", "OIRS", "REV_OIRS")]
        sec = {
            "largest_by_top_line_FY2025": largest, "largest_by_profit_FY2025": largest_profit,
            "all": {m: {"totals": totals(tickers, m), "growth": growths(tickers, m)} for m in metrics_sector},
            "ex_largest": {m: {"totals": totals(ex, m), "growth": growths(ex, m)} for m in metrics_sector},
            "ratios_all": sector_ratios(tickers), "ratios_ex_largest": sector_ratios(ex),
            "shares": {m: {p: calc.shares(facts, tickers, p, m) for p in ALLP} for m in (top, prof)},
            "hhi": {m: {p: calc.hhi(facts, tickers, p, m) for p in ALLP} for m in (top, prof)},
            "profit_makers_total": {p: sum(x for x in (facts.get(t, p, prof) for t in tickers) if x is not None and x > 0) for p in ALLP},
            "ytd_not_9m": {f"{t}|{p}": mo for (t, p), mo in ytd_months.items()},
            "short_fy": {f"{t}|{p}": mo for (t, p), mo in short_fy.items()},
        }
        out[sector] = {"config": sc, "tickers": tickers, "companies": comp, "sector": sec,
                       "periods": ALLP, "pairs": [f"{a}/{b}" for a, b in PAIRS]}
    json.dump(out, open(out_json, "w"), indent=1, default=lambda o: None)
    print("dataset ->", out_json)


if __name__ == "__main__":
    main(*sys.argv[1:])
