"""Company x analysis-period coverage table (what was available, what was used, gaps).

Usage: python coverage.py <root_dir>
Writes data/coverage.csv.
"""
import csv, json, os, sys
from collections import defaultdict

root = sys.argv[1]
ds = json.load(open(os.path.join(root, "data", "dataset.json")))
PER = [("FY2022", "2022", "Annual"), ("FY2023", "2023", "Annual"), ("FY2024", "2024", "Annual"), ("FY2025", "2025", "Annual"),
       ("9M2025", "2025", "Q3"), ("9M2026", "2026", "Q3")]
# PDFs whose primary-statement pages are image-only (read by OCR): data/trace/scanned_pages.csv
scanned = {}
sp = os.path.join(root, "data", "trace", "scanned_pages.csv")
if os.path.exists(sp):
    for r in csv.DictReader(open(sp, encoding="utf-8")):
        if r["statement_pages"]:
            scanned[r["pdf"]] = r["statement_pages"]
out = []
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sectors as _sectors
_SLUG = {x["key"]: x["slug"] for x in _sectors.load(root)}
_ARCH = {x["key"]: x["archive"] for x in _sectors.load(root)}
_RAW = _sectors.raw(root)
for sector in [k for k in _SLUG if k in ds]:
    s = _SLUG[sector]
    src = list(csv.DictReader(open(os.path.join(root, "data", s, "sources.csv"), encoding="utf-8")))
    facts = list(csv.DictReader(open(os.path.join(root, "data", s, "facts.csv"), encoding="utf-8")))
    docs = defaultdict(dict)
    for r in src:
        if "period_label_in_name" in r and r.get("period_label_in_name"):
            y, l = r["period_label_in_name"].split()
            docs[(r["ticker"], y, l)][r["file_type"]] = r
    fidx = {(x["ticker"], x["period"], x["metric_code"]): x for x in facts}
    top = ds[sector]["config"]["top_line"]
    for t in ds[sector]["tickers"]:
        row = {"sector": sector, "ticker": t, "company": ds[sector]["companies"][t]["name"]}
        flags = []
        for per, y, l in PER:
            d = docs.get((t, y, l), {})
            pdf, xls = d.get("pdf"), d.get("xls")
            have = []
            if pdf:
                stm = scanned.get(f"{_ARCH[sector]}/{pdf['source_id']}") or scanned.get(f"{sector}/{pdf['source_id']}")
                have.append("PDF" + (f"(statements scanned, read by OCR: p.{stm})" if stm else ""))
            if xls:
                have.append({"used": "XBRL", "flagged": "XBRL (label or symbol flag explained in Sources)"}.get(xls.get("status"), "XBRL(unreadable)"))
            metric = "NI_ATTR" if t in ("2030",) else top   # investment holding: no revenue line
            fx = fidx.get((t, per, metric))
            anyfx = [x for k, x in fidx.items() if k[0] == t and k[1] == per and x.get("value_sar_m") not in ("", None)]
            first = min((k[1] for k, x in fidx.items() if k[0] == t and k[1].startswith("FY") and k[1] != "FY2021" and x.get("value_sar_m") not in ("", None)), default="FY2022")
            ccfg = (_RAW.get(sector, {}).get("constituents", {}) or {}).get(t, {})
            plab = (ccfg.get("period_labels") or {}).get(per, "")
            excl = (ccfg.get("exclude_from_totals") or {}).get(per, "")
            if fx:
                used = fx["source_id"].split("/")[-1].split("_filed")[0].replace("_", " ")
                prov = {"D": "", "R": " [restated]", "C": " [calc]"}.get(fx["provenance"], "")
                cell = f'{"+".join(have) or "no own filing"}; value used from {used}{prov}'
                if "OVERRIDE" in fx.get("note", ""):
                    cell += " [from PDF]"
            elif anyfx:
                # the period is covered but the top line is not printed (e.g. a REIT fact sheet without rental income)
                src0 = anyfx[0]["source_id"].split("/")[-1].split("_filed")[0].replace("_", " ")
                cell = f'{"+".join(have) or "no own filing"}; {len(anyfx)} figures used from {src0}; {metric} not printed'
                flags.append(f"{per}: {metric} not printed")
            elif per.startswith("FY") and per < first:
                cell = "not applicable: before the company's first financial period in the archive"
            else:
                cell = ("MISSING: " + ("+".join(have) if have else "no filing in archive"))
                if per.startswith("9M") and l == "Q3" and not d:
                    cell = "MISSING: no Q3 filing in archive"
                flags.append(f"{per}: {metric} not available")
            if plab and per != "FY2021":
                cell += f" [period: {plab}]"
            if excl:
                cell += " [left out of group totals]"
            row[per] = cell
        nr = sum(1 for k, x in fidx.items() if k[0] == t and x["provenance"] == "R")
        no = sum(1 for k, x in fidx.items() if k[0] == t and "OVERRIDE" in x.get("note", ""))
        if nr:
            flags.append(f"{nr} restated comparatives used (see Data, provenance R)")
        if no:
            noxbrl = not any(r.get("file_type") == "xls" for r in src if r["ticker"] == t)
            flags.append(f"{no} figures read from the PDFs (no XBRL filed)" if noxbrl else f"{no} figures taken from the PDFs where the XBRL file was missing or mis-tagged")
        unread = [r["file"] for r in src if r["ticker"] == t and r["status"] == "unreadable"]
        if unread:
            flags.append("unreadable: " + ", ".join(unread))
        if t == "2030":
            flags.append("investment holding with no operating revenue: coverage judged on profit")
        if t == "2382":
            flags.append("FY2022 = predecessor group (special-purpose FS / note 30 of FY2023 AFS); FY2023 statutory period 28 Dec 2022 - 31 Dec 2023")
        row["flags"] = "; ".join(flags)
        out.append(row)
with open(os.path.join(root, "data", "coverage.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
print("coverage ->", len(out), "companies")
