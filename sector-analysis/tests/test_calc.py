"""Unit tests for calc.py. Numbers here are SYNTHETIC test inputs, not company data."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "build"))
import calc as c

def F(rows):
    return c.Facts.from_rows([dict(ticker=t, period=p, metric_code=m, value_sar_m=v) for t, p, m, v in rows])

def test_growth_and_cagr():
    assert abs(c.growth(110, 100) - 0.10) < 1e-12
    assert c.growth(10, -5) == c.NM
    assert c.growth(None, 5) is None
    assert abs(c.cagr(133.1, 100, 3) - 0.10) < 1e-9
    assert c.cagr(10, -1, 3) == c.NM

def test_matched_growth_contrib_sum():
    f = F([("A","FY2024","REV",100),("A","FY2025","REV",120),
           ("B","FY2024","REV",50),("B","FY2025","REV",45),
           ("C","FY2025","REV",30)])
    r = c.matched_growth(f, ["A","B","C"], "FY2025", "FY2024", "REV")
    assert r["sample"] == ["A","B"] and r["excluded"] == ["C"]
    assert abs(r["growth"] - (165/150-1)) < 1e-12
    assert abs(sum(r["contrib"].values()) - r["growth"]) < 1e-12

def test_ratio_of_totals_not_average():
    f = F([("A","FY2025","OPEX_PRE",30),("A","FY2025","TOI",100),
           ("B","FY2025","OPEX_PRE",30),("B","FY2025","TOI",50)])
    r, s = c.ratio_of_totals(f, ["A","B"], "FY2025", "OPEX_PRE", "TOI")
    assert abs(r - 60/150) < 1e-12           # 40%, not the 45% simple average

def test_roe_annualised():
    f = F([("A","9M2026","NI_ATTR",75),("A","9M2026","EQ_ATTR",1050),("A","FY2025","EQ_ATTR",950),
           ("A","9M2026","T1_SUKUK",50),("A","FY2025","T1_SUKUK",50),("A","9M2026","T1_COST",3)])
    roe = c.bank_roe(f, "A", "9M2026", "FY2025", months=9)
    assert abs(roe - (72*12/9)/((1000+900)/2)) < 1e-12

def test_bridge():
    adj = [dict(bridge_step="perimeter", amount_sar_m=5, basis="disclosed"),
           dict(bridge_step="new_capacity", amount_sar_m=3, basis="calculated")]
    b = c.growth_bridge(120, 100, adj)
    assert abs(b["reported"]-0.20)<1e-12 and abs(b["organic"]-0.15)<1e-12 and abs(b["lfl"]-0.12)<1e-12
    b2 = c.growth_bridge(120, 100, [dict(bridge_step="new_capacity", amount_sar_m=0, basis="not determinable")])
    assert abs(b2["organic"]-0.20)<1e-12 and b2["lfl"] is None and b2["lfl_status"]=="not determinable"
    b3 = c.growth_bridge(120, 100, [dict(bridge_step="perimeter", amount_sar_m=0, basis="not determinable")])
    assert b3["organic"] is None and b3["organic_status"]=="not determinable"

def test_hhi_largest():
    f = F([("A","FY2025","REV",90),("B","FY2025","REV",10)])
    assert abs(c.hhi(f, ["A","B"], "FY2025", "REV") - (8100+100)) < 1e-9
    assert c.largest(f, ["A","B"], "FY2025", "REV") == "A"
