"""Second, independent check on automatic PDF matches: is the value on a line
that names the right item?

Usage: python label_check.py <root_dir> <archive_root> <ocr_cache_dir>

For every fact that full_trace.py matched on a PDF page (text or OCR), the
page lines that contain the value are compared with the fact's line-item label
and metric name. A match is "label_ok" when the line (or the line above, for
labels that wrap) shares a significant word with them, and "label_unclear"
otherwise. Unclear matches go to manual review. Writes
data/trace/label_check.csv and prints a summary.
"""
from __future__ import annotations

import csv
import os
import re
import subprocess
import sys
from collections import Counter
from functools import lru_cache

STOP = set("""total other from with year years period the and for net loss losses profit income expense expenses
before after during attributable owners holders parent company group bank equity value amount amounts charge charges
end beginning balance statement note notes current non including excluding related comprehensive operations operating
sar thousands million continuing items item line lines per share shares basic diluted ordinary""".split())


# metric-specific wording that names the item on a statement or note line
PAT = {
    "TE": r"total equity", "EQ_ATTR": r"attributable|shareholders|equity holders|owners|total equity",
    "NI": r"net (income|profit|loss)|(profit|income|loss) (for|after)|net \(loss\)", "NI_ATTR": r"attributable|shareholders|equity holders|owners|net (income|profit)",
    "NI_CONT": r"continuing|net (income|profit|loss)|(profit|income|loss) for", "TOI": r"operating income|total income",
    "OPEX_TOTAL": r"operating expenses", "OPEX_PRE": r"operating expenses|before", "OP_PROFIT": r"operating (profit|income)|income from operations|net operating",
    "ZAKAT_TAX": r"zakat|tax", "SHARE_JV": r"share|associate|joint venture", "SCE": r"commission expense|return on|financing expense|cost of funds|special commission",
    "SCI_GROSS": r"commission income|financing and investment|investment income|special commission", "COGS": r"cost of (revenue|sales)",
    "STAFF": r"salar|employee|staff", "T1_SUKUK": r"sukuk|tier", "PBT": r"before (zakat|tax|income)", "FIN_COST": r"financ\w* (cost|charge)",
    "FIN_INC": r"financ\w* income|interest income", "GP": r"gross", "INVEST": r"investments", "CAPEX": r"purchase|acquisition|additions|property|capital",
    "FEES_NET": r"fee", "REV": r"revenue|sales", "TA": r"total assets", "LOANS": r"loans|financing|advances", "DEPOSITS": r"deposits",
    "CFO": r"operating activities", "DA_CF": r"depreciation|amorti", "DEPR": r"depreciation|amorti",
}


def words(s):
    return {w for w in re.findall(r"[a-z]{4,}", s.lower()) if w not in STOP}


@lru_cache(maxsize=None)
def pages_text(pdf):
    if not os.path.exists(pdf):
        return []
    return subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout.split("\f")


def ocr_page(cache, rel, p):
    f = os.path.join(cache, rel.replace("/", "__"), f"{p}.txt")
    return open(f, encoding="utf-8", errors="ignore").read() if os.path.exists(f) else ""


def lines_with(text, n, ocr=False):
    out = []
    ls = text.split("\n")
    for i, l in enumerate(ls):
        if ocr:
            digits = re.sub(r"[^\d]", " ", l.replace(",", "").replace(".", ""))
            hit = any(str(n + k) in digits.split() for k in (-1, 0, 1))
        else:
            hit = re.search(r"(?<![\d,.])" + re.escape(f"{n:,}") + r"(?![\d,]|\.\d)", l)
        if hit:
            out.append((ls[i - 1] if i else "") + " || " + l)
    return out


def main(root, arch, cache):
    tr = list(csv.DictReader(open(os.path.join(root, "data", "trace", "full_trace.csv"), encoding="utf-8")))
    facts = {}
    import sectors
    for _, fp in sectors.facts_paths(root):
        for r in csv.DictReader(open(fp, encoding="utf-8")):
            facts[r["fact_id"]] = r
    names = {r["metric_code"]: r.get("name", "") for r in csv.DictReader(open(os.path.join(root, "config", "metrics.csv"), encoding="utf-8"))}
    out = []
    for t in tr:
        st = t["trace_status"]
        if st not in ("text_statement", "text_other", "ocr_statement", "ocr_other", "later_filing", "pdf_override_confirmed"):
            continue
        f = facts.get(t["fact_id"], {})
        try:
            v = float(f.get("value_original") or f.get("value_sar_m"))
        except (TypeError, ValueError):
            continue
        unit = f.get("unit_original", "")
        ns = [int(round(abs(v)))]
        if unit == "Actuals":
            ns.append(int(round(abs(v) / 1000)))
        if st == "pdf_override_confirmed":
            ns += [int(round(abs(float(f["value_sar_m"]) * 1000))), int(round(abs(float(f["value_sar_m"]))))]
        key = words(f.get("line_item_label", "") + " " + names.get(t["metric_code"], "") + " " + t["metric_code"].replace("_", " "))
        hits, ok = [], False
        for p in [int(x) for x in re.split(r"[,; ]+", t["pages"]) if x.isdigit()][:4]:
            pg = pages_text(os.path.join(arch, t["pdf_used"]))
            txt = pg[p - 1] if 1 <= p <= len(pg) else ""
            ocr = len("".join(txt.split())) < 200
            if ocr:
                txt = ocr_page(cache, t["pdf_used"], p)
            for n in ns:
                if n < 100:
                    continue
                for l in lines_with(txt, n, ocr):
                    hits.append(f"p.{p}: {l.strip()[:160]}")
                    pat = PAT.get(t["metric_code"])
                    if (words(l) & key) or (pat and re.search(pat, l, re.I)):
                        ok = True
            if ok:
                break
        out.append({"fact_id": t["fact_id"], "ticker": t["ticker"], "period": t["period"], "metric_code": t["metric_code"],
                    "trace_status": st, "pdf": t["pdf_used"], "pages": t["pages"], "label": f.get("line_item_label", "")[:120],
                    "label_check": "label_ok" if ok else ("label_unclear" if hits else "line_not_isolated"),
                    "line": hits[0] if hits else ""})
    with open(os.path.join(root, "data", "trace", "label_check.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader(); w.writerows(out)
    print(len(out), "matches checked;", dict(Counter(r["label_check"] for r in out)))
    print("unclear by status:", dict(Counter(r["trace_status"] for r in out if r["label_check"] != "label_ok")))


if __name__ == "__main__":
    main(*sys.argv[1:4])
