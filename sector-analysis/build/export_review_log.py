"""Write the detailed review log as a standalone workbook.

Usage: python export_review_log.py <root_dir> <out.xlsx>

Sheets:
  Summary              counts by review and status, and what the reviews covered
  Review_Log           every issue: id, review, severity, where, finding, status, fix, recheck trail
  Not_fully_closed     issues whose status is not 'fixed', with the reason
  Accepted_limitations limitations that remain by design, with the evidence and where they are disclosed
  Full_trace_summary   how every published figure was traced to its source PDF (data/trace/full_trace.csv)
"""
from __future__ import annotations

import csv
import os
import sys
from collections import Counter

import yaml
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

HEAD = PatternFill("solid", fgColor="10262E")
BAND = PatternFill("solid", fgColor="E6ECE9")


def sheet(wb, name, header, rows, widths, title=None):
    ws = wb.create_sheet(name)
    r0 = 1
    if title:
        ws.cell(row=1, column=1, value=title).font = Font(bold=True, size=13)
        r0 = 3
    for j, h in enumerate(header, 1):
        c = ws.cell(row=r0, column=j, value=h)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = HEAD
        c.alignment = Alignment(wrap_text=True, vertical="top")
    for i, row in enumerate(rows, r0 + 1):
        for j, v in enumerate(row, 1):
            c = ws.cell(row=i, column=j, value=v)
            c.alignment = Alignment(wrap_text=True, vertical="top")
    for j, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.freeze_panes = ws.cell(row=r0 + 1, column=1)
    ws.auto_filter.ref = f"A{r0}:{get_column_letter(len(header))}{r0 + max(len(rows), 1)}"
    return ws


def main(root, out):
    log = list(csv.DictReader(open(os.path.join(root, "data", "review_log.csv"), encoding="utf-8")))
    summ = yaml.safe_load(open(os.path.join(root, "data", "review_summary.yaml"), encoding="utf-8")) or {}
    lim = yaml.safe_load(open(os.path.join(root, "data", "review", "accepted_limitations.yaml"), encoding="utf-8")) or {}
    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    ws["A1"] = "Energy and Banks pilot: review log"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A3"] = summ.get("summary", "")
    ws["A3"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells("A3:F8")
    ws.row_dimensions[3].height = 30
    reviews = sorted({r["review"] for r in log})
    statuses = ["fixed", "partly fixed", "accepted", "disagreed - kept", "open"]
    ws["A10"] = "Issues by review and status"
    ws["A10"].font = Font(bold=True)
    hdr = ["Review"] + statuses + ["Total"]
    for j, h in enumerate(hdr, 1):
        c = ws.cell(row=11, column=j, value=h)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = HEAD
    cnt = Counter((r["review"], r["status"]) for r in log)
    rr = 12
    for rv in reviews + ["All reviews"]:
        ws.cell(row=rr, column=1, value=rv)
        tot = 0
        for j, s in enumerate(statuses, 2):
            n = sum(v for (a, b), v in cnt.items() if b == s and (rv == "All reviews" or a == rv))
            ws.cell(row=rr, column=j, value=n)
            tot += n
        ws.cell(row=rr, column=len(hdr), value=tot)
        if rv == "All reviews":
            for j in range(1, len(hdr) + 1):
                ws.cell(row=rr, column=j).fill = BAND
                ws.cell(row=rr, column=j).font = Font(bold=True)
        rr += 1
    rr += 1
    for key, lab in (("checked", "What was checked"), ("fixed", "What was fixed"), ("unresolved", "Still open or accepted")):
        ws.cell(row=rr, column=1, value=lab).font = Font(bold=True)
        rr += 1
        for x in summ.get(key, []) or []:
            ws.cell(row=rr, column=1, value="• " + x).alignment = Alignment(wrap_text=True, vertical="top")
            ws.merge_cells(start_row=rr, start_column=1, end_row=rr, end_column=8)
            ws.row_dimensions[rr].height = 45
            rr += 1
        rr += 1
    for j, w in enumerate([34, 12, 14, 12, 16, 10, 10, 10], 1):
        ws.column_dimensions[get_column_letter(j)].width = w

    sheet(wb, "Review_Log", ["Issue", "Review", "Severity", "Where", "Finding", "Status", "Fix", "Recheck trail"],
          [[r["issue_id"], r["review"], r["severity"], r["where"], r["finding"], r["status"], r["fix"], r["recheck"]] for r in log],
          [11, 18, 10, 26, 70, 12, 70, 50])
    nf = [r for r in log if r["status"] != "fixed"]
    sheet(wb, "Not_fully_closed", ["Issue", "Review", "Status", "Finding", "What was done", "Why it is not closed"],
          [[r["issue_id"], r["review"], r["status"], r["finding"], r["fix"], (lim.get("by_issue", {}) or {}).get(r["issue_id"], "")] for r in nf],
          [11, 18, 14, 60, 60, 60])
    sheet(wb, "Accepted_limitations", ["Limitation", "Why it remains", "Evidence checked", "Where it is disclosed"],
          [[x.get("limitation", ""), x.get("why", ""), x.get("evidence", ""), x.get("disclosed", "")] for x in lim.get("limitations", []) or []],
          [40, 60, 60, 40])
    tp = os.path.join(root, "data", "trace", "full_trace.csv")
    if os.path.exists(tp):
        tr = list(csv.DictReader(open(tp, encoding="utf-8")))
        c = Counter(r["trace_status"] for r in tr)
        desc = {
            "text_statement": "Value printed on a primary-statement page of the source PDF (text layer)",
            "text_other": "Value printed elsewhere in the source PDF, e.g. a note (text layer)",
            "ocr_statement": "Value read by OCR on an image-only statement page",
            "ocr_other": "Value read by OCR on another image-only page",
            "components_found": "Figure built from several lines; every line found in the PDF",
            "later_filing": "Printed as a comparative in a later filing of the company",
            "pdf_override_confirmed": "Taken from a PDF page by correction; value re-found on that page",
            "pdf_override_page": "Taken from a PDF page by correction; page recorded, value computed from printed lines",
            "manual_confirmed": "Located and confirmed by an independent reviewer",
            "calculated_ok": "Calculated figure; recomputed from its inputs and equal",
            "calculated_rule": "Calculated figure; rule in derive.py, inputs not all stored",
            "too_small": "Under 100 in the reporting unit; not searchable reliably (immaterial)",
            "no_value": "Left blank on purpose (see the figure's note)",
            "not_found": "Not located; see the reviewer outcome in the trace file",
        }
        sheet(wb, "Full_trace_summary", ["Trace status", "Figures", "Meaning"],
              [[k, v, desc.get(k, "")] for k, v in sorted(c.items(), key=lambda x: -x[1])] + [["Total", len(tr), "Every published figure (all periods FY2021–9M 2026, both sectors)"]],
              [26, 10, 80])
    wb.save(out)
    print("review log ->", out, len(log), "issues")


if __name__ == "__main__":
    main(*sys.argv[1:3])
