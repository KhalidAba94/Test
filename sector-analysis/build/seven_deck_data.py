"""Collect every figure the SEVEN deck shows, from the confirmed dataset (no new numbers are made here).

Usage: python seven_deck_data.py <root> <out_json>
"""
import csv, json, os, sys, collections
import yaml

root, out = sys.argv[1], sys.argv[2]
ds = json.load(open(os.path.join(root, "data", "dataset.json")))
lines = yaml.safe_load(open(os.path.join(root, "deck", "lines.yaml")))
adj = list(csv.DictReader(open(os.path.join(root, "data", "adjustments.csv"), encoding="utf-8")))
oneoffs = list(csv.DictReader(open(os.path.join(root, "data", "one_offs.csv"), encoding="utf-8")))
A = collections.defaultdict(list)
for r in adj:
    A[(r["ticker"], r["comparison"])].append(r)
PAIRS = [("FY2023", "FY2022"), ("FY2024", "FY2023"), ("FY2025", "FY2024"), ("9M2026", "9M2025")]


def num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def sv(c, m, p):
    return num(((c["series"].get(m) or {}).get(p) or {}).get("v"))


def growth_cell(c, top, cur, pri):
    g = c["growth"].get(top, {}).get(f"{cur}/{pri}")
    a, b = sv(c, top, cur), sv(c, top, pri)
    return {"v": g if g is not None else None, "a": a, "b": b}


def organic(t, c, top, cur, pri):
    """Growth after the measurable non-capacity bridge steps (perimeter, FX, hyperinflation, accounting)."""
    rows = [r for r in A[(t, f"{cur}/{pri}")] if r["bridge_step"] != "new_capacity"]
    if not rows:
        return None, None
    nd = any(r["basis"] == "not determinable" for r in rows)
    amt = sum(float(r["amount_sar_m"]) for r in rows if r["amount_sar_m"] not in ("", None))
    rep, prior = c["growth"].get(top, {}).get(f"{cur}/{pri}"), sv(c, top, pri)
    if not isinstance(rep, float) or not prior:
        return None, nd
    return rep - amt / prior, nd


# adjusted growth shown on the group tables and the summary: the measurable adjustment named in the basis
ADJ = {  # ticker: (comparison, label, basis)
    "6017": ("FY2025/FY2024", "FY25", "Excl. Snoonu (bought Oct 2025)"),
    "4161": ("FY2025/FY2024", "FY25", "Excl. disclosed acquisitions"),
    "6014": ("9M2026/9M2025", "9M", "Excl. Five Guys (Makkah/Taif not split)"),
    "6016": ("9M2026/9M2025", "9M", "Excl. SHOVEL café chain"),
    "4150": ("9M2026/9M2025", "9M", "Excl. land sales"),
    "4190": ("FY2024/FY2023", "FY24", "Same revenue basis (agent sales net)"),
    "2287": ("FY2024/FY2023", "FY24", "Same revenue basis (reclassification)"),
    "4163": ("FY2025/FY2024", "FY25", "Before the CSR deduction from revenue"),
    "2283": ("FY2025/FY2024", "FY25", "Excl. Al-Kenan (bought Dec 2025)"),
    "6010": ("9M2026/9M2025", "9M", "Excl. AlRaie (from May 2026)"),
}


def adjusted(t, c, top):
    if t in ADJ:
        comp, lab, basis = ADJ[t]
        cur, pri = comp.split("/")
        rows = [r for r in A[(t, comp)] if r["bridge_step"] in ("perimeter", "accounting_other") and r["amount_sar_m"] not in ("", None)]
        rep, prior = c["growth"][top].get(comp), sv(c, top, pri)
        amt = sum(float(r["amount_sar_m"]) for r in rows)
        return {"v": rep - amt / prior, "rep": rep, "label": lab, "basis": basis, "amt": amt}
    o, nd = organic(t, c, top, "9M2026", "9M2025")
    rep = c["growth"].get(top, {}).get("9M2026/9M2025")
    if o is not None and not nd and isinstance(rep, float) and abs(o - rep) < 1e-9:
        return {"v": "= reported", "label": "9M", "basis": "No acquisitions, FX or accounting effects"}
    rows = [r for r in A[(t, "9M2026/9M2025")] if r["bridge_step"] != "new_capacity" and r["basis"] == "not determinable"]
    why = sorted({r["bridge_step"] for r in rows})
    txt = {"perimeter": "acquisitions", "fx": "currency", "hyperinflation": "hyperinflation", "accounting_other": "accounting"}
    return {"v": None, "basis": ("Not measurable: " + ", ".join(txt[w] for w in why) + " not disclosed") if why else "Not measurable"}


GROUP_LABEL = {"Entertainment": "Entertainment and leisure", "Media": "Media", "FnB": "F&B operators", "Platform": "Delivery platform",
               "Malls": "Mall operators", "REITs": "Retail REITs", "Retailers": "Retailers", "Supporting": "Supporting consumer goods"}

data = {"groups": {}, "overview": [], "pairs": [], "counts": {}, "margins": {}, "leverage": {}, "oneoffs": []}
cnt = collections.Counter()
for g, S in ds.items():
    cfg, sec = S["config"], S["sector"]
    top, reit = cfg["top_line"], cfg.get("template") == "reit"
    rows = []
    # group total row (not for a one-company group)
    a, r = sec["all"], sec["ratios_all"]
    def gg(m, k):
        x = a.get(m, {}).get("growth", {}).get(k, {})
        return x.get("growth", x.get("cagr"))
    tot = {"name": f"{GROUP_LABEL[g]}: group total", "ticker": "", "total": True,
           "sub": f"{len(S['tickers'])} companies · FY2025 revenue SAR {a[top]['totals']['FY2025']['v']:,.0f}m",
           "cells": [{"v": gg(top, f"{c}/{p}"), "a": num(a[top]["totals"][c]["v"]), "b": num(a[top]["totals"][p]["v"])} for c, p in PAIRS],
           "cagr": gg(top, "CAGR_2022_2025"),
           "margin": {p: r["FFO_M" if reit else "EBITDA_M_U"][p]["v"] for p in ("FY2025", "9M2025", "9M2026")},
           "lev": r["LTV" if reit else "ND_EBITDA"]["FY2025"]["v"],
           "payout": r.get("PAYOUT", {}).get("FY2025", {}).get("v") if reit else None,
           "line": lines["group"][g]}
    for t in S["tickers"]:
        c = S["companies"][t]
        ra = c["ratios"]
        row = {"name": c["name"].split(" (")[0] if t not in ("4170",) else "TECO (Shams)", "ticker": t,
               "sub": f"FY2025 revenue SAR {sv(c, top, 'FY2025'):,.0f}m" if sv(c, top, "FY2025") is not None else "",
               "cells": [growth_cell(c, top, cu, pr) for cu, pr in PAIRS], "cagr": c["growth"][top].get("CAGR_2022_2025"),
               "adj": adjusted(t, c, top),
               "margin": {p: ra.get("FFO_M" if reit else "EBITDA_M_U", {}).get(p) for p in ("FY2025", "9M2025", "9M2026")},
               "lev": ra.get("LTV" if reit else "ND_EBITDA", {}).get("FY2025"),
               "payout": ra.get("PAYOUT", {}).get("FY2025") if reit else None,
               "ni25": sv(c, "NI_ATTR", "FY2025"), "ni9": [sv(c, "NI_ATTR", "9M2025"), sv(c, "NI_ATTR", "9M2026")],
               "line": lines["company"][t]}
        rows.append(row)
        g9 = c["growth"][top].get("9M2026/9M2025")
        if isinstance(g9, float):
            cnt["rev_n"] += 1; cnt["rev_up"] += g9 > 0
        n25, n26 = sv(c, "NI_ATTR", "9M2025"), sv(c, "NI_ATTR", "9M2026")
        if n25 is not None and n26 is not None:
            cnt["ni_n"] += 1; cnt["ni_up"] += n26 > n25
        m25, m26 = num(ra.get("FFO_M" if reit else "EBITDA_M_U", {}).get("9M2025")), num(ra.get("FFO_M" if reit else "EBITDA_M_U", {}).get("9M2026"))
        if m25 is not None and m26 is not None:
            cnt["m_n"] += 1; cnt["m_up"] += m26 > m25
        if t in ADJ:
            ad = row["adj"]
            nm = row["name"]
            data["pairs"].append({"label": f"{nm}, {ad['label']} · adj.: {ad['basis']}", "reported": ad["rep"], "adjusted": ad["v"], "ticker": t})
    data["groups"][g] = {"label": GROUP_LABEL[g], "reit": reit, "total": tot if len(S["tickers"]) > 1 else None, "rows": rows}
    lg = sec["largest_by_top_line_FY2025"]
    data["overview"].append({"group": g, "label": GROUP_LABEL[g], "n": len(S["tickers"]), "rev25": a[top]["totals"]["FY2025"]["v"],
                             "cagr": gg(top, "CAGR_2022_2025"), "g25": gg(top, "FY2025/FY2024"), "g9": gg(top, "9M2026/9M2025"),
                             "ni9": gg("NI_ATTR", "9M2026/9M2025"),
                             "margin25": r["FFO_M" if reit else "EBITDA_M_U"]["FY2025"]["v"], "margin_kind": "FFO" if reit else "EBITDA",
                             "lev25": r["LTV" if reit else "ND_EBITDA"]["FY2025"]["v"], "lev22": r["LTV" if reit else "ND_EBITDA"]["FY2022"]["v"],
                             "lev_kind": "LTV" if reit else "ND/EBITDA",
                             "largest": S["companies"][lg]["name"].split(" (")[0], "share": sec["shares"][top]["FY2025"][lg],
                             "line": lines["group"][g],
                             "m": {p: r["FFO_M" if reit else "EBITDA_M_U"][p]["v"] for p in ("FY2022", "FY2025", "9M2025", "9M2026")}})
data["counts"] = dict(cnt)
# largest one-offs (full-year rows; 9M repeats of a full-year item are left out)
oo = []
for o in oneoffs:
    try:
        amt = float(o["amount_sar_m"])
    except ValueError:
        continue
    g = next(k for k, S in ds.items() if o["ticker"] in S["tickers"])
    oo.append({"ticker": o["ticker"], "name": ds[g]["companies"][o["ticker"]]["name"].split(" (")[0], "period": o["period"],
               "item": o["item"], "amount": amt if o["direction"] == "gain" else -amt, "metric": o["in_metric"]})
oo.sort(key=lambda x: -abs(x["amount"]))
seen, top_oo = set(), []
for x in oo:
    key = (x["ticker"], round(abs(x["amount"]), 0))
    if key in seen or (x["period"].startswith("9M") and any(y["ticker"] == x["ticker"] and abs(abs(y["amount"]) - abs(x["amount"])) < 1 for y in top_oo)):
        continue
    seen.add(key); top_oo.append(x)
data["oneoffs"] = top_oo[:10]
# company leverage extremes (operating companies, FY2025)
levs = []
for g, S in ds.items():
    if S["config"].get("template") == "reit":
        continue
    for t, c in S["companies"].items():
        v = c["ratios"].get("ND_EBITDA", {}).get("FY2025")
        if isinstance(v, float):
            levs.append({"name": c["name"].split(" (")[0], "v": v, "group": g})
levs.sort(key=lambda x: -x["v"])
data["leverage"] = {"top": levs[:8], "netcash": [x for x in levs if x["v"] < 0]}
# margin movers 9M 2026 vs 9M 2025 (operating companies)
mv = []
for g, S in ds.items():
    if S["config"].get("template") == "reit":
        continue
    for t, c in S["companies"].items():
        m = c["ratios"].get("EBITDA_M_U", {})
        a9, b9 = num(m.get("9M2026")), num(m.get("9M2025"))
        if a9 is not None and b9 is not None and abs(a9) < 2 and abs(b9) < 2:
            mv.append({"name": c["name"].split(" (")[0], "d": a9 - b9, "a": a9, "b": b9})
mv.sort(key=lambda x: x["d"])
data["margins"] = {"down": mv[:6], "up": mv[::-1][:5]}
json.dump(data, open(out, "w"), indent=1, default=lambda o: None)
print("deck data ->", out, dict(cnt), len(data["pairs"]), "pairs")
