"""Parse Saudi Exchange XBRL-rendered .xls filings into a long table.

Usage: python parse_xbrl_xls.py <archive_sector_dir> <out_csv> <out_meta_csv>

Each .xls has one sheet with sections headed "[code] Section name", a
"Start Date" / "End Date" header pair defining the context of each value
column, optional "[member]" rows (e.g. segment or equity component) and line
items whose label indentation gives the hierarchy. Values are kept exactly as
printed (raw) plus a parsed number. The filing metadata (entity name, symbol,
period, currency, rounding, audit status) is written to a separate file so
that company, period and unit can be verified against the filename.
"""
from __future__ import annotations

import csv
import glob
import os
import re
import sys

import shutil
import subprocess
import tempfile

import xlrd

NUM_RE = re.compile(r"^\(?-?[\d,]*\.?\d+\)?$")


def to_num(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "")
    if not s or not NUM_RE.match(s):
        return None
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()").replace(",", "")
    try:
        x = float(s)
    except ValueError:
        return None
    return -x if neg else x


META_FIELDS = {
    "Name of reporting entity": "entity_name",
    "Company symbol code| ISIN code": "symbol",
    "Sector| Industry group": "sector",
    "Period covered by financial statements": "period_covered",
    "Reporting period start date": "start",
    "Reporting period end date": "end",
    "Description of nature of financial statements": "nature",
    "Status of financial statements": "status",
    "Description of presentation currency": "currency",
    "Level of rounding used in financial statements": "rounding",
    "Method of presentation of statement of income": "is_method",
}


def open_book(path):
    """Open with xlrd; if the file is malformed, re-save a copy via LibreOffice."""
    try:
        return xlrd.open_workbook(path), ""
    except Exception as e:
        tmp = tempfile.mkdtemp()
        src = os.path.join(tmp, "in.xls")
        shutil.copy(path, src)
        subprocess.run(["soffice", "--headless", "--convert-to", "xls:MS Excel 97", "--outdir",
                        os.path.join(tmp, "out"), src], capture_output=True, timeout=300)
        out = os.path.join(tmp, "out", "in.xls")
        if not os.path.exists(out):
            raise
        return xlrd.open_workbook(out), f"xlrd failed ({e!r}); read via LibreOffice re-save"


def parse_file(path):
    book, note = open_book(path)
    sh = book.sheet_by_index(0)
    rows_out, meta = [], {"file": path, "read_note": note}
    section_code = section_name = None
    starts = ends = None
    members: dict[int, str] = {}
    for r in range(sh.nrows):
        c0 = str(sh.cell_value(r, 0)).replace("\u00a0", " ")
        m = re.match(r"^\[(\d+)\]\s*(.*)$", c0.strip())
        if m:
            section_code, section_name = m.group(1), m.group(2).strip()
            starts = ends = None
            members = {}
            continue
        if section_code is None:
            continue
        stripped = c0.strip()
        if stripped == "Start Date":
            starts = {c: str(sh.cell_value(r, c)).replace("\u00a0", " ").strip() for c in range(1, sh.ncols)}
            continue
        if stripped == "End Date":
            ends = {c: str(sh.cell_value(r, c)).replace("\u00a0", " ").strip() for c in range(1, sh.ncols)}
            continue
        if stripped == "":
            # member header rows: "", "X [member]", ...
            vals = {c: str(sh.cell_value(r, c)).replace("\u00a0", " ").strip() for c in range(1, sh.ncols)}
            if any("[member]" in v for v in vals.values()):
                for c, v in vals.items():
                    if v:
                        members[c] = (members.get(c, "") + " / " + v).strip(" /")
            continue
        depth = (len(c0) - len(c0.lstrip(" "))) // 3
        label = stripped
        for c in range(1, sh.ncols):
            raw = sh.cell_value(r, c)
            if raw in ("", None) or (isinstance(raw, str) and not raw.strip()):
                continue
            st = (starts or {}).get(c, "")
            en = (ends or {}).get(c, "")
            if st == "Note No." or (not st and not en and section_code != "100010"):
                # note-number column or untitled column
                if st == "Note No.":
                    continue
            rows_out.append({
                "section_code": section_code, "section": section_name, "row": r,
                "depth": depth, "label": label, "col": c, "start": st, "end": en,
                "member": members.get(c, ""), "raw": str(raw)[:500],
                "value": to_num(raw),
            })
        if section_code == "100010" and label in META_FIELDS:
            key = META_FIELDS[label]
            v1 = str(sh.cell_value(r, 1)).replace("\u00a0", " ").strip()
            if key in ("start", "end"):
                v2 = str(sh.cell_value(r, 2)).strip() if sh.ncols > 2 else ""
                meta[key] = v1
                meta[key + "_comparative"] = v2
            elif key == "symbol":
                meta["symbol"] = v1
                meta["isin"] = str(sh.cell_value(r, 2)).strip() if sh.ncols > 2 else ""
            elif key == "sector":
                meta["sector"] = v1
                meta["industry_group"] = str(sh.cell_value(r, 2)).strip() if sh.ncols > 2 else ""
            else:
                meta[key] = v1
    return rows_out, meta


def main(src_dir, out_csv, out_meta):
    files = sorted(glob.glob(os.path.join(src_dir, "*", "*.xls")))
    fields = ["company_dir", "file", "section_code", "section", "row", "depth", "label",
              "col", "start", "end", "member", "raw", "value"]
    metas = []
    with open(out_csv, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for f in files:
            company_dir = os.path.basename(os.path.dirname(f))
            try:
                rows, meta = parse_file(f)
            except Exception as e:  # unreadable file: record and continue
                metas.append({"company_dir": company_dir, "file": os.path.basename(f),
                              "parse_error": repr(e)[:300]})
                continue
            for row in rows:
                row.update(company_dir=company_dir, file=os.path.basename(f))
                w.writerow(row)
            meta.update(company_dir=company_dir, file=os.path.basename(f), n_values=len(rows))
            metas.append(meta)
    keys = ["company_dir", "file", "entity_name", "symbol", "isin", "sector", "industry_group",
            "period_covered", "start", "end", "start_comparative", "end_comparative", "nature",
            "status", "currency", "rounding", "is_method", "n_values", "read_note", "parse_error"]
    with open(out_meta, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=keys, extrasaction="ignore")
        w.writeheader()
        for m in metas:
            w.writerow(m)
    print(f"{len(files)} files parsed -> {out_csv}, {out_meta}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
