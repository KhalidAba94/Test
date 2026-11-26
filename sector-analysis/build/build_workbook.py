"""Build the Excel workbook (live formulas tracing to the Data sheet).

Usage: python build_workbook.py <root_dir> <out.xlsx>

Conventions: blue = hard-coded inputs (Data, Adjustments), green = links to
another sheet, black = formulas on the sheet. Missing values are blank,
never zero. Partial-year (9M) columns are kept apart from full years.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys

import yaml
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation  # noqa: F401  (kept for template users)

FONT = "Arial"
BLUE, GREEN, BLACK, GREY, RED = "0000FF", "008000", "000000", "808080", "C00000"
HDR_FILL = PatternFill("solid", fgColor="1F3864")
SUB_FILL = PatternFill("solid", fgColor="D9E1F2")
YTD_FILL = PatternFill("solid", fgColor="FFF2CC")
OPEN_FILL = PatternFill("solid", fgColor="EDEDED")
NOTE_FILL = PatternFill("solid", fgColor="F2F2F2")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)

FY = ["FY2022", "FY2023", "FY2024", "FY2025"]
YTD = ["9M2025", "9M2026"]
PAIRS = [("FY2023", "FY2022"), ("FY2024", "FY2023"), ("FY2025", "FY2024"), ("9M2026", "9M2025")]
NUM = '#,##0.0;(#,##0.0);0.0'   # one decimal (methodology); a true zero shows 0.0, a missing figure stays blank
NUM1 = '#,##0.0;(#,##0.0);0.0'
PCT = '0.0%;(0.0%);0.0%'
PCT2 = '0.00%;(0.00%);0.00%'   # ROA and margin on assets need two decimals
BP = '0" bp";(0" bp");"0 bp"'   # cost of risk in basis points (value x 10,000), as on the HTML page
XF = '0.0"x";(0.0"x");0.0"x"'          # multiples (net debt / EBITDA)
PP = '+0.0" pp";-0.0" pp";"0.0 pp"'

NAMES = {}


def f(bold=False, color=BLACK, size=10, italic=False, underline=None):
    return Font(name=FONT, bold=bold, color=color, size=size, italic=italic, underline=underline)


def load_csv(path):
    if not os.path.exists(path):
        return []
    return list(csv.DictReader(open(path, encoding="utf-8")))


def load_yaml(path):
    if not os.path.exists(path):
        return {}
    return yaml.safe_load(open(path, encoding="utf-8")) or {}


def title(ws, text, sub=None):
    ws["A1"] = text
    ws["A1"].font = f(True, "1F3864", 14)
    if sub:
        ws["A2"] = sub
        ws["A2"].font = f(False, GREY, 9, italic=True)
    ws["A3"] = "◀ Contents"
    ws["A3"].hyperlink = "#Contents!A1"
    ws["A3"].font = f(color="0563C1", underline="single", size=9)


def header_row(ws, row, values, start_col=1, fill=HDR_FILL, color="FFFFFF"):
    for i, v in enumerate(values):
        c = ws.cell(row=row, column=start_col + i, value=v)
        c.font = f(True, color, 9)
        c.fill = fill
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BOX


def section(ws, row, text, ncols=12):
    c = ws.cell(row=row, column=1, value=text)
    c.font = f(True, "1F3864", 11)
    for col in range(1, ncols + 1):
        ws.cell(row=row, column=col).fill = SUB_FILL
    return row + 1


def para(ws, row, text, ncols=12, height=None, bold=False, color=BLACK, fill=None):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
    c = ws.cell(row=row, column=1, value=text)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    c.font = f(bold, color, 9)
    if fill:
        c.fill = fill
    if height is None:
        height = max(15, 13 * (len(str(text)) // 150 + 1))
    ws.row_dimensions[row].height = height
    return row + 1


def lookup(key):
    # a fact row with an empty value must stay blank (INDEX of an empty cell would return 0)
    return f'=IFERROR(IF(INDEX(Data!$G:$G,MATCH("{key}",Data!$A:$A,0))="","",INDEX(Data!$G:$G,MATCH("{key}",Data!$A:$A,0))),"")'


def growth_formula(cur, pri):
    return f'=IF(AND(ISNUMBER({cur}),ISNUMBER({pri})),IF(AND({pri}>=10,{cur}>=0),{cur}/{pri}-1,"n.m."),"")'


# ---------------------------------------------------------------- sheets

def build_data(wb, facts):
    ws = wb.create_sheet("Data")
    title(ws, "Data: every figure used, with its source", "One row per company x period x metric. Values in SAR million. "
          "Provenance: D = disclosed, R = restated comparative used, C = calculated (formula in 'Location'). Blue = input.")
    cols = ["fact_id", "sector", "ticker", "company", "period", "metric_code", "value_sar_m", "provenance",
            "source_id (archive file)", "location (XBRL row / PDF page / formula)", "PDF checked", "PDF match status",
            "PDF page(s)", "line item label", "originally reported (SAR m)", "original source", "assurance", "note",
            "how traced to the PDF (full trace)", "manual check against the PDF"]
    header_row(ws, 5, cols)
    r = 6
    for x in facts:
        vals = [x["fact_id"], x["sector"], x["ticker"], x["company"], x["period"], x["metric_code"],
                float(x["value_sar_m"]) if x["value_sar_m"] not in ("", None) else None, x["provenance"],
                x["source_id"], x["location"], x.get("pdf_file", ""), x.get("pdf_status", ""), x.get("pdf_pages", ""),
                x.get("line_item_label", ""), float(x["original_value"]) if x.get("original_value") not in ("", None) else None,
                x.get("original_source", ""), x.get("assurance", ""), x.get("note", ""),
                x.get("trace_status", ""), x.get("review", "")]
        for i, v in enumerate(vals, start=1):
            if isinstance(v, str) and v.startswith("="):
                v = "formula: " + v[1:].strip()
            c = ws.cell(row=r, column=i, value=v)
            c.font = f(color=BLUE if i == 7 else BLACK, size=9)
            if i in (7, 15):
                c.number_format = NUM1
        r += 1
    widths = [22, 8, 7, 28, 9, 12, 13, 6, 44, 40, 34, 14, 10, 40, 13, 40, 9, 40, 20, 30]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A6"
    ws.auto_filter.ref = f"A5:{get_column_letter(len(cols))}{r - 1}"
    return ws


TPL = {}   # sector key -> template, from config/sectors.json (set in main)
ORDER = []


def company_rows(sector):
    if TPL.get(sector) == "reit":
        rows = [("REV", "Revenue (rental income)", "val"), ("REV", "  growth YoY", "growth"),
                ("NI_ATTR", "Net income", "val"), ("NI_ATTR", "  growth YoY", "growth"),
                ("FFO", "Funds from operations (FFO)", "val"), ("DIST", "Distributions declared", "val"),
                ("TA", "Total assets (period-end)", "val"), ("DEBT", "Borrowings (period-end)", "val"),
                ("CASH", "Cash and cash equivalents (period-end)", "val"), ("ST_DEP", "Short-term bank deposits (period-end)", "val"),
                ("NET_DEBT", "Net debt (C; negative = net cash)", "val"),
                ("EQ_ATTR", "Net assets attributable to unitholders (book, period-end)", "val"),
                ("NAV_FV", "Net assets at fair value (period-end)", "val")]
        ratios = [("Net margin", "NI_ATTR", "REV_M", False), ("FFO margin", "FFO", "REV_M", False),
                  ("Loan to value (borrowings / total assets)", "DEBT", "TA", False),
                  ("Return on net assets (YTD annualised)", "NI_ATTR", "EQ_ATTR", True), ("Distributions / FFO", "DIST", "FFO", False)]
        return rows, ratios
    if TPL.get(sector) == "corporate":
        rows = [("REV", "Revenue", "val"), ("REV", "  growth YoY", "growth"), ("OIRS", "Other income related to sales*", "val"),
                ("REV_M", "Revenue incl. other income related to sales (margin base)*", "val"), ("GP", "Gross profit", "val"),
                ("OPINC", "Operating income (calculated, one definition)", "val"), ("EBITDA_C", "EBITDA (calculated)", "val"),
                ("EBITDA_U", "EBITDA excl. identified one-offs", "val"),
                ("NI_ATTR", "Net profit attributable to shareholders", "val"), ("NI_ATTR", "  growth YoY", "growth"),
                ("CFO", "Operating cash flow", "val"), ("CAPEX", "Capex", "val"), ("FCF", "Free cash flow (C)", "val"),
                ("TA", "Total assets (period-end)", "val"), ("EQ_ATTR", "Equity attributable (period-end)", "val")]
        ratios = [("EBITDA margin", "EBITDA_C", "REV_M", False), ("EBITDA margin excl. one-offs", "EBITDA_U", "REV_M", False),
                  ("Operating margin", "OPINC", "REV_M", False),
                  ("Net margin", "NI_ATTR", "REV_M", False), ("ROE (YTD annualised)", "NI_ATTR", "EQ_ATTR", True),
                  ("Capex / revenue", "CAPEX", "REV_M", False)]
        if sector != "Energy":
            # other corporate sectors: no Aramco-style other income related to sales; add the balance-sheet funding lines
            rows = [x for x in rows if x[0] not in ("OIRS", "REV_M")]
            i = rows.index(("TA", "Total assets (period-end)", "val"))
            rows[i:i] = [("DEBT", "Borrowings (period-end)", "val"), ("LEASE_LIAB", "Lease liabilities (period-end)", "val"),
                         ("CASH", "Cash and cash equivalents (period-end)", "val"),
                         ("ST_DEP", "Short-term bank deposits (period-end)", "val"), ("NET_DEBT", "Net debt (C; negative = net cash)", "val")]
            j = rows.index(("CAPEX", "Capex", "val"))
            rows[j + 1:j + 1] = [("IP_CAPEX", "Investment-property spend", "val"), ("CAPEX_TOT", "Capex incl. investment property (C)", "val")]
            ratios = ratios + [("Net debt / EBITDA (x; 9M EBITDA annualised)", "NET_DEBT", "EBITDA_C", "ann")]
    else:
        rows = [("TOI", "Total operating income (TOI)", "val"), ("TOI", "  growth YoY", "growth"),
                ("NSCI", "Net special commission / financing income", "val"), ("FEES_NET", "Net fee & commission income", "val"),
                ("OTHER_OI", "Other operating income (C)", "val"), ("OPEX_PRE", "Operating expenses before impairment", "val"),
                ("PPOP", "Pre-provision operating profit (C)", "val"), ("IMPAIR_TOTAL", "Impairment charges (total)", "val"),
                ("IMPAIR_FIN", "  credit-loss line on the income statement", "val"), ("ECL_LOANS", "  ECL on loans and financing (note basis)", "val"), ("NI_ATTR", "Net profit attributable to shareholders", "val"),
                ("NI_ATTR", "  growth YoY", "growth"), ("TA", "Total assets (period-end)", "val"),
                ("LOANS", "Net financing (period-end)", "val"), ("DEPOSITS", "Customer deposits (period-end)", "val"),
                ("EQ_ATTR", "Equity attributable incl. Tier 1 sukuk", "val"), ("T1_SUKUK", "Tier 1 sukuk (period-end)", "val"),
                ("T1_COST", "Tier 1 sukuk distributions", "val"), ("EQ_ORD", "Ordinary equity (C)", "val")]
        ratios = [("Cost-to-income", "OPEX_PRE", "TOI", False), ("ROE on ordinary equity (YTD annualised)", "NI_ATTR-T1_COST", "EQ_ORD", True),
                  ("ROA (YTD annualised)", "NI_ATTR", "TA", True), ("Cost of risk, bp (ECL on loans; YTD annualised)", "ECL_LOANS", "LOANS", True),
                  ("NSCI / avg assets (YTD annualised)", "NSCI", "TA", True), ("Net fees / TOI", "FEES_NET", "TOI", False),
                  ("Loans / deposits", "LOANS", "DEPOSITS", False)]
    return rows, ratios


PCOL = {"FY2021": "B", "FY2022": "C", "FY2023": "D", "FY2024": "E", "FY2025": "F", "9M2025": "I", "9M2026": "J"}
OPENING = {"FY2022": "FY2021", "FY2023": "FY2022", "FY2024": "FY2023", "FY2025": "FY2024", "9M2025": "FY2024", "9M2026": "FY2025"}


RK_OF = {}
UNIT = ["sector"]   # "group" for sets whose groups are not exchange sectors (guide: group_word)


def build_overview(wb, ds, comp_sheets):
    """One row per company: size, growth, margins, returns and leverage side by side (values from the dataset that
    the company sheets reproduce with formulas)."""
    ws = wb.create_sheet("Overview", 2)
    title(ws, "Overview: all companies side by side (FY2025 and 9M 2026)",
          "Values as on each company sheet (click a name to open it). Operating companies show EBITDA margin and net debt / EBITDA; REITs show FFO margin "
          "and loan to value instead. n.m. = not meaningful (see How_to_read); blank = not available. 9M 2026 is compared only with 9M 2025.")
    cols = ["Group", "Company", "Ticker", "Revenue FY2025 (SAR m)", "Revenue growth FY2025", "Revenue CAGR 2022–25", "EBITDA margin FY2025 (REIT: FFO margin)",
            "Net margin FY2025", "ROE FY2025", "Net debt / EBITDA FY2025 (REIT: LTV)", "Net profit FY2025 (SAR m)",
            "Revenue growth 9M 2026", "Net profit 9M 2026 (SAR m)", "Net profit growth 9M 2026"]
    header_row(ws, 5, cols)
    r = 6
    for sector, S in ds.items():
        reit = S["config"].get("template") == "reit"
        for t in S["tickers"]:
            c = S["companies"][t]
            ser, g, ra = c["series"], c["growth"], c["ratios"]
            def sv(m, p):
                return (ser.get(m, {}).get(p) or {}).get("v")
            vals = [S["config"].get("name", sector), c["name"], t, sv("REV", "FY2025"), g.get("REV", {}).get("FY2025/FY2024"),
                    g.get("REV", {}).get("CAGR_2022_2025"), ra.get("FFO_M" if reit else "EBITDA_M", {}).get("FY2025"),
                    ra.get("NET_M", {}).get("FY2025"), ra.get("ROE", {}).get("FY2025"), ra.get("LTV" if reit else "ND_EBITDA", {}).get("FY2025"),
                    sv("NI_ATTR", "FY2025"), g.get("REV", {}).get("9M2026/9M2025"), sv("NI_ATTR", "9M2026"), g.get("NI_ATTR", {}).get("9M2026/9M2025")]
            fmts = [None, None, None, NUM, PCT, PCT, PCT, PCT, PCT, (PCT if reit else XF), NUM, PCT, NUM, PCT]
            for i, (v, fm) in enumerate(zip(vals, fmts), start=1):
                cell = ws.cell(row=r, column=i, value=v)
                cell.font = f(size=9)
                if fm and isinstance(v, (int, float)):
                    cell.number_format = fm
            ws.cell(row=r, column=2).hyperlink = f"#'{comp_sheets[t]}'!A1"
            ws.cell(row=r, column=2).font = f(color="0563C1", underline="single", size=9)
            r += 1
    for i, w in enumerate([22, 30, 8, 14, 12, 12, 14, 11, 11, 14, 13, 12, 13, 12], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "D6"
    ws.auto_filter.ref = f"A5:{get_column_letter(len(cols))}{r - 1}"
    return ws


def build_company(wb, sector, t, cfg, ds, narr, adj_rows, facts_idx, sheetname, sector_sheet):
    ws = wb.create_sheet(sheetname)
    cinfo = ds["companies"][t]
    top = cfg["top_line"]
    yl = cfg.get("ytd_label", "9M")   # REIT group: H1 (half-yearly fund reports)
    fy_end = (facts_idx.get((t, "FY2025", top)) or {}).get("period_end", "") or "2025-12-31"
    ytd_m = {p: int(float((facts_idx.get((t, p, top)) or {}).get("period_months") or 9)) for p in ("9M2025", "9M2026")}
    # true length of every period column: 9M slots as above; a short financial year (e.g. a 9-month transition year) is annualised too
    pmon = dict(ytd_m, **{p: int(float((facts_idx.get((t, p, top)) or {}).get("period_months") or 12)) for p in ("FY2022", "FY2023", "FY2024", "FY2025")})
    MON = {"03": "31 Mar", "06": "30 Jun", "07": "31 Jul", "09": "30 Sep", "12": "31 Dec"}
    fye_txt = MON.get(fy_end[5:7], fy_end[5:])
    ytd_txt = ("2026 YTD = 9M (1 Jan–30 Sep 2026) vs 9M 2025" if ytd_m["9M2026"] == 9 else
               "2026 YTD = H1 (1 Jan–30 Jun 2026) vs H1 2025 (half-yearly fund reports)" if ytd_m["9M2026"] == 6 and yl == "H1" else
               f"2026 YTD column = the {ytd_m['9M2026']} months to 30 Sep 2026 (fiscal year ends {fye_txt}; FY columns = fiscal years shown under the calendar year holding most of their months); left out of sector 9M totals")
    title(ws, f'{cinfo["name"]} ({t}) · {cfg.get("name", sector)} · {cinfo["sub_industry"]}',
          f'Legal name in filings: {cinfo["legal_name"]} · Year-end {fye_txt} · SAR million unless stated · '
          f'{ytd_txt}, never compared with full years.')
    c = ws["C3"]; c.value = f"◀ {sector} {UNIT[0]}"; c.hyperlink = f"#'{sector_sheet}'!A1"; c.font = f(color="0563C1", underline="single", size=9)
    ws.column_dimensions["A"].width = 46
    for col in "BCDEFGIJK":
        ws.column_dimensions[col].width = 12
    ws.column_dimensions["H"].width = 2
    ws.column_dimensions["L"].width = 60
    r = 5
    r = section(ws, r, "A. Annual trends and comparable 2026 YTD (SAR m)")
    ccfg = cfg["constituents"].get(t, {})
    pl = ccfg.get("period_labels", {})   # short or non-calendar years are labelled in the column header
    hdr = [pl.get("FY2021", "FY2021 (opening)")] + [pl.get(p, p if pmon.get(p, 12) == 12 else f"{p} ({pmon[p]}m)") for p in ("FY2022", "FY2023", "FY2024", "FY2025")]
    header_row(ws, r, ["Metric"] + hdr + ["CAGR 2022–25", "", f"{yl} 2025", f"{yl} 2026", "YTD change", f"Basis / provenance (FY2025 · {yl} 2026)"])
    ws.cell(row=r, column=8).fill = PatternFill(None)
    r += 1
    rows, ratios = company_rows(sector)
    if sector != "Energy" and TPL.get(sector) in ("corporate", "reit"):
        # the company ratios mirror the group sheet's ratio list (config), on revenue (REV_M = REV outside Energy)
        ratios = []
        for rk0, spec in cfg["ratios"].items():
            den = spec[1].replace("avg:", "").replace("ann:", "").replace("REV_M", "REV")
            ratios.append((spec[2], spec[0], den, True if spec[1].startswith("avg:") else ("ann" if spec[1].startswith("ann:") else False)))
            RK_OF[spec[2]] = rk0
    rowmap = {}
    cnotes = ccfg.get("cell_notes", {})
    for code, label, kind in rows:
        has = any((t, p, code) in facts_idx for p in PCOL)
        if not has and code in ("OIRS", "REV_M", "GP", "T1_COST", "T1_SUKUK", "DEBT", "LEASE_LIAB", "CASH", "NET_DEBT", "FFO", "DIST", "NAV_FV",
                                "ST_DEP", "IP_CAPEX", "CAPEX_TOT"):
            continue
        ws.cell(row=r, column=1, value=label).font = f(kind == "val" and not label.startswith("  "), size=9)
        if kind == "val":
            rowmap[code] = r
            for p, col in PCOL.items():
                if p == "FY2021" and code not in ("TA", "EQ_ATTR", "LOANS", "EQ_ORD", "T1_SUKUK", "DEPOSITS", "TE", "CASH", "ST_DEP", "DEBT", "LEASE_LIAB", "NET_DEBT", "NAV_FV"):
                    ws[f"{col}{r}"].fill = OPEN_FILL
                    continue
                cell = ws[f"{col}{r}"]
                cell.value = lookup(f"{t}-{p}-{code}")
                cell.number_format = NUM
                cell.font = f(color=GREEN, size=9)
                if p.startswith("9M"):
                    cell.fill = YTD_FILL
                if p == "FY2021":
                    cell.fill = OPEN_FILL
                fx = facts_idx.get((t, p, code))
                if fx and (fx["provenance"] in ("R", "C") or fx.get("note")):
                    txt = {"R": "Restated comparative used", "C": "Calculated"}.get(fx["provenance"], "")
                    if fx["provenance"] == "R" and fx.get("original_value") not in ("", None):
                        txt += f' (originally {float(fx["original_value"]):,.1f} in {fx["original_source"]})'
                    if fx["provenance"] == "C":
                        txt += f': {fx["location"]}'
                    if fx.get("note"):
                        txt += " " + fx["note"]
                    cell.comment = Comment(txt[:900], "analysis")
            if any(f"{t}|{y}" in ds["sector"].get("short_fy", {}) for y in ("FY2022", "FY2023", "FY2024", "FY2025")):
                ws[f"G{r}"] = "n.m."   # the FY2022–FY2025 span includes a short financial year, so it is not three years
                ws[f"G{r}"].comment = Comment("Not meaningful: FY2022–FY2025 includes a short financial year, so the span is not three years (see the company's data notes).", "analysis")
            else:
                ws[f"G{r}"] = f'=IF(AND(ISNUMBER(F{r}),ISNUMBER(C{r})),IF(AND(C{r}>=10,F{r}>0),(F{r}/C{r})^(1/3)-1,"n.m."),"")'
            ws[f"G{r}"].number_format = PCT
            ws[f"K{r}"] = growth_formula(f"J{r}", f"I{r}")
            ws[f"K{r}"].number_format = PCT
            ws[f"K{r}"].fill = YTD_FILL
            prov = []
            for p in ("FY2025", "9M2026"):
                fx = facts_idx.get((t, p, code))
                if fx:
                    loc = fx.get("pdf_pages") and f'PDF p.{fx["pdf_pages"]}' or fx["location"]
                    prov.append(f'{p}: {fx["provenance"]} · {fx["source_id"].split("/")[-1]} · {loc}')
            ws[f"L{r}"] = " | ".join(prov)
            ws[f"L{r}"].font = f(color=GREY, size=8)
        else:
            vr = rowmap[code]
            for p in ("FY2023", "FY2024", "FY2025"):
                prev = {"FY2023": "FY2022", "FY2024": "FY2023", "FY2025": "FY2024"}[p]
                sf = ds["sector"].get("short_fy", {})
                if f"{t}|{p}" in sf or f"{t}|{prev}" in sf:
                    ws[f"{PCOL[p]}{r}"] = "n.m."   # short financial year after a year-end change
                    ws[f"{PCOL[p]}{r}"].comment = Comment("Not meaningful: one of the two years is a short financial year after a year-end change (see the company's data notes).", "analysis")
                    continue
                ws[f"{PCOL[p]}{r}"] = growth_formula(f"{PCOL[p]}{vr}", f"{PCOL[prev]}{vr}")
                ws[f"{PCOL[p]}{r}"].number_format = PCT
            for col in "CDEFGIJK":
                ws[f"{col}{r}"].font = f(italic=True, size=9)
        r += 1
    r += 1
    ws.cell(row=r, column=1, value="Ratios (calculated from the rows above; averages = (opening + closing) ÷ 2)").font = f(True, size=9)
    r += 1
    for label, num, den, avg in ratios:
        if "-" in num:
            a, b = num.split("-")
            if a not in rowmap:
                continue
            numexpr = lambda col, a=a, b=b: (f"({col}{rowmap[a]}-N({col}{rowmap[b]}))" if b in rowmap else f"{col}{rowmap[a]}")
        else:
            if num not in rowmap:
                continue
            numexpr = lambda col, num=num: f"{col}{rowmap[num]}"
        if den not in rowmap:
            continue
        ws.cell(row=r, column=1, value=label).font = f(size=9)
        for p in ["FY2022", "FY2023", "FY2024", "FY2025", "9M2025", "9M2026"]:
            col = PCOL[p]
            n = numexpr(col)
            ann = f"*12/{pmon[p]}" if pmon[p] != 12 and avg is True else ""
            if avg == "ann":
                d = f"({col}{rowmap[den]}" + (f"*12/{pmon[p]})" if pmon[p] != 12 else ")")
                cond = f"AND(ISNUMBER({col}{rowmap[den]}),ISNUMBER({col}{rowmap[num]}))"
                ws[f"{col}{r}"] = f'=IF({cond},IF({d}>=10,{n}/{d},"n.m."),"")'
                ws[f"{col}{r}"].number_format = XF
                ws[f"{col}{r}"].font = f(size=9)
                if p.startswith("9M"):
                    ws[f"{col}{r}"].fill = YTD_FILL
                continue
            if avg:
                oc = PCOL[OPENING[p]]
                d = f"AVERAGE({col}{rowmap[den]},{oc}{rowmap[den]})"
                cond = f"AND(ISNUMBER({col}{rowmap[den]}),ISNUMBER({oc}{rowmap[den]}),ISNUMBER({col}{rowmap[num.split('-')[0]]}))"
            else:
                d = f"{col}{rowmap[den]}"
                cond = f"AND(ISNUMBER({col}{rowmap[den]}),ISNUMBER({col}{rowmap[num.split('-')[0]]}))"
            if den == "LOANS" and num == "ECL_LOANS":
                ws[f"{col}{r}"] = f'=IF({cond},IF({d}<>0,{n}{ann}/{d}*10000,""),"")'
                ws[f"{col}{r}"].number_format = BP
                ws[f"{col}{r}"].font = f(size=9)
                if p.startswith("9M"):
                    ws[f"{col}{r}"].fill = YTD_FILL
                continue
            if den in ("REV", "REV_M", "TOI") and not avg:
                ws[f"{col}{r}"] = f'=IF({cond},IF({d}<10,"n.m.",{n}{ann}/{d}),"")'
            elif avg:
                ws[f"{col}{r}"] = f'=IF({cond},IF({d}<=0,"n.m.",{n}{ann}/{d}),"")'
            else:
                ws[f"{col}{r}"] = f'=IF({cond},IF({d}<>0,{n}{ann}/{d},""),"")'
            ws[f"{col}{r}"].number_format = PCT2 if den in ("LOANS", "TA") else PCT
            ws[f"{col}{r}"].font = f(size=9)
            if p.startswith("9M"):
                ws[f"{col}{r}"].fill = YTD_FILL
            note = cnotes.get(f"{RK_OF.get(label, '')}|{p}")
            if note:
                ws[f"{col}{r}"].comment = Comment(note, "analysis")
        # the multiple has its own branch above; attach its notes too
        for p in ["FY2022", "FY2023", "FY2024", "FY2025", "9M2025", "9M2026"]:
            note = cnotes.get(f"{RK_OF.get(label, '')}|{p}")
            if note and avg == "ann":
                ws[f"{PCOL[p]}{r}"].comment = Comment(note, "analysis")
        r += 1
    ws.cell(row=r, column=1, value="* Other income related to sales (Aramco only) is government compensation for regulated domestic prices. It is inside operating income, EBITDA and profit, so margins use revenue plus this income; revenue growth and sector totals use IFRS revenue." if sector == "Energy" else "").font = f(italic=True, color=GREY, size=8)
    r += 2

    # ---------------- B. growth bridge
    r = section(ws, r, f"B. Reported vs like-for-like growth of {cfg['top_line_name'].lower()} (percentage points of prior-period {cfg['top_line_name'].lower()})")
    comps = [f"{a}/{b}" for a, b in PAIRS]
    header_row(ws, r, ["Bridge step", "FY23 vs FY22", "FY24 vs FY23", "FY25 vs FY24", f"{yl}26 vs {yl}25"], start_col=1)
    ws.cell(row=r, column=6, value="Adjustment basis (see Adjustments sheet)").font = f(True, size=9)
    r += 1
    toprow = rowmap.get(top)
    colpairs = [("D", "C"), ("E", "D"), ("F", "E"), ("J", "I")]
    steps = [("perimeter", "Perimeter (acquisitions / disposals)"), ("fx", "FX translation"),
             ("hyperinflation", "Hyperinflation (IAS 29)"), ("accounting_other", "Accounting / presentation / other"),
             ("new_capacity", "New capacity (organic expansion)")]
    rep_row = r
    sfy = ds["sector"].get("short_fy", {})
    short_col = [f"{t}|{a}" in sfy or f"{t}|{b}" in sfy for a, b in PAIRS]   # a comparison across a short year: not meaningful
    def _has(p):
        x = facts_idx.get((t, p, top))
        return bool(x) and x.get("value_sar_m") not in ("", None)
    nodata_col = [not (_has(a) and _has(b)) for a, b in PAIRS]   # no top line in one of the periods: nothing to bridge
    ws.cell(row=r, column=1, value="Reported growth").font = f(True, size=9)
    for i, (cc, pc) in enumerate(colpairs):
        if short_col[i]:
            c = ws.cell(row=r, column=2 + i, value="n.m.")
            c.comment = Comment("Not meaningful: one of the two years is a short financial year, so the periods are not comparable (see the data notes).", "analysis")
            continue
        ws.cell(row=r, column=2 + i, value=growth_formula(f"{cc}{toprow}", f"{pc}{toprow}")).number_format = PCT
    r += 1
    BAS = {"none identified": "none", "not determinable": "n.d.", "disclosed": "disclosed", "calculated": "calculated", "estimated": "estimated"}
    SHORTC = {"FY2023/FY2022": "FY23", "FY2024/FY2023": "FY24", "FY2025/FY2024": "FY25", "9M2026/9M2025": "9M26"}
    step_rows = {}
    for key, label in steps:
        if key == "new_capacity" and TPL.get(sector) == "bank":
            label = "New capacity: not applicable to banks (like-for-like = organic)"
        ws.cell(row=r, column=1, value=f"  less: {label}").font = f(size=9)
        step_rows[key] = r
        bases = []
        for i, comp in enumerate(comps):
            pc = colpairs[i][1]
            if short_col[i]:
                ws.cell(row=r, column=2 + i, value="n.m.")
                continue
            mine = [a for a in adj_rows if a.get("ticker") == t and a.get("comparison") == comp and a.get("bridge_step") == key]
            if not mine and nodata_col[i]:
                continue   # no revenue in one of the two periods (e.g. a REIT fact sheet, a company not yet formed): left blank
            if not mine:
                ws.cell(row=r, column=2 + i, value="not assessed")   # no register entry: never shown as a zero
                bases.append(f"{SHORTC[comp]}: not assessed")
                continue
            bases.append(f"{SHORTC[comp]}: " + "/".join(sorted({BAS.get(a.get('basis', ''), a.get('basis', '')) for a in mine})))
            amt = f'SUMIFS(Adjustments!$F:$F,Adjustments!$B:$B,"{t}",Adjustments!$C:$C,"{comp}",Adjustments!$D:$D,"{key}")'
            nd = f'COUNTIFS(Adjustments!$B:$B,"{t}",Adjustments!$C:$C,"{comp}",Adjustments!$D:$D,"{key}",Adjustments!$G:$G,"not determinable")'
            ws.cell(row=r, column=2 + i, value=f'=IF({nd}>0,"not determinable",IF(AND(ISNUMBER({pc}{toprow}),N({pc}{toprow})>0),{amt}/{pc}{toprow},""))').number_format = PCT
        c = ws.cell(row=r, column=6, value=" · ".join(bases))
        c.font = f(size=8, color=GREY)
        r += 1
    org_row = r
    ws.cell(row=r, column=1, value="Organic growth").font = f(True, size=9)
    for i in range(4):
        col = get_column_letter(2 + i)
        pre = [f"{col}{step_rows[k]}" for k in ("perimeter", "fx", "hyperinflation", "accounting_other")]
        if short_col[i]:
            ws.cell(row=r, column=2 + i, value="n.m.")
            continue
        ws.cell(row=r, column=2 + i, value=f'=IF(NOT(ISNUMBER({col}{rep_row})),IF(ISTEXT({col}{rep_row}),{col}{rep_row},""),IF(OR({",".join(f"ISTEXT({x})" for x in pre)}),"not determinable",{col}{rep_row}-{"-".join(pre)}))').number_format = PCT
    r += 1
    ws.cell(row=r, column=1, value="Like-for-like growth (existing business)").font = f(True, size=9)
    for i in range(4):
        col = get_column_letter(2 + i)
        if short_col[i]:
            ws.cell(row=r, column=2 + i, value="n.m.").fill = SUB_FILL
            continue
        ws.cell(row=r, column=2 + i, value=f'=IF(NOT(ISNUMBER({col}{org_row})),IF({col}{org_row}="n.m.","n.m.",IF(ISTEXT({col}{org_row}),"not determinable","")),IF(ISTEXT({col}{step_rows["new_capacity"]}),"not determinable",{col}{org_row}-{col}{step_rows["new_capacity"]}))').number_format = PCT
        ws.cell(row=r, column=2 + i).fill = SUB_FILL
    r += 1
    lfl = narr.get("lfl_basis", {}) or {}
    for lab, keyn in (("LFL definition used", "definition_used"), ("Price / volume split", "price_volume_support"),
                      ("FX exposure", "fx_exposure"), ("Confidence", "confidence")):
        ws.cell(row=r, column=1, value=lab).font = f(True, size=9)
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=12)
        ws.cell(row=r, column=2, value=str(lfl.get(keyn, "pending")))
        ws.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=r, column=2).font = f(size=9)
        ws.row_dimensions[r].height = max(15, 13 * (len(str(lfl.get(keyn, ""))) // 140 + 1))
        r += 1
    pv = narr.get("price_volume", []) or []
    if pv:
        ws.cell(row=r, column=1, value="Price / volume / rate effects (where supported)").font = f(True, size=9)
        r += 1
        for item in pv:
            r = para(ws, r, f'• {item.get("period", "")}: {item.get("text", "")} [{item.get("basis", "")}; confidence {item.get("confidence", "")}; {item.get("source", "")}]')
    r += 1

    # ---------------- C. profit & margin drivers
    r = section(ws, r, "C. Profit and margin changes, including material one-offs")
    pm = narr.get("profit_and_margin", {}) or {}
    for d in pm.get("drivers", []) or []:
        r = para(ws, r, f'• {d.get("period", "")}: {d.get("driver", "")}  [{d.get("source", "")}]')
    ones = pm.get("one_offs", []) or []
    if ones:
        r = para(ws, r, "Amounts are pre-tax as disclosed. Reported profit is kept: an item is taken out of net profit only where the filing gives its tax or zakat effect and the minority share (column F).")
        header_row(ws, r, ["One-off item", "Period", "Amount SAR m", "P&L line", "Source", "Tax and minority share"], fill=SUB_FILL, color=BLACK)
        r += 1
        for o in ones:
            ws.cell(row=r, column=1, value=o.get("item", "")).font = f(size=9)
            ws.cell(row=r, column=1).alignment = Alignment(wrap_text=True)
            ws.cell(row=r, column=2, value=o.get("period", "")).font = f(size=9)
            amt = o.get("amount_sar_m")
            c = ws.cell(row=r, column=3, value=amt if isinstance(amt, (int, float)) else None)
            c.number_format = NUM1; c.font = f(color=BLUE, size=9)
            ws.cell(row=r, column=4, value=o.get("line", "")).font = f(size=9)
            ws.cell(row=r, column=5, value=o.get("source", "")).font = f(color=GREY, size=8)
            ws.cell(row=r, column=6, value=o.get("tax_nci", "")).font = f(size=8)
            ws.merge_cells(start_row=r, start_column=6, end_row=r, end_column=12)
            ws.cell(row=r, column=6).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = 26 if len(o.get("tax_nci", "") or "") < 90 else 38
            r += 1
    if not pm:
        r = para(ws, r, "Pending.")
    r += 1
    # ---------------- D. developments
    r = section(ws, r, "D. Key developments: operations, capacity, acquisitions, strategy, business mix")
    devs = narr.get("developments", []) or []
    if devs:
        header_row(ws, r, ["Development", "Date", "Category"], fill=SUB_FILL, color=BLACK)
        ws.cell(row=r, column=4, value="Source").font = f(True, size=9)
        r += 1
        for d in devs:
            ws.cell(row=r, column=1, value=d.get("text", "")).font = f(size=9)
            ws.cell(row=r, column=1).alignment = Alignment(wrap_text=True, vertical="top")
            ws.cell(row=r, column=2, value=str(d.get("date", ""))).font = f(size=9)
            ws.cell(row=r, column=3, value=d.get("category", "")).font = f(size=9)
            ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=12)
            ws.cell(row=r, column=4, value=d.get("source", "")).font = f(color=GREY, size=8)
            ws.row_dimensions[r].height = max(26, 13 * (len(d.get("text", "")) // 55 + 1))
            r += 1
    else:
        r = para(ws, r, "Pending.")
    r += 1
    # ---------------- E. what it means
    r = section(ws, r, "E. What it means")
    wim = narr.get("what_it_means", {}) or {}
    for lab in ("improved", "weakened", "why", "uncertain"):
        if wim.get(lab):
            r = para(ws, r, f"{lab.capitalize()}: {wim[lab]}")
    if narr.get("confidence_overall"):
        r = para(ws, r, f'Overall confidence: {narr["confidence_overall"]}', bold=True)
    r += 1
    # ---------------- F. data notes
    r = section(ws, r, "F. Data quality notes for this company")
    for n in narr.get("data_notes", []) or []:
        r = para(ws, r, "• " + n)
    ws.freeze_panes = "B7"
    return ws


def build_sector(wb, sector, cfg, ds, narr, comp_sheets):
    sname = f"{sector}_{UNIT[0].capitalize()}"
    ws = wb.create_sheet(sname, 4 + ORDER.index(sector))
    tickers = ds["tickers"]
    top, prof = cfg["top_line"], cfg["profit"]
    largest = ds["sector"]["largest_by_top_line_FY2025"]
    yl, ym = cfg.get("ytd_label", "9M"), int(cfg.get("ytd_months", 9))
    title(ws, f"{cfg.get('name', sector)} summary, FY2022–FY2025 and {yl} 2026",
          f"SAR million. {UNIT[0].capitalize()} ratios are calculated from summed numerators and denominators, never averaged. "
          f"{UNIT[0].capitalize()} growth uses a matched sample (companies with data in both periods). 9M columns are partial-year and "
          f"compared only with {yl} 2025. Constituents: {len(tickers)} companies. {cfg.get('classification_note', '')}")
    ws.column_dimensions["A"].width = 42
    for col in "BCDEFGHIJKL":
        ws.column_dimensions[col].width = 12
    periods = ["FY2021", "FY2022", "FY2023", "FY2024", "FY2025", "9M2025", "9M2026"]
    pc = {p: get_column_letter(2 + i) for i, p in enumerate(periods)}   # B..H

    # calc block at the bottom: matrices for each needed metric
    needed = {top, prof}
    for rk, spec in cfg["ratios"].items():
        for part in (spec[0], spec[1].replace("avg:", "").replace("ann:", "")):
            for m in part.split("-"):
                needed.add(m)
    needed |= ({"EBITDA_C", "EBITDA_U", "OPINC", "CAPEX", "FCF", "REV_M", "CFO", "NET_DEBT"} if TPL.get(sector) == "corporate" else
               {"FFO", "DIST", "REV_M", "NET_DEBT", "DEBT", "NAV_FV"} if TPL.get(sector) == "reit" else {"NSCI", "FEES_NET", "OPEX_PRE", "IMPAIR_TOTAL", "PPOP"})
    if TPL.get(sector) == "corporate" and "IP_CAPEX" in cfg.get("table_metrics", []):
        needed |= {"IP_CAPEX"}
    needed = [m for m in needed if m]
    base = 400
    mat = {}
    r = base
    ws.cell(row=r - 1, column=1, value="Calculation block: company x period matrices pulled from Data (inputs to the tables above)").font = f(True, GREY, 9)
    for m in sorted(needed):
        header_row(ws, r, [m] + periods, fill=SUB_FILL, color=BLACK)
        r += 1
        first = r
        for t in tickers:
            ws.cell(row=r, column=1, value=f'{ds["companies"][t]["name"]} ({t})').font = f(size=9)
            for p in periods:
                c = ws[f"{pc[p]}{r}"]
                STOCK = {"TA", "TE", "EQ_ATTR", "EQ_ORD", "CASH", "ST_DEP", "DEBT", "LEASE_LIAB", "NET_DEBT", "NAV_FV", "LOANS", "DEPOSITS", "T1_SUKUK"}
                if f"{t}|{p}" in ds["sector"].get("ytd_not_9m", {}) or (f"{t}|{p}" in ds["sector"].get("short_fy", {}) and m not in STOCK):
                    c.value = None   # YTD shorter than nine months, or a short year's flows: excluded from sector totals
                    continue
                c.value = lookup(f"{t}-{p}-{m}")
                c.number_format = NUM
                c.font = f(color=GREEN, size=9)
            r += 1
        mat[m] = (first, r - 1)
    # helper flags: 1 where a company's average (opening + closing) denominator is positive. Group returns on equity
    # leave out companies with zero or negative average equity (their own ROE is n.m.)
    for rk, spec in cfg["ratios"].items():
        if not spec[1].startswith("avg:"):
            continue
        dm = spec[1][4:]
        key = f"POS_{dm}"
        if key in mat or dm not in mat:
            continue
        r += 1
        header_row(ws, r, [f"{key} (1 = average {dm} positive)"] + periods, fill=SUB_FILL, color=BLACK)
        r += 1
        first = r
        a0, _ = mat[dm]
        for i, t in enumerate(tickers):
            ws.cell(row=r, column=1, value=f'{ds["companies"][t]["name"]} ({t})').font = f(size=9)
            for p in periods:
                if p == "FY2021":
                    continue
                cur, opn = f"{pc[p]}{a0 + i}", f"{pc[OPENING[p]]}{a0 + i}"
                ws[f"{pc[p]}{r}"] = f'=IF(AND(ISNUMBER({cur}),ISNUMBER({opn})),IF({cur}+{opn}>0,1,0),0)'
                ws[f"{pc[p]}{r}"].font = f(color=GREY, size=9)
            r += 1
        mat[key] = (first, r - 1)
        r += 1

    def rng(m, p, exclude=None):
        a, b = mat[m]
        col = pc[p]
        return f"{col}{a}:{col}{b}"

    def row_of(m, t):
        return mat[m][0] + tickers.index(t)

    r = 5
    sec_rows = {}

    # rows of the totals blocks: the top line and profit (checked against analyze.py) plus the other table metrics the
    # commentary quotes, so every group figure in the text can be read off the sheet
    if TPL.get(sector) == "corporate":
        TOT = [(top, cfg["top_line_name"]), ("EBITDA_C", "EBITDA (calculated)"), ("EBITDA_U", "EBITDA excl. identified one-offs"),
               (prof, "Net profit attributable to shareholders"), ("CFO", "Operating cash flow"), ("CAPEX", "Capex")]
        if "IP_CAPEX" in mat:
            TOT.append(("IP_CAPEX", "Investment-property spend"))
        TOT += [("FCF", "Free cash flow"), ("NET_DEBT", "Net debt (period-end; negative = net cash)")]
    elif TPL.get(sector) == "reit":
        TOT = [(top, cfg["top_line_name"]), (prof, "Net profit attributable to shareholders"), ("FFO", "Funds from operations (FFO)"),
               ("DIST", "Distributions declared"), ("DEBT", "Borrowings (period-end)"), ("NAV_FV", "Net assets at fair value (period-end)")]
    else:
        TOT = [(top, cfg["top_line_name"]), (prof, "Net profit attributable to shareholders")]
    TOT = [(m, lab) for m, lab in TOT if m in mat]

    def totals_block(r, label, excl=None):
        r = section(ws, r, label, 12)
        header_row(ws, r, ["", "FY2022", "FY2023", "FY2024", "FY2025", "CAGR 2022–25", "", f"{yl} 2025", f"{yl} 2026", "YTD change", "Companies (FY2025)"])
        r += 1
        cols = {"FY2022": "B", "FY2023": "C", "FY2024": "D", "FY2025": "E", "9M2025": "H", "9M2026": "I"}
        out = {}
        nblock = len(tickers) - (1 if excl else 0)
        for m, lab in TOT:
            ws.cell(row=r, column=1, value=lab).font = f(True, size=9)
            for p, col in cols.items():
                a, b = mat[m]
                # blank (not 0) when no company in the block reports the period
                cnt = f"SUMPRODUCT(--ISNUMBER({pc[p]}{a}:{pc[p]}{b}))"
                if excl:
                    i = row_of(m, excl)
                    formula = f'=IF({cnt}-ISNUMBER({pc[p]}{i})=0,"",SUM({pc[p]}{a}:{pc[p]}{b})-N({pc[p]}{i}))'
                else:
                    formula = f'=IF({cnt}=0,"",SUM({pc[p]}{a}:{pc[p]}{b}))'
                ws[f"{col}{r}"] = formula
                ws[f"{col}{r}"].number_format = NUM
                tinfo = ds["sector"]["ex_largest" if excl else "all"][m]["totals"][p]
                if tinfo["missing"]:
                    ws[f"{col}{r}"].comment = Comment(f'{tinfo["n"]} companies in this total; not reported by: ' + ", ".join(ds["companies"][x]["name"] for x in tinfo["missing"] if x in ds["companies"]), "analysis")
                if p.startswith("9M"):
                    ws[f"{col}{r}"].fill = YTD_FILL
            ws[f"K{r}"] = f'=SUMPRODUCT(--ISNUMBER({rng(m, "FY2025")}))' + (f"-ISNUMBER({pc['FY2025']}{row_of(m, excl)})" if excl else "")
            vr = r
            out[m] = vr
            r += 1
            ws.cell(row=r, column=1, value="  growth (matched sample)").font = f(italic=True, size=9)
            for cur, pri in PAIRS:
                col = cols[cur]
                cr, prr = rng(m, cur), rng(m, pri)
                a, b = mat[m]
                if excl:
                    i = row_of(m, excl)
                    mask = f"--ISNUMBER({cr}),--ISNUMBER({prr}),--(ROW({cr})<>{i})"
                else:
                    mask = f"--ISNUMBER({cr}),--ISNUMBER({prr})"
                ws[f"{col}{r}"] = f'=IFERROR(IF(AND(SUMPRODUCT({mask},{prr})>=10,SUMPRODUCT({mask},{cr})>=0),SUMPRODUCT({mask},{cr})/SUMPRODUCT({mask},{prr})-1,"n.m."),"n.m.")'
                ws[f"{col}{r}"].number_format = PCT
                if cur.startswith("9M"):
                    ws[f"{col}{r}"].fill = YTD_FILL
            # CAGR on matched FY2022/FY2025 sample
            c25, c22 = rng(m, "FY2025"), rng(m, "FY2022")
            # sample: companies with figures in every year FY2022-FY2025 (as analyze.py)
            mask = f"--ISNUMBER({c25}),--ISNUMBER({c22}),--ISNUMBER({rng(m, 'FY2023')}),--ISNUMBER({rng(m, 'FY2024')})" + (f",--(ROW({c25})<>{row_of(m, excl)})" if excl else "")
            ws[f"F{vr}"] = f'=IFERROR(IF(AND(SUMPRODUCT({mask},{c22})>=10,SUMPRODUCT({mask},{c25})>0),(SUMPRODUCT({mask},{c25})/SUMPRODUCT({mask},{c22}))^(1/3)-1,"n.m."),"n.m.")'
            ws[f"F{vr}"].number_format = PCT
            ginfo = ds["sector"]["ex_largest" if excl else "all"].get(m, {}).get("growth", {}).get("CAGR_2022_2025", {})
            samp = ginfo.get("sample", [])
            pool = [x for x in tickers if x != excl]
            if samp is not None and len(samp) < len(pool):
                left = [ds["companies"][x]["name"] for x in pool if x not in samp]
                ws[f"F{vr}"].comment = Comment(f"CAGR on the {len(samp)} of {len(pool)} companies with figures in every year 2022–2025; left out: " + ", ".join(left) + " (short year or missing year).", "analysis")
            ws[f"J{vr}"] = f'=IF(ISNUMBER(I{r}),I{r},"n.m.")'
            ws[f"J{vr}"].number_format = PCT
            ws[f"J{vr}"].fill = YTD_FILL
            ws[f"I{r}"].fill = YTD_FILL
            r += 1
        # how many companies each top-line total covers (a short year or a missing filing leaves a company out)
        ws.cell(row=r, column=1, value=f"  companies in the {cfg['top_line_name'].lower()} total (of {nblock})").font = f(italic=True, size=9, color=GREY)
        for p, col in cols.items():
            cnt = f'SUMPRODUCT(--ISNUMBER({rng(top, p)}))' + (f"-ISNUMBER({pc[p]}{row_of(top, excl)})" if excl else "")
            ws[f"{col}{r}"] = "=" + cnt
            ws[f"{col}{r}"].font = f(italic=True, size=9, color=GREY)
            tinfo = ds["sector"]["ex_largest" if excl else "all"][top]["totals"][p]
            if tinfo["missing"]:
                ws[f"{col}{r}"].comment = Comment("Not in this total: " + ", ".join(ds["companies"][x]["name"] for x in tinfo["missing"] if x in ds["companies"]) + ". A short financial year, a period before listing, or a figure the filings do not give.", "analysis")
        r += 1
        # ratios from totals
        for rk, spec in cfg["ratios"].items():
            ws.cell(row=r, column=1, value=spec[2]).font = f(size=9)
            for p, col in cols.items():
                nparts = spec[0].split("-")
                dm = spec[1].replace("avg:", "").replace("ann:", "")
                avg = spec[1].startswith("avg:")
                annd = spec[1].startswith("ann:")
                masks = [f"--ISNUMBER({rng(nparts[0], p)})", f"--ISNUMBER({rng(dm, p)})"]
                if avg:
                    masks.append(f"--ISNUMBER({rng(dm, OPENING[p])})")
                if avg and f"POS_{dm}" in mat:
                    masks.append(f"--({rng(f'POS_{dm}', p)}=1)")   # companies with zero or negative average equity are left out
                if excl:
                    masks.append(f"--(ROW({rng(nparts[0], p)})<>{row_of(nparts[0], excl)})")
                mk = ",".join(masks)
                need = -(-nblock // 2)   # a group ratio needs at least half the companies; otherwise "n.a."
                used_n = f"SUMPRODUCT({mk})"
                # ROW() offsets differ per matrix: build masks on aligned matrices only (same ticker order)
                num = f"SUMPRODUCT({mk},{rng(nparts[0], p)})"
                if len(nparts) > 1:
                    num += f"-SUMPRODUCT({mk},{rng(nparts[1], p)})"
                if avg:
                    den = f"(SUMPRODUCT({mk},{rng(dm, p)})+SUMPRODUCT({mk},{rng(dm, OPENING[p])}))/2"
                    ann = f"*12/{ym}" if p.startswith("9M") else ""
                elif annd:
                    den, ann = f"SUMPRODUCT({mk},{rng(dm, p)})" + (f"*12/{ym}" if p.startswith("9M") else ""), ""
                else:
                    den, ann = f"SUMPRODUCT({mk},{rng(dm, p)})", ""
                if rk == "COR":
                    ws[f"{col}{r}"] = f'=IFERROR(({num}){ann}/({den})*10000,"")'
                    ws[f"{col}{r}"].number_format = BP
                elif annd:
                    ws[f"{col}{r}"] = f'=IFERROR(IF({used_n}=0,"",IF({used_n}<{need},"n.a.",IF(({den})<10,"n.m.",({num})/({den})))),"")'
                    ws[f"{col}{r}"].number_format = XF
                elif avg:
                    ws[f"{col}{r}"] = f'=IFERROR(IF({used_n}=0,"",IF({used_n}<{need},"n.a.",IF(({den})<=0,"n.m.",({num}){ann}/({den})))),"")'
                    ws[f"{col}{r}"].number_format = PCT2 if rk in ("ROA", "NSCI_YLD") else PCT
                else:
                    ws[f"{col}{r}"] = f'=IFERROR(IF({used_n}=0,"",IF({used_n}<{need},"n.a.",({num}){ann}/({den}))),"")'
                    ws[f"{col}{r}"].number_format = XF if rk == "ND_EBITDA" else (PCT2 if rk in ("ROA", "NSCI_YLD") else PCT)
                rinfo = ds["sector"]["ratios_all" if not excl else "ratios_ex_largest"][rk][p]
                gnote = (cfg.get("cell_notes") or {}).get(f"{rk}|{p}")
                if gnote and not excl:
                    ws[f"{col}{r}"].comment = Comment(gnote, "analysis")
                if rinfo["excluded"]:
                    pre = (f"n.a.: only {rinfo['n']} of {nblock} companies have the inputs (at least half are needed for a group ratio). "
                           if rinfo["v"] == "n.a." else f'{rinfo["n"]} of {nblock} companies. ')
                    ws[f"{col}{r}"].comment = Comment(((gnote + " ") if gnote and not excl else "") + pre + "Left out (missing inputs, short year" + (", or zero or negative average equity" if avg else "") + "): "
                                                      + ", ".join(ds["companies"][x]["name"] for x in rinfo["excluded"] if x in ds["companies"]), "analysis")
                if p.startswith("9M"):
                    ws[f"{col}{r}"].fill = YTD_FILL
            r += 1
        return r + 1, out

    r, sec_rows = totals_block(r, f"1. {UNIT[0].capitalize()} totals: all {len(tickers)} companies")
    lname = ds["companies"][largest]["name"]
    if len(tickers) > 1:   # a one-company group has no "excluding the largest" view
        r, _ = totals_block(r, f"2. Excluding the largest company ({lname}, largest by FY2025 {cfg['top_line_name'].lower()})", excl=largest)

    # 3. company contributions
    r = section(ws, r, f"3. Company contribution: share of {UNIT[0]} and contribution to {UNIT[0]} growth")
    for m, lab in ((top, cfg["top_line_name"]), (prof, "Net profit attributable")):
        header_row(ws, r, [f"{lab}: share of {UNIT[0]}", "FY2022", "FY2023", "FY2024", "FY2025", "", "", f"{yl} 2025", f"{yl} 2026"])
        r += 1
        for t in tickers:
            nm = ds["companies"][t]["name"]
            c = ws.cell(row=r, column=1, value=nm)
            c.hyperlink = f"#'{comp_sheets[t]}'!A1"
            c.font = f(color="0563C1", underline="single", size=9)
            for p, col in (("FY2022", "B"), ("FY2023", "C"), ("FY2024", "D"), ("FY2025", "E"), ("9M2025", "H"), ("9M2026", "I")):
                i = row_of(m, t)
                ws[f"{col}{r}"] = f'=IF(ISNUMBER({pc[p]}{i}),{pc[p]}{i}/SUM({rng(m, p)}),"")'
                ws[f"{col}{r}"].number_format = PCT
            r += 1
        header_row(ws, r, [f"{lab}: contribution to {UNIT[0]} growth (pp)", "FY23 vs FY22", "FY24 vs FY23", "FY25 vs FY24", "", "", "", "", f"{yl}26 vs {yl}25"])
        r += 1
        for t in tickers:
            ws.cell(row=r, column=1, value=ds["companies"][t]["name"]).font = f(size=9)
            for (cur, pri), col in zip(PAIRS, ("B", "C", "D", "I")):
                i = row_of(m, t)
                cr, prr = rng(m, cur), rng(m, pri)
                ws[f"{col}{r}"] = (f'=IF(AND(ISNUMBER({pc[cur]}{i}),ISNUMBER({pc[pri]}{i})),'
                                   f'({pc[cur]}{i}-{pc[pri]}{i})/SUMPRODUCT(--ISNUMBER({cr}),--ISNUMBER({prr}),{prr}),"")')
                ws[f"{col}{r}"].number_format = PCT
            r += 1
        r += 1
    # HHI
    ws.cell(row=r, column=1, value=f"Concentration (HHI, 0–10,000) of {cfg['top_line_name'].lower()}").font = f(size=9)
    for p, col in (("FY2022", "B"), ("FY2023", "C"), ("FY2024", "D"), ("FY2025", "E"), ("9M2025", "H"), ("9M2026", "I")):
        rg = rng(top, p)
        ws[f"{col}{r}"] = f'=IFERROR(SUMSQ({rg})/SUM({rg})^2*10000,"")'
        ws[f"{col}{r}"].number_format = "#,##0"
    hhi_row = r
    r += 2

    # 4. narrative
    r = section(ws, r, "4. Main changes since 2022 and their drivers")
    for d in narr.get("main_changes", []) or []:
        r = para(ws, r, f'• {d.get("change", "")} Driver: {d.get("driver", "")}  [{d.get("evidence", "")}]')
    r += 1
    r = section(ws, r, "5. Takeaways")
    tk = narr.get("takeaways", {}) or {}
    for lab in ("improved", "weakened", "why", "concentration", "ytd_2026", "uncertain"):
        if tk.get(lab):
            r = para(ws, r, f'{lab.replace("_", " ").capitalize()}: {tk[lab]}')
    r += 1
    r = section(ws, r, "5b. Data notes: series breaks, bases and classification")
    for n in (narr.get("data_notes", []) or []) + [cfg.get("margin_base_note", ""), cfg.get("classification_note", "")]:
        if n:
            r = para(ws, r, "• " + n)
    r += 1
    r = section(ws, r, "6. Charts (full years and 9M shown in separate charts)")
    chart_row = r
    # charts from calc block
    a, b = mat[top]
    ch = BarChart(); ch.type = "col"; ch.grouping = "stacked"; ch.overlap = 100
    ch.title = f"{cfg['top_line_name']} by company, FY2022–FY2025 (SAR m)"
    for t in tickers:
        i = row_of(top, t)
        ref = Reference(ws, min_col=3, max_col=6, min_row=i, max_row=i)
        ch.add_data(ref, from_rows=True, titles_from_data=False)
        ch.series[-1].tx = None
    from openpyxl.chart.series import SeriesLabel
    for s, t in zip(ch.series, tickers):
        s.tx = SeriesLabel(v=ds["companies"][t]["name"])
    ch.set_categories(Reference(ws, min_col=3, max_col=6, min_row=a - 1, max_row=a - 1))
    _fix_chart(ch); ch.height, ch.width = 8, 16
    ws.add_chart(ch, f"A{chart_row}")
    a2, b2 = mat[prof]
    ch2 = BarChart(); ch2.type = "col"; ch2.grouping = "clustered"
    ch2.title = f"Net profit attributable: {yl} 2025 vs {yl} 2026 (partial year, SAR m)"
    for p, col in (("9M2025", 7), ("9M2026", 8)):
        ref = Reference(ws, min_col=col, max_col=col, min_row=a2 - 1, max_row=b2)
        ch2.add_data(ref, titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=1, max_col=1, min_row=a2, max_row=b2))
    _fix_chart(ch2); ch2.height, ch2.width = 8, 16
    ws.add_chart(ch2, f"G{chart_row}")
    ws.freeze_panes = "B5"
    return ws, sname


def _fix_chart(ch):
    ch.roundedCorners = False
    if ch.legend is not None:
        ch.legend.overlay = False
        ch.legend.position = "b"
    try:
        ch.x_axis.delete = False
        ch.y_axis.delete = False
        ch.y_axis.numFmt = "#,##0"
        ch.y_axis.majorGridlines = None
    except AttributeError:
        pass


NUMCOLS = {"amount_sar_m", "stake", "value_sar_m", "value used (SAR m)", "originally reported (SAR m)", "original_value"}


def simple_table(wb, name, heading, sub, rows, cols, widths=None, index=None, blue_cols=()):
    ws = wb.create_sheet(name) if index is None else wb.create_sheet(name, index)
    title(ws, heading, sub)
    header_row(ws, 5, [c for c in cols])
    r = 6
    for x in rows:
        for i, c in enumerate(cols, start=1):
            v = x.get(c, "")
            try:
                if c in blue_cols and v not in ("", None):
                    v = float(v)
            except ValueError:
                pass
            if c in NUMCOLS and isinstance(v, str) and re.fullmatch(r"-?\d+(\.\d+)?", v.strip()):
                v = float(v)   # amounts are stored as numbers, not text
            cell = ws.cell(row=r, column=i, value=v)
            cell.font = f(color=BLUE if c in blue_cols else BLACK, size=9)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if isinstance(v, float) and c in NUMCOLS:
                cell.number_format = NUM1
        r += 1
    for i, w in enumerate(widths or [], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A6"
    if rows:
        ws.auto_filter.ref = f"A5:{get_column_letter(len(cols))}{r - 1}"
    return ws


def main(root, out):
    ds = json.load(open(os.path.join(root, "data", "dataset.json")))
    cfg_all = json.load(open(os.path.join(root, "config", "sectors.json")))
    import sectors
    SEC = [s for s in sectors.load(root) if s["key"] in ds]
    TPL.update({s["key"]: s["template"] for s in SEC})
    ORDER[:] = [s["key"] for s in SEC]
    facts = [x for _, fp in sectors.facts_paths(root) for x in load_csv(fp)]
    facts_idx = {(x["ticker"], x["period"], x["metric_code"]): x for x in facts}
    adj = load_csv(os.path.join(root, "data", "adjustments.csv"))
    guide0 = load_yaml(os.path.join(root, "data", "narratives", "guide.yaml"))
    UNIT[0] = guide0.get("group_word", "sector")
    wb = Workbook()
    wb.remove(wb.active)
    contents = wb.create_sheet("Contents")
    # one company name per ticker in the Data sheet (XBRL entity names vary between filings)
    legal = {t: c.get("legal_name") or c["name"] for S in ds.values() for t, c in S["companies"].items()}
    for x in facts:
        x["company"] = legal.get(x["ticker"], x.get("company", ""))
    build_data(wb, facts)
    # Adjustments sheet: columns A..M fixed (B ticker, C comparison, D step, F amount, G basis)
    adj_cols = ["adj_id", "ticker", "comparison", "bridge_step", "metric_affected", "amount_sar_m", "basis", "method",
                "assumptions", "source", "page", "confidence", "notes"]
    simple_table(wb, "Adjustments", "Adjustments register: like-for-like bridge inputs",
                 "Each row moves reported growth towards like-for-like. amount_sar_m = contribution to the change in the top line "
                 "(positive = added growth). basis: disclosed | calculated | estimated | none identified (the filings show there was nothing) | not determinable. Blue = input.",
                 adj, adj_cols, [9, 7, 14, 16, 10, 12, 14, 50, 40, 40, 8, 10, 40], blue_cols=("amount_sar_m",))
    comp_sheets = {}
    for sector in ORDER:
        for t in ds[sector]["tickers"]:
            short = ds[sector]["companies"][t]["name"].split(" (")[0].replace(" ", "")[:14]
            comp_sheets[t] = f"{cfg_all[sector].get('code', sector[0])}_{t}_{short}"
    for s in SEC:
        sector = s["key"]
        cfg = cfg_all[sector]
        sec_narr = load_yaml(os.path.join(root, "data", "narratives", f"sector_{s['slug']}.yaml"))
        _, sname = build_sector(wb, sector, cfg, ds[sector], sec_narr, comp_sheets)
        for t in ds[sector]["tickers"]:
            narr = load_yaml(os.path.join(root, "data", "narratives", f"{t}.yaml"))
            build_company(wb, sector, t, cfg, ds[sector], narr, adj, facts_idx, comp_sheets[t], sname)
    build_overview(wb, ds, comp_sheets)
    # coverage, sources, policy, review, template changes, methodology, metrics
    cov = load_csv(os.path.join(root, "data", "coverage.csv"))

    if cov:
        simple_table(wb, "Coverage", "Coverage: available filings and gaps by company and period",
                     guide0.get("coverage_note", "File-level checks (company name, period, units, assurance) were done inside every file - see Sources. Individual values were matched to PDF text where it exists (Data: PDF match status); figures on scanned pages rest on the XBRL file, with a sample checked visually by the independent auditors."),
                     cov, list(cov[0].keys()), [10, 8, 28] + [16] * (len(cov[0]) - 3), index=2)
    src = [x for s in SEC if os.path.exists(os.path.join(root, "data", s["slug"], "sources.csv")) for x in load_csv(os.path.join(root, "data", s["slug"], "sources.csv"))]
    if src:
        simple_table(wb, "Sources", "Source register: every archive file reviewed",
                     "Checks were done inside the files, never from filenames alone. Status: used | used-with-flag | unreadable | excluded.",
                     src, list(src[0].keys()), [40, 8, 7, 30, 6, 30, 12, 11, 28, 16, 11, 11, 9, 14, 10, 6, 7, 7, 12, 40, 20, 40, 50, 6])
    for fn, name, heading, sub in (
        ("policy/items.csv", "Budget_Policy_Facts", "Budget and policy: verified facts and statements (forward-looking section, kept separate)",
         "Final budget vs preliminary statement vs ministerial statement vs regulatory measure. Dated official sources."),
        ("policy/impacts.csv", "Budget_Policy_Impact", "Budget and policy: impact assessment by sector and company (interpretation)",
         "Direction, timing, significance and confidence are our interpretation and do not feed historical or like-for-like figures."),
        ("one_offs.csv", "One_offs", "One-offs register: items removed in EBITDA excluding one-offs",
         "Material items the filing calls non-recurring, or clearly outside normal operations, that sit inside our operating income (in_metric OPINC; for REITs, items inside FFO, listed only). "
         "Impairments and fair-value gains on investment property are already outside EBITDA and are not listed. Net profit is never adjusted unless the filing gives both the tax/zakat effect and the minority share; "
         "each company page states that status."),
        ("cross_holdings.csv", "Cross_holdings", "Cross-holdings: where one listed company owns another on the list",
         "Group totals are simple sums of listed companies, not consolidated. These holdings mean some revenue or profit appears twice (or in another group). Amounts from the holder's notes; derived figures are marked in the note."),
        ("review_log.csv", "Review_Log", "Independent review log", "Issues raised by independent reviewers, fixes and re-checks."),
        ("template_changes.csv", "Template_Changes", "Template improvements identified in the pilots", "Applied before roll-out to other sectors."),
    ):
        rows = load_csv(os.path.join(root, "data", fn))
        if rows:
            simple_table(wb, name, heading, sub, rows, list(rows[0].keys()), [12] + [28] * (len(rows[0]) - 1))
    # restatements register: every figure used from a later filing that changed it (provenance R), with the reason
    rst = []
    for x in facts:
        if x.get("provenance") != "R":
            continue
        rst.append({"ticker": x["ticker"], "company": ds[x["sector"]]["companies"].get(x["ticker"], {}).get("name", x.get("company", "")),
                    "period": x["period"], "metric_code": x["metric_code"], "value used (SAR m)": x["value_sar_m"],
                    "originally reported (SAR m)": x.get("original_value", ""), "first reported in": x.get("original_source", ""),
                    "figure used from": x.get("source_id", ""), "reason": x.get("note", "")})
    if rst:
        simple_table(wb, "Restatements", "Restatements and re-presentations: every figure taken from a later filing that changed it",
                     f"{len(rst)} figures (provenance R). The figure used is the comparative in the latest filing that shows the period. "
                     "'NOT A RESTATEMENT' in a reason marks a value the exchange's XBRL file first mis-tagged, where the PDF always showed the figure used.",
                     rst, list(rst[0].keys()), [7, 24, 9, 11, 12, 12, 36, 36, 90])
    met = load_csv(os.path.join(root, "config", "metrics.csv"))
    simple_table(wb, "Definitions", "Metric definitions", "All sectors use these definitions; sector ratios are ratios of totals.",
                 met, list(met[0].keys()), [14, 18, 36, 14, 9, 14, 90, 30], index=1)
    guide = load_yaml(os.path.join(root, "data", "narratives", "guide.yaml"))
    gs = wb.create_sheet("How_to_read", 1)
    title(gs, "How to read this workbook, and the methodology in brief")
    gs.column_dimensions["A"].width = 150
    r = 5
    for sec in guide.get("sections", []):
        gs.cell(row=r, column=1, value=sec["heading"]).font = f(True, "1F3864", 11)
        r += 1
        for line in sec.get("lines", []):
            c = gs.cell(row=r, column=1, value=line)
            c.alignment = Alignment(wrap_text=True, vertical="top")
            c.font = f(size=9)
            gs.row_dimensions[r].height = max(14, 13 * (len(line) // 170 + 1))
            r += 1
        r += 1
    # final sheet order: guidance first, then each sector followed by its companies, then registers
    order = ["Contents", "How_to_read", "Overview", "Definitions", "Coverage"]
    for sector in ORDER:   # each sector (or group) sheet followed by its companies, in configured order
        order += [f"{sector}_{UNIT[0].capitalize()}"] + [comp_sheets[t] for t in ds[sector]["tickers"]]
    order += ["Budget_Policy_Impact", "Budget_Policy_Facts", "Adjustments", "One_offs", "Restatements", "Cross_holdings", "Data", "Sources", "Review_Log", "Template_Changes"]
    order = [n for n in order if n in wb.sheetnames] + [n for n in wb.sheetnames if n not in order]
    wb._sheets = [wb[n] for n in order]
    # contents
    title(contents, guide.get("workbook_title", "Saudi sector & company financial analysis 2022–2026: pilot sectors Energy and Banks"),
          f"Built from the 'Tadawul Financials' archive. Figures in SAR million unless stated. As of {guide.get('as_of', '')}.")
    contents["A3"].value = None
    contents["A3"].hyperlink = None
    r = 5
    for ws in wb.worksheets:
        if ws.title == "Contents":
            continue
        c = contents.cell(row=r, column=1, value=ws.title)
        c.hyperlink = f"#'{ws.title}'!A1"
        c.font = f(color="0563C1", underline="single", size=10)
        contents.cell(row=r, column=2, value=ws["A1"].value).font = f(size=9, color=GREY)
        r += 1
    contents.column_dimensions["A"].width = 30
    contents.column_dimensions["B"].width = 110
    wb.save(out)
    print("workbook ->", out)


if __name__ == "__main__":
    main(*sys.argv[1:3])
