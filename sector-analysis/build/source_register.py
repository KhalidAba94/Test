"""Build the source register and the company x period coverage table.

Usage: python source_register.py <archive_sector_dir> <sector> <xbrl_meta.csv> <out_sources.csv> <out_coverage.csv>

Checks inside each file (never relying on the filename alone):
  XBRL .xls : entity name, symbol, period start/end, assurance, currency, rounding (from filing info).
  PDF       : first pages are text-searched for the company name and the period-end date;
              pages without extractable text are flagged (scanned images).
The manifest_part.json shipped in each company folder gives the Saudi Exchange
source URL for every file.
"""
from __future__ import annotations

import csv
import glob
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]
NAME_KEYS = {  # distinctive words expected on the cover / statements
    "2030": ["Refineries"], "2222": ["Aramco", "Saudi Arabian Oil"], "2380": ["Rabigh"],
    "2381": ["Arabian Drilling"], "2382": ["ADES"], "4030": ["National Shipping", "Bahri"],
    "1010": ["Riyad Bank"], "1020": ["Aljazira", "AlJazira", "Al Jazira"], "1030": ["Saudi Investment Bank"],
    "1050": ["Saudi Fransi", "SAUDI FRANSI"], "1060": ["Saudi Awwal", "Saudi British", "SAB"],
    "1080": ["Arab National Bank"], "1120": ["Al Rajhi", "AL RAJHI", "Al-Rajhi"],
    "1140": ["Albilad", "Al Bilad", "AlBilad"], "1150": ["Alinma", "ALINMA"],
    "1180": ["Saudi National Bank", "SAUDI NATIONAL BANK", "SNB"],
}
PERIOD_END = {"Annual": (12, 31), "Q1": (3, 31), "Q2": (6, 30), "Q3": (9, 30), "Q4": (12, 31)}


def date_patterns(year, month, day):
    m = MONTHS[month - 1]
    return [f"{day} {m} {year}", f"{m} {day}, {year}", f"{day} {m.upper()} {year}", f"{m.upper()} {day}, {year}",
            f"{day}{m} {year}", f"{year}-{month:02d}-{day:02d}"]


def pdf_check(path, ticker, year, label):
    full = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout.split("\f")
    txt = "\n".join(full[:4])
    flat = re.sub(r"\s+", " ", txt)
    info = subprocess.run(["pdfinfo", path], capture_output=True, text=True).stdout
    pages = re.search(r"Pages:\s+(\d+)", info)
    n_pages = int(pages.group(1)) if pages else None
    img = [i + 1 for i, pg in enumerate(full[: (n_pages or len(full))]) if len(pg.strip()) < 80]
    stmt_text = any(re.search(r"statement of (financial position|profit|income|comprehensive)|balance sheet|income statement", pg, re.I)
                    and re.search(r"\d{1,3},\d{3}", pg) for pg in full[:20])
    early = [i for i in img if i <= 15] if not stmt_text else []
    scan_note = (f"{len(img)} of {n_pages} pages have no text layer" + (f" (incl. pages {','.join(map(str, early[:8]))} where the primary statements usually sit)" if early else "")
                 + "; figures on those pages were taken from the XBRL file and checked visually where audited") if img else ""
    if len(flat.strip()) < 200:
        return n_pages, "", "", "scanned: " + scan_note
    name_ok = any(k.lower() in flat.lower() for k in NAME_KEYS.get(ticker, []))
    mo, dd = PERIOD_END[label]
    date_ok = any(p.lower() in flat.lower() for p in date_patterns(int(year), mo, dd))
    notes = [("scanned pages: " + scan_note)] if scan_note else []
    if not name_ok:
        notes.append("company name not found on first pages")
    if not date_ok:
        notes.append("period-end date not found on first pages")
    return n_pages, "yes" if name_ok else "NO", "yes" if date_ok else "NO", "; ".join(notes)


def main(src_dir, sector, meta_csv, out_sources, out_cov):
    meta = {(m["company_dir"], m["file"]): m for m in csv.DictReader(open(meta_csv, encoding="utf-8"))}
    rows = []
    for comp_dir in sorted(glob.glob(os.path.join(src_dir, "*"))):
        comp = os.path.basename(comp_dir)
        ticker = comp.split("_")[0]
        man = {}
        mpath = os.path.join(comp_dir, "manifest_part.json")
        if os.path.exists(mpath):
            mj = json.load(open(mpath))
            man = {it["file"]: it for it in mj.get("items", [])}
            fye = mj.get("fye", "")
        for f in sorted(os.listdir(comp_dir)):
            if f == "manifest_part.json":
                continue
            m = re.match(r"(\d{4})_(Annual|Q1|Q2|Q3|Q4)_filed(\d{4}-\d{2}-\d{2})\.(pdf|xls)$", f)
            if not m:
                rows.append({"source_id": f"{comp}/{f}", "sector": sector, "ticker": ticker, "file": f,
                             "status": "excluded", "status_reason": "unrecognised filename pattern"})
                continue
            year, label, filed, ext = m.groups()
            r = {"source_id": f"{comp}/{f}", "sector": sector, "ticker": ticker, "file": f,
                 "period_label_in_name": f"{year} {label}", "filed": filed, "file_type": ext,
                 "exchange_url": ("https://www.saudiexchange.sa" + man[f]["url"]) if f in man else "",
                 "fye_in_manifest": fye if man else ""}
            if ext == "xls":
                mm = meta.get((comp, f), {})
                r.update({"doc_type": "XBRL rendering (Saudi Exchange)", "company_named_in_file": mm.get("entity_name", ""),
                          "symbol_in_file": mm.get("symbol", ""), "period_start": mm.get("start", ""),
                          "period_end": mm.get("end", ""), "assurance": mm.get("status", ""),
                          "currency": mm.get("currency", ""), "unit_scale": mm.get("rounding", ""),
                          "read_note": mm.get("read_note", "")})
                checks = []
                if mm.get("parse_error") or not mm.get("entity_name"):
                    r["status"], r["status_reason"] = "unreadable", "XBRL file could not be read (also after LibreOffice re-save); PDF used instead"
                else:
                    if not mm.get("symbol", "").startswith(ticker):
                        checks.append("SYMBOL MISMATCH")
                    if not mm.get("end", "").startswith(year):
                        checks.append("PERIOD YEAR MISMATCH")
                    exp = PERIOD_END[label]
                    if mm.get("end", "")[5:] != f"{exp[0]:02d}-{exp[1]:02d}":
                        checks.append("PERIOD END MISMATCH")
                    r["status"] = "used" if not checks else "flagged"
                    r["status_reason"] = "; ".join(checks)
                r["checks_done"] = "entity name, symbol, period start/end, assurance, currency, rounding read from XBRL filing-information block"
            else:
                n_pages, name_ok, date_ok, note = pdf_check(os.path.join(comp_dir, f), ticker, year, label)
                r.update({"doc_type": "Financial statements PDF (" + ("annual, audited" if label == "Annual" else "interim, reviewed") + ")",
                          "pages": n_pages, "name_found_in_text": name_ok, "period_end_found_in_text": date_ok,
                          "status": "used" if not note else "used-with-flag", "status_reason": note,
                          "checks_done": "company name and period-end date searched in text of first 4 pages; page count"})
            rows.append(r)
    snotes = {}
    sn_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(out_sources))), "source_notes.csv")
    if os.path.exists(sn_path):
        snotes = {r["source_id"]: r["note"] for r in csv.DictReader(open(sn_path, encoding="utf-8"))}
    for r in rows:
        if r["source_id"] in snotes:
            r["read_note"] = (r.get("read_note", "") + " " + snotes[r["source_id"]]).strip()
    fields = ["source_id", "sector", "ticker", "file", "file_type", "doc_type", "period_label_in_name", "filed",
              "company_named_in_file", "symbol_in_file", "period_start", "period_end", "assurance", "currency",
              "unit_scale", "pages", "name_found_in_text", "period_end_found_in_text", "status", "status_reason",
              "read_note", "checks_done", "exchange_url", "fye_in_manifest"]
    with open(out_sources, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    # coverage: company x reporting document
    cov = defaultdict(dict)
    for r in rows:
        if "period_label_in_name" not in r:
            continue
        key = r["period_label_in_name"]
        c = cov[r["ticker"]].setdefault(key, {"pdf": "", "xls": ""})
        c[r["file_type"]] = r["status"]
    periods = [f"{y} {l}" for y in range(2022, 2027) for l in ("Q1", "Q2", "Q3", "Q4", "Annual")]
    with open(out_cov, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["sector", "ticker"] + periods)
        for t in sorted(cov):
            line = [sector, t]
            for p in periods:
                c = cov[t].get(p)
                if not c:
                    line.append("")
                    continue
                pdf = {"used": "PDF", "used-with-flag": "PDF*"}.get(c["pdf"], "")
                xls = {"used": "XBRL", "unreadable": "XBRL✗", "flagged": "XBRL!"}.get(c["xls"], "")
                line.append("+".join(x for x in (pdf, xls) if x))
            w.writerow(line)
    print(f"{len(rows)} files registered -> {out_sources}; coverage -> {out_cov}")


if __name__ == "__main__":
    main(*sys.argv[1:6])
