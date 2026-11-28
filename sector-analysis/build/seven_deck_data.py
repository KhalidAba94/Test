"""Collect every figure the SEVEN deck shows, from the confirmed dataset.

The "v4" block adds derived views that are not in the workbook: a 2026 estimate (2026E = Jan-Sep 2026 actual +
Oct-Dec 2025 grown at the company's Jan-Sep 2026 revenue growth), revenue CAGRs to 2026E, like-for-like growth
after disclosed acquisitions, disposals and basis changes, and 2022-to-2026 aggregates. Method notes travel with the data.

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
               "rev25": sv(c, top, "FY2025"),
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

# ---------------------------------------------------------------- v4: consistent 2022 -> 2026 view (derived)
import glob
SHORT = set()
for f in glob.glob(os.path.join(root, "data", "seven_*", "facts.csv")):
    for r in csv.DictReader(open(f, encoding="utf-8")):
        pm = str(r.get("period_months") or "").strip()
        if r["period"].startswith("FY") and pm not in ("", "0", "0.0", "12", "12.0"):
            SHORT.add((r["ticker"], r["period"]))
for g0, S0 in ds.items():
    for t0, c0 in S0["config"]["constituents"].items():
        for p0 in (c0.get("exclude_from_totals") or {}):
            SHORT.add((t0, p0))
YEARS = ["FY2022", "FY2023", "FY2024", "FY2025", "2026E"]
CMP = {"FY2023": "FY2023/FY2022", "FY2024": "FY2024/FY2023", "FY2025": "FY2025/FY2024", "2026E": "9M2026/9M2025"}


def amt_ident(t, comp):
    """revenue change from acquisitions, disposals, hyperinflation and basis changes that the filings quantify"""
    return sum(float(r["amount_sar_m"]) for r in A[(t, comp)] if r["bridge_step"] != "new_capacity" and r["amount_sar_m"] not in ("", None))


def undisclosed(t, comp):
    """an acquisition, disposal or basis change whose revenue effect is not disclosed"""
    return any(r["bridge_step"] in ("perimeter", "accounting_other") and r["basis"] == "not determinable" for r in A[(t, comp)])


def flow26(c, m, top):
    a, b, f = sv(c, m, "9M2026"), sv(c, m, "9M2025"), sv(c, m, "FY2025")
    r26, r25 = sv(c, top, "9M2026"), sv(c, top, "9M2025")
    if None in (a, b, f, r26, r25) or not r25:
        return None
    return a + (f - b) * r26 / r25


def series(g, t):
    S = ds[g]; c = S["companies"][t]; top = S["config"]["top_line"]
    v = {p: sv(c, top, p) for p in ("FY2022", "FY2023", "FY2024", "FY2025", "9M2025", "9M2026")}
    for p in ("FY2022", "FY2023", "FY2024", "FY2025"):
        if (t, p) in SHORT:
            v[p] = None
    v["2026E"] = flow26(c, top, top)
    am = {y: amt_ident(t, CMP[y]) for y in ("FY2023", "FY2024", "FY2025")}
    am["2026E"] = (v["FY2025"] * amt_ident(t, CMP["2026E"]) / v["9M2025"]) if v["2026E"] and v["FY2025"] and v["9M2025"] else 0.0
    am["9M"] = amt_ident(t, CMP["2026E"])
    return v, am


def step(mem, cur, pri, am_key=None):
    """matched-sample growth (reported, like-for-like) with coverage and the revenue share with undisclosed deals"""
    base = {t: (series(g, t)[0]["FY2025"] or 0) for g, t in mem}
    tot = sum(base.values())
    sc = sp = sa = cov = und = 0.0
    for g, t in mem:
        v, am = series(g, t)
        if v[cur] is None or v[pri] is None:
            continue
        sc += v[cur]; sp += v[pri]; sa += am[am_key or cur]; cov += base[t]
        if undisclosed(t, CMP["2026E" if cur in ("2026E", "9M2026") else cur]):
            und += v[cur]
    if not sp or not tot or cov / tot < 0.75:
        return {"rep": None, "lfl": None, "flag": "n.a."}
    share = und / sc
    flag = "n.d." if share > 0.5 else ("‡" if share > 0.25 else "")
    return {"rep": sc / sp - 1, "lfl": None if flag == "n.d." else (sc - sa) / sp - 1, "flag": flag, "und_share": share}


def chain(mem):
    st = {YEARS[i]: step(mem, YEARS[i], YEARS[i - 1]) for i in range(1, 5)}
    st["9M"] = step(mem, "9M2026", "9M2025", am_key="9M")
    start = next((i for i in range(1, 5) if st[YEARS[i]]["rep"] is not None), None)
    idx, idx_l, r_, l_, lok, flags = {YEARS[start - 1]: 100.0}, {YEARS[start - 1]: 100.0}, 100.0, 100.0, True, set()
    last = YEARS[start - 1]
    for i in range(start, 5):
        x = st[YEARS[i]]
        if x["rep"] is None:
            break
        r_ *= 1 + x["rep"]; idx[YEARS[i]] = round(r_, 2); last = YEARS[i]
        if x["lfl"] is None:
            lok = False
        else:
            l_ *= 1 + x["lfl"]; idx_l[YEARS[i]] = round(l_, 2); flags.add(x["flag"])
    b = YEARS[start - 1]; n = YEARS.index(last) - YEARS.index(b)
    return {"steps": st, "base": b, "end": last, "idx": idx, "cagr": (r_ / 100) ** (1 / n) - 1,
            "cagr_lfl": ((l_ / 100) ** (1 / n) - 1) if lok else None, "lfl_flag": "n.d." if not lok else ("‡" if "‡" in flags else "")}


v4 = {"groups": {}, "companies": {}, "method": {
    "2026E": "Jan-Sep 2026 actual + Oct-Dec 2025 grown at the company's Jan-Sep 2026 revenue growth (our estimate).",
    "lfl": "Reported growth less the acquisitions, disposals, hyperinflation and basis changes that the filings quantify; "
           "n.d. where companies with undisclosed deals hold over half of the revenue, flagged where they hold over a quarter."}}
GROUPS = list(ds.keys())
for g in GROUPS + ["ALL"]:
    mem = [(g, t) for t in ds[g]["tickers"]] if g != "ALL" else [(gg, t) for gg in GROUPS for t in ds[gg]["tickers"]]
    v4["groups"][g] = chain(mem)
for g in GROUPS:
    for t in ds[g]["tickers"]:
        v, _ = series(g, t)
        ys = [y for y in YEARS if v.get(y)]
        b = next((y for y in YEARS[:4] if v.get(y)), None)
        e = "2026E" if v.get("2026E") else ("FY2025" if v.get("FY2025") else None)
        n = YEARS.index(e) - YEARS.index(b) if b and e else 0
        v4["companies"][t] = {"cagr": (v[e] / v[b]) ** (1 / n) - 1 if n > 0 else None, "base": b, "end": e, "rev26e": v.get("2026E")}
# counts and aggregates, FY2022 -> 2026
rv = [0, 0]; pr = [0, 0]; E = [0.0] * 4; N = [0.0] * 4
for g in GROUPS:
    S = ds[g]; top = S["config"]["top_line"]
    for t in S["tickers"]:
        c = S["companies"][t]
        if (t, "FY2022") in SHORT:
            continue
        r22, r26 = sv(c, top, "FY2022"), flow26(c, top, top)
        if r22 and r26:
            rv[1] += 1; rv[0] += r26 > r22
        n22, n26 = sv(c, "NI_ATTR", "FY2022"), flow26(c, "NI_ATTR", top)
        if n22 is not None and n26 is not None:
            pr[1] += 1; pr[0] += n26 > n22
        if S["config"].get("template") == "reit":
            continue
        e22, e9, r9 = sv(c, "EBITDA_U", "FY2022"), sv(c, "EBITDA_U", "9M2026"), sv(c, top, "9M2026")
        if None not in (e22, r22, e9, r9):
            E[0] += e22; E[1] += r22; E[2] += e9; E[3] += r9
        nd22, nd9, ec22, ec9 = sv(c, "NET_DEBT", "FY2022"), sv(c, "NET_DEBT", "9M2026"), sv(c, "EBITDA_C", "FY2022"), sv(c, "EBITDA_C", "9M2026")
        if None not in (nd22, nd9, ec22, ec9):
            N[0] += nd22; N[1] += ec22; N[2] += nd9; N[3] += ec9 * 12 / 9
v4["six"] = {"rev_up": rv[0], "rev_n": rv[1], "ni_up": pr[0], "ni_n": pr[1],
             "margin22": E[0] / E[1], "margin9m26": E[2] / E[3], "lev22": N[0] / N[1], "lev9m26": N[2] / N[3]}
# group margins and leverage, first full year -> Jan-Sep 2026 / 30 Sep 2026 (from the workbook's group ratios)
gm = {}
for g in GROUPS:
    ra = ds[g]["sector"]["ratios_all"]; reit = ds[g]["config"].get("template") == "reit"
    mk, lk = ("FFO_M", "LTV") if reit else ("EBITDA_M_U", "ND_EBITDA")
    def first(k):
        return next(((p, num(ra.get(k, {}).get(p, {}).get("v"))) for p in ("FY2022", "FY2023", "FY2024") if num(ra.get(k, {}).get(p, {}).get("v")) is not None), (None, None))
    def last(k):
        return next(((p, num(ra.get(k, {}).get(p, {}).get("v"))) for p in ("9M2026", "FY2025") if num(ra.get(k, {}).get(p, {}).get("v")) is not None), (None, None))
    gm[g] = {"m_from": first(mk), "m_to": last(mk), "l_from": first(lk), "l_to": last(lk), "kind": "FFO/LTV" if reit else "EBITDA/ND"}
v4["group_ratios"] = gm
v4["six"]["margin_lower_groups"] = sum(1 for g in GROUPS if gm[g]["m_to"][1] is not None and gm[g]["m_from"][1] is not None and gm[g]["m_to"][1] < gm[g]["m_from"][1])
data["v4"] = v4
json.dump(data, open(out, "w"), indent=1, default=lambda o: None)
print("deck data ->", out, dict(cnt), len(data["pairs"]), "pairs")
