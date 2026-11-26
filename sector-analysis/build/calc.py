"""Calculation engine for the sector analysis.

Pure functions over a tidy facts table (one row per ticker x period x metric).
It is used to build the HTML data and to cross-check the Excel formulas
independently. All rules follow METHODOLOGY.md.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable

NM = "n.m."   # not meaningful (non-positive base or sign change)
NA = None     # missing input


def _ok(x) -> bool:
    return x is not None and not (isinstance(x, float) and math.isnan(x))


def growth(cur, prior):
    """YoY growth as a fraction; n.m. if prior <= 0 or the sign changes; None if either side is missing."""
    if not (_ok(cur) and _ok(prior)):
        return NA
    if prior <= 0 or cur < 0:
        return NM   # non-positive base or a change of sign (profit to loss) is not meaningful
    return cur / prior - 1.0


def cagr(end, start, years: int):
    if not (_ok(end) and _ok(start)):
        return NA
    if start <= 0 or end <= 0:
        return NM
    return (end / start) ** (1.0 / years) - 1.0


def safe_div(n, d):
    if not (_ok(n) and _ok(d)) or d == 0:
        return NA
    return n / d


def avg2(a, b):
    if not (_ok(a) and _ok(b)):
        return NA
    return (a + b) / 2.0


def annualise(value, months: int):
    if not _ok(value):
        return NA
    return value * 12.0 / months


@dataclass
class Facts:
    """Index of values: (ticker, period, metric) -> value in SAR m (or KPI unit)."""
    values: dict = field(default_factory=dict)
    meta: dict = field(default_factory=dict)   # (ticker, period, metric) -> row dict

    @classmethod
    def from_rows(cls, rows: Iterable[dict]):
        f = cls()
        for r in rows:
            v = r.get("value_sar_m")
            if v in ("", None):
                continue
            key = (r["ticker"], r["period"], r["metric_code"])
            if key in f.values:
                raise ValueError(f"duplicate fact {key}")
            f.values[key] = float(v)
            f.meta[key] = r
        return f

    def get(self, ticker, period, metric):
        return self.values.get((ticker, period, metric))


# ---------------------------------------------------------------- sector maths

def sector_total(facts: Facts, tickers, period, metric):
    """Sum over tickers that have the value; returns (total, n_included, missing_list)."""
    tot, n, missing = 0.0, 0, []
    for t in tickers:
        v = facts.get(t, period, metric)
        if _ok(v):
            tot += v
            n += 1
        else:
            missing.append(t)
    return (tot if n else NA), n, missing


def matched_growth(facts: Facts, tickers, cur_p, prior_p, metric):
    """Sector growth on a matched sample (companies with both periods).

    Returns dict with growth, totals, the sample and per-company contributions
    (pp of the prior matched total), which sum to the sector growth.
    """
    sample = [t for t in tickers
              if _ok(facts.get(t, cur_p, metric)) and _ok(facts.get(t, prior_p, metric))]
    cur = sum(facts.get(t, cur_p, metric) for t in sample) if sample else NA
    pri = sum(facts.get(t, prior_p, metric) for t in sample) if sample else NA
    g = growth(cur, pri)
    contrib = {}
    if _ok(pri) and pri > 0:
        for t in sample:
            contrib[t] = (facts.get(t, cur_p, metric) - facts.get(t, prior_p, metric)) / pri
    return {"growth": g, "cur": cur, "prior": pri, "sample": sample,
            "excluded": [t for t in tickers if t not in sample], "contrib": contrib}


def shares(facts: Facts, tickers, period, metric):
    tot, _, _ = sector_total(facts, tickers, period, metric)
    out = {}
    for t in tickers:
        v = facts.get(t, period, metric)
        out[t] = safe_div(v, tot) if _ok(v) else NA
    return out


def hhi(facts: Facts, tickers, period, metric):
    """Herfindahl index (0-10,000) on positive values only."""
    vals = [facts.get(t, period, metric) for t in tickers]
    vals = [v for v in vals if _ok(v) and v > 0]
    s = sum(vals)
    if not s:
        return NA
    return sum((v / s * 100) ** 2 for v in vals)


def largest(facts: Facts, tickers, period, metric):
    best, bv = None, None
    for t in tickers:
        v = facts.get(t, period, metric)
        if _ok(v) and (bv is None or v > bv):
            best, bv = t, v
    return best


def ratio_of_totals(facts: Facts, tickers, period, num_metric, den_metric):
    """Sector ratio from summed numerator/denominator over companies having BOTH."""
    sample = [t for t in tickers
              if _ok(facts.get(t, period, num_metric)) and _ok(facts.get(t, period, den_metric))]
    if not sample:
        return NA, []
    n = sum(facts.get(t, period, num_metric) for t in sample)
    d = sum(facts.get(t, period, den_metric) for t in sample)
    return safe_div(n, d), sample


# ------------------------------------------------------------- bank ratios

def bank_roe(facts: Facts, t, period, opening_period, months=12):
    """Comparable ROE: (NI_ATTR - T1_COST) / avg(EQ_ATTR - T1_SUKUK), annualised."""
    ni = facts.get(t, period, "NI_ATTR")
    t1c = facts.get(t, period, "T1_COST") or 0.0
    eq_c = facts.get(t, period, "EQ_ATTR")
    eq_o = facts.get(t, opening_period, "EQ_ATTR")
    s_c = facts.get(t, period, "T1_SUKUK") or 0.0
    s_o = facts.get(t, opening_period, "T1_SUKUK") or 0.0
    if not (_ok(ni) and _ok(eq_c) and _ok(eq_o)):
        return NA
    avg_eq = avg2(eq_c - s_c, eq_o - s_o)
    return safe_div(annualise(ni - t1c, months), avg_eq)


def sector_bank_roe(facts: Facts, tickers, period, opening_period, months=12):
    """Sector ROE from totals over banks with all inputs."""
    num = den = 0.0
    used = []
    for t in tickers:
        ni = facts.get(t, period, "NI_ATTR")
        eq_c = facts.get(t, period, "EQ_ATTR")
        eq_o = facts.get(t, opening_period, "EQ_ATTR")
        if not (_ok(ni) and _ok(eq_c) and _ok(eq_o)):
            continue
        t1c = facts.get(t, period, "T1_COST") or 0.0
        s_c = facts.get(t, period, "T1_SUKUK") or 0.0
        s_o = facts.get(t, opening_period, "T1_SUKUK") or 0.0
        num += annualise(ni - t1c, months)
        den += avg2(eq_c - s_c, eq_o - s_o)
        used.append(t)
    return (safe_div(num, den) if used else NA), used


# ------------------------------------------------------------- growth bridge

BRIDGE_ORDER = ["perimeter", "fx", "hyperinflation", "accounting_other", "new_capacity"]


def growth_bridge(rev_cur, rev_prior, adjustments: list[dict]):
    """Bridge reported growth to organic and LFL growth.

    adjustments: dicts with bridge_step, amount_sar_m (contribution to the
    revenue change, + adds to growth), basis ('disclosed'|'calculated'|
    'estimated'|'not determinable').
    Returns the steps in pp of prior revenue, organic and LFL growth. If any
    pre-organic step is not determinable, organic and LFL are not determinable.
    If only new_capacity is not determinable, organic is shown and LFL is not.
    """
    rep = growth(rev_cur, rev_prior)
    out = {"reported": rep, "steps": {}, "organic": NA, "lfl": NA,
           "organic_status": "ok", "lfl_status": "ok"}
    if rep in (NA, NM):
        out["organic_status"] = out["lfl_status"] = "n.m." if rep == NM else "missing"
        return out
    pp = {}
    nd = set()
    for a in adjustments:
        step = a["bridge_step"]
        if step not in BRIDGE_ORDER:
            continue
        if a.get("basis") == "not determinable":
            nd.add(step)
            continue
        pp[step] = pp.get(step, 0.0) + float(a["amount_sar_m"]) / rev_prior
    out["steps"] = pp
    pre = [s for s in BRIDGE_ORDER if s != "new_capacity"]
    if any(s in nd for s in pre):
        out["organic_status"] = out["lfl_status"] = "not determinable"
        return out
    organic = rep - sum(pp.get(s, 0.0) for s in pre)
    out["organic"] = organic
    if "new_capacity" in nd:
        out["lfl_status"] = "not determinable"
        return out
    out["lfl"] = organic - pp.get("new_capacity", 0.0)
    return out
