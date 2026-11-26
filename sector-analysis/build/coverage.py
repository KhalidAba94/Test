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
for sector in ("Energy", "Banks"):
    s = sector.lower()
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
                stm = scanned.get(f"{sector}/{pdf['source_id']}")
                have.append("PDF" + (f"(statements scanned, read by OCR: p.{stm})" if stm else ""))
            if xls:
                have.append("XBRL" if xls.get("status") == "used" else "XBRL(unreadable)")
            metric = "NI_ATTR" if t in ("2030",) else top   # investment holding: no revenue line
            fx = fidx.get((t, per, metric))
            if fx:
                used = fx["source_id"].split("/")[-1].split("_filed")[0].replace("_", " ")
                prov = {"D": "", "R": " [restated]", "C": " [calc]"}.get(fx["provenance"], "")
                cell = f'{"+".join(have) or "no own filing"}; value used from {used}{prov}'
                if "OVERRIDE" in fx.get("note", ""):
                    cell += " [from PDF]"
            else:
                cell = ("MISSING: " + ("+".join(have) if have else "no filing in archive"))
                flags.append(f"{per}: {metric} not available")
            if per.startswith("9M") and l == "Q3" and not d:
                cell = "MISSING: no Q3 filing in archive"
            row[per] = cell
        nr = sum(1 for k, x in fidx.items() if k[0] == t and x["provenance"] == "R")
        no = sum(1 for k, x in fidx.items() if k[0] == t and "OVERRIDE" in x.get("note", ""))
        if nr:
            flags.append(f"{nr} restated comparatives used (see Data, provenance R)")
        if no:
            flags.append(f"{no} figures taken from PDF where XBRL missing/mis-tagged (overrides)")
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
