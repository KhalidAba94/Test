"""Locate each extracted figure in the filing PDF (page reference + independent check).

Usage: python pdf_locate.py <archive_sector_dir> <facts.csv> <out_facts.csv>

For each fact, the PDF of the same filing (same "<year>_<period>_" prefix as the
XBRL file that supplied the value) is converted to text page by page, and the
printed number is searched for in the statement's own unit. The result is a
page reference (1-based PDF page) and a status:
  found_statement  - found on a primary-statement page
  found_other      - found only elsewhere (notes)
  not_found        - not found as printed (needs manual check: rounding,
                     presentation in a different unit, or a computed line)
  no_pdf           - no PDF for this filing in the archive
"""
from __future__ import annotations

import csv
import glob
import os
import re
import subprocess
import sys
from functools import lru_cache

STATEMENT_WORDS = re.compile(r"statement of (profit|income|financial position|cash flows|comprehensive)|balance sheet|income statement", re.I)


@lru_cache(maxsize=None)
def pages(pdf):
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
    return txt.split("\f")


def variants(v, unit):
    """Printed forms of a value given the XBRL declared unit."""
    out = []
    bases = [v]
    if unit == "Actuals":
        bases += [v / 1000.0]           # PDF in SAR '000 while XBRL in SAR
    if unit == "Thousands":
        bases += [v * 1000.0]
    for b in bases:
        n = int(round(abs(b)))
        if n < 100:   # too short to search reliably
            continue
        s = f"{n:,}"
        out.append(s)
    return out


def find(pdf, v, unit):
    hits_stmt, hits_other = [], []
    vs = variants(v, unit)
    if not vs:
        return "too_small", ""
    for i, pg in enumerate(pages(pdf), start=1):
        flat = pg.replace(" ", " ")
        for s in vs:
            if re.search(r"(?<![\d,.])" + re.escape(s) + r"(?![\d,]|\.\d)", flat):
                (hits_stmt if STATEMENT_WORDS.search(flat[:1500]) else hits_other).append(i)
                break
    if hits_stmt:
        return "found_statement", ",".join(map(str, sorted(set(hits_stmt))[:4]))
    if hits_other:
        return "found_other", ",".join(map(str, sorted(set(hits_other))[:4]))
    return "not_found", ""


def main(src_dir, facts_csv, out_csv):
    rows = list(csv.DictReader(open(facts_csv, encoding="utf-8")))
    for r in rows:
        comp, xls = r["source_id"].split("/", 1)
        prefix = "_".join(xls.split("_")[:2])            # e.g. 2025_Annual
        pdfs = sorted(glob.glob(os.path.join(src_dir, comp, prefix + "_filed*.pdf")))
        if not pdfs:
            r["pdf_file"], r["pdf_status"], r["pdf_pages"] = "", "no_pdf", ""
            continue
        pdf = pdfs[-1]
        try:
            v = float(r["value_original"])
        except ValueError:
            r["pdf_file"], r["pdf_status"], r["pdf_pages"] = os.path.basename(pdf), "non_numeric", ""
            continue
        st, pg = find(pdf, v, r["unit_original"])
        r["pdf_file"], r["pdf_status"], r["pdf_pages"] = comp + "/" + os.path.basename(pdf), st, pg
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    from collections import Counter
    print(Counter(r["pdf_status"] for r in rows))


if __name__ == "__main__":
    main(*sys.argv[1:4])
