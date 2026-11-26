"""Cross-check the recalculated workbook against the independent Python engine.

Usage: python check_workbook.py <root_dir> <recalculated.xlsx>
Compares sector totals, matched growth, CAGR and ratios-from-totals (Excel
formulas) with dataset.json (Python calc.py). Prints mismatches > 0.05%/0.05pp.
"""
import json
import os
import sys

from openpyxl import load_workbook

root, xlsx = sys.argv[1], sys.argv[2]
ds = json.load(open(os.path.join(root, "data", "dataset.json")))
wb = load_workbook(xlsx, data_only=True)
COLS = {"FY2022": "B", "FY2023": "C", "FY2024": "D", "FY2025": "E", "9M2025": "H", "9M2026": "I"}
GCOLS = {"FY2023/FY2022": "C", "FY2024/FY2023": "D", "FY2025/FY2024": "E", "9M2026/9M2025": "I"}
n_checked = n_bad = 0


def close(a, b, tol):
    global n_checked, n_bad
    n_checked += 1
    if a in (None, "", "n.m.") and b in (None, "", "n.m."):
        return True
    try:
        ok = abs(float(a) - float(b)) <= tol * max(1.0, abs(float(b)))
    except (TypeError, ValueError):
        ok = False
    if not ok:
        n_bad += 1
    return ok


for sector in ("Energy", "Banks"):
    ws = wb[f"{sector}_Sector"]
    d = ds[sector]
    cfg = d["config"]
    # locate block rows by label
    labels = {}
    block = None
    for r in range(1, 120):
        v = ws.cell(row=r, column=1).value
        if isinstance(v, str) and v.startswith("1. Sector totals"):
            block = "all"
        elif isinstance(v, str) and v.startswith("2. Excluding"):
            block = "ex_largest"
        elif isinstance(v, str) and v.startswith("3. "):
            block = None
        if block and isinstance(v, str):
            labels[(block, v.strip())] = r
    for scope in ("all", "ex_largest"):
        for m, lab in ((cfg["top_line"], cfg["top_line_name"]), (cfg["profit"], "Net profit attributable to shareholders")):
            r = labels[(scope, lab)]
            for p, col in COLS.items():
                py = d["sector"][scope][m]["totals"][p]["v"]
                xl = ws[f"{col}{r}"].value
                if not close(xl, py, 1e-6):
                    print(f"MISMATCH {sector} {scope} {m} {p} total: excel={xl} python={py}")
            for pair, col in GCOLS.items():
                py = d["sector"][scope][m]["growth"][pair]["growth"]
                xl = ws[f"{col}{r + 1}"].value
                if not close(xl, py, 5e-4):
                    print(f"MISMATCH {sector} {scope} {m} {pair} growth: excel={xl} python={py}")
            py = d["sector"][scope][m]["growth"]["CAGR_2022_2025"]["cagr"]
            if not close(ws[f"F{r}"].value, py, 5e-4):
                print(f"MISMATCH {sector} {scope} {m} CAGR: excel={ws[f'F{r}'].value} python={py}")
        key = "ratios_all" if scope == "all" else "ratios_ex_largest"
        for rk, spec in cfg["ratios"].items():
            r = labels.get((scope, spec[2]))
            if r is None:
                print("missing ratio row", sector, scope, rk)
                continue
            for p, col in COLS.items():
                py = d["sector"][key][rk][p]["v"]
                if rk == "COR" and isinstance(py, (int, float)):
                    py = py * 10000   # the workbook shows cost of risk in basis points
                xl = ws[f"{col}{r}"].value
                if not close(xl, py, 5e-4):
                    print(f"MISMATCH {sector} {scope} ratio {rk} {p}: excel={xl} python={py}")
print(f"checked {n_checked} values; mismatches {n_bad}")
