"""Full trace of every published fact to a page of its source PDF.

Usage: python full_trace.py <root_dir> <archive_root> <parsed_dir> <ocr_cache_dir>

Every row of data/<sector>/facts.csv is classified:
  text_statement / text_other  value printed on a text page of the source PDF
                                (statement page or elsewhere, e.g. a note)
  ocr_statement / ocr_other     value read by OCR on an image-only page
  components_found              a fact built from several XBRL lines (e.g. zakat
                                + income tax): every component found in the PDF
  later_filing                  not in the same filing's PDF but printed as a
                                comparative in a later filing of the company
  pdf_override_confirmed        value taken from a PDF page by override; the
                                value was found on that page
  pdf_override_page             override page recorded, value not re-found
                                (e.g. a figure computed from printed lines)
  calculated_ok / calculated_diff  calculated fact recomputed from its inputs
  too_small                     under 100 in the reporting unit (not searchable)
  reconciliation_check          internal check value (label "check: ..."), not a
                                published figure; nonzero differences are listed
  not_found                     needs manual review
Writes data/trace/full_trace.csv and prints a summary.
"""
from __future__ import annotations

import csv
import glob
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date
from functools import lru_cache

STATEMENT_WORDS = re.compile(r"statement of (profit|income|financial position|cash flows|comprehensive)|balance sheet|income statement", re.I)
import sectors as _sectors
SECTOR_DIR = {}   # sector key -> archive folder, filled in main() from config/sectors.json
HOLDING = {"2030"}   # investment holding: investment results kept in operating income (derive.py)


@lru_cache(maxsize=None)
def text_pages(pdf):
    if not os.path.exists(pdf):
        return []
    return subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout.split("\f")


def ocr_pages(cache, rel):
    d = os.path.join(cache, rel.replace("/", "__"))
    out = {}
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.endswith(".txt"):
                out[int(f[:-4])] = open(os.path.join(d, f), encoding="utf-8", errors="ignore").read()
    return out


OCR_NUM = re.compile(r"\d{1,3}(?:[ ,.]{1,2}\d{3})+|\d+")


@lru_cache(maxsize=None)
def ocr_digit_sets(cache, rel):
    res = {}
    for p, t in ocr_pages(cache, rel).items():
        t2 = t.replace("O", "0").replace("o", "0") if False else t
        res[p] = (set(re.sub(r"\D", "", m.group(0)) for m in OCR_NUM.finditer(t2)), bool(STATEMENT_WORDS.search(t[:1500])))
    return res


def variants(v, unit):
    bases = [v]
    if unit == "Actuals":
        bases.append(v / 1000.0)
    if unit == "Thousands":
        bases.append(v * 1000.0)
    out = []
    for b in bases:
        n = int(round(abs(b)))
        if n >= 100:
            out.append(n)
    return out


def find_text(pdf, ns, tol=0):
    st, other = [], []
    for i, pg in enumerate(text_pages(pdf), start=1):
        for n in ns:
            for k in range(-tol, tol + 1):
                s = f"{n + k:,}"
                if re.search(r"(?<![\d,.])" + re.escape(s) + r"(?![\d,]|\.\d)", pg):
                    (st if STATEMENT_WORDS.search(pg[:1500]) else other).append(i)
                    break
            else:
                continue
            break
    return sorted(set(st)), sorted(set(other))


def find_ocr(cache, rel, ns, tol=1):
    st, other = [], []
    for p, (digits, is_stmt) in ocr_digit_sets(cache, rel).items():
        for n in ns:
            if n < 1000:
                continue
            if any(str(n + k) in digits for k in range(-tol, tol + 1)):
                (st if is_stmt else other).append(p)
                break
    return sorted(set(st)), sorted(set(other))


def page_has(arch, cache, rel, page, n):
    """True if the number n is printed on the given page (text layer or OCR, OCR +-1)."""
    pages = text_pages(os.path.join(arch, rel))
    if 1 <= page <= len(pages) and re.search(r"(?<![\d,.])" + re.escape(f"{n:,}") + r"(?![\d,]|\.\d)", pages[page - 1]):
        return True
    dg = ocr_digit_sets(cache, rel).get(page)
    return bool(dg) and any(str(n + k) in dg[0] for k in (-1, 0, 1))


def locate(arch, cache, rel, ns):
    pdf = os.path.join(arch, rel)
    st, ot = find_text(pdf, ns)
    if st:
        return "text_statement", st
    if ot:
        return "text_other", ot
    st, ot = find_text(pdf, ns, tol=1)
    if st or ot:
        return ("text_statement" if st else "text_other"), (st or ot)
    st, ot = find_ocr(cache, rel, ns)
    if st:
        return "ocr_statement", st
    if ot:
        return "ocr_other", ot
    return None, []


def period_bounds(period, end):
    e = date.fromisoformat(end)
    start = date(e.year, 1, 1)
    return start.isoformat(), e.isoformat()


def main(root, arch, parsed, cache):
    SECTOR_DIR.update({s["key"]: s["archive"] for s in _sectors.load(root)})
    xbrl = defaultdict(list)   # (company_dir, file, label) -> rows
    for s in [x["slug"] for x in _sectors.load(root)]:
        p = os.path.join(parsed, f"{s}_xbrl.csv")
        if not os.path.exists(p):
            continue
        for r in csv.DictReader(open(p, encoding="utf-8")):
            if r["value"] not in ("", None):
                xbrl[(r["company_dir"], r["file"], r["label"].strip())].append(r)
    facts = []
    for sector, fp in _sectors.facts_paths(root):
        for r in csv.DictReader(open(fp, encoding="utf-8")):
            r["_sector"] = sector
            facts.append(r)
    idx = {(r["ticker"], r["period"], r["metric_code"]): r for r in facts}
    ecl_notes = {}
    ep = os.path.join(root, "data", "banks", "ecl_loans.csv")
    if os.path.exists(ep):
        for e in csv.DictReader(open(ep, encoding="utf-8")):
            ecl_notes[(e["ticker"], e["period"])] = e
    oneoffs = list(csv.DictReader(open(os.path.join(root, "data", "one_offs.csv"), encoding="utf-8")))
    company_pdfs = defaultdict(list)
    for sector in SECTOR_DIR.values():
        for pdf in glob.glob(os.path.join(arch, sector, "*", "*.pdf")):
            rel = os.path.relpath(pdf, arch)
            company_pdfs[rel.split("/")[1].split("_")[0]].append(rel)
    out = []
    for r in facts:
        sector = r["_sector"]
        prov, note, loc = r["provenance"], r.get("note", ""), r.get("location", "")
        res = {"fact_id": r["fact_id"], "sector": sector, "ticker": r["ticker"], "period": r["period"], "metric_code": r["metric_code"],
               "provenance": prov, "value_sar_m": r["value_sar_m"], "source_id": r["source_id"], "pdf_used": "", "trace_status": "", "pages": "", "detail": ""}
        if r["value_sar_m"] in ("", None):
            res["trace_status"], res["detail"] = "no_value", "fact deliberately left blank (see note)"
            out.append(res)
            continue
        try:
            v = float(r["value_original"]) if r["value_original"] not in ("", None) else float(r["value_sar_m"])
        except ValueError:
            v = None
        unit = r.get("unit_original", "")
        ns = variants(v, unit) if v is not None else []
        if r.get("line_item_label", "").startswith("check:"):
            x = float(r["value_sar_m"])
            res["trace_status"] = "reconciliation_check"
            res["detail"] = r["line_item_label"] + ("; reconciles (0)" if abs(x) < 0.0005 else f"; difference {x:,.3f}")
            out.append(res)
            continue
        if r["metric_code"] == "ECL_LOANS" and (r["ticker"], r["period"]) in ecl_notes:
            en = ecl_notes[(r["ticker"], r["period"])]
            rel = f"Banks/{en['source_pdf']}"
            res["pdf_used"] = rel
            comps = [int(x.replace(",", "")) for x in re.findall(r"(?<![\d.])\d{1,3}(?:,\d{3})+(?![\d])", en["basis_note"])]
            pg = int(en["page"]) if en["page"].isdigit() else None
            on_page = lambda n: pg is not None and any(page_has(arch, cache, rel, q, n) for q in (pg, pg - 1, pg + 1))
            vals = [n for n in variants(float(r["value_sar_m"]) * 1000, "") + ns if n >= 1000]
            if vals and any(on_page(n) for n in vals):
                res["trace_status"], res["pages"], res["detail"] = "text_other", str(pg), "value printed in the credit-risk note"
                out.append(res)
                continue
            # value not printed as such: the main computation (first two figures of the basis note) must be on the page
            comps = [c for c in comps if c >= 1000][:2]
            found = [c for c in comps if on_page(c)]
            miss = [c for c in comps if c not in found]
            if comps and not miss:
                res["trace_status"], res["pages"] = "components_found", str(pg or "")
                res["detail"] = f"computed from note figures {', '.join(f'{c:,}' for c in comps)}, both found on p.{pg}" + ("" if r["provenance"] != "C" else "; derived figure")
            elif r["provenance"] == "C":
                res["trace_status"], res["pages"], res["detail"] = "calculated_rule", str(pg or ""), "derived in data/banks/ecl_loans.csv: " + en["basis_note"][:200]
            else:
                res["trace_status"], res["pages"], res["detail"] = "not_found", str(pg or ""), "note components not all re-found on the stated page: " + ", ".join(f"{c:,}" for c in miss)
            out.append(res)
            continue
        if (prov == "C" or r.get("line_item_label", "").startswith("calc:")) and not note.startswith("OVERRIDE"):
            res["trace_status"] = "calculated"
            res["detail"] = loc
            out.append(res)
            continue
        if note.startswith("OVERRIDE"):
            m = re.search(r"PDF p\.?\s*([\d,\- ]+)", loc)
            pdfs = [s for s in r["source_id"].split(" | ") if s.endswith(".pdf")]
            rel = f"{SECTOR_DIR[sector]}/{pdfs[0]}" if pdfs else ""
            res["pdf_used"] = rel
            if not ns:
                ns = variants(float(r["value_sar_m"]) * 1000, "") + variants(float(r["value_sar_m"]), "")
            else:
                ns = ns + variants(float(r["value_sar_m"]) * 1000, "")
            st, pg = locate(arch, cache, rel, ns) if rel else (None, [])
            given = m.group(1).strip() if m else ""
            if st and (not given or any(str(p) in re.split(r"[ ,\-]+", given) for p in pg)):
                res["trace_status"], res["pages"] = "pdf_override_confirmed", given or ",".join(map(str, pg[:4]))
            elif st:
                res["trace_status"], res["pages"], res["detail"] = "pdf_override_confirmed", ",".join(map(str, pg[:4])), f"recorded page {given}; value found on {','.join(map(str, pg[:4]))}"
            else:
                res["trace_status"], res["pages"], res["detail"] = "pdf_override_page", given, "value not re-found by search (computed from printed lines or OCR-unreadable); page recorded in the override"
            out.append(res)
            continue
        rel = f"{SECTOR_DIR[sector]}/{r['pdf_file']}" if r.get("pdf_file") else ""
        res["pdf_used"] = rel
        if not ns:
            res["trace_status"], res["detail"] = "too_small", "under 100 in the reporting unit; not searchable reliably"
            out.append(res)
            continue
        st, pg = locate(arch, cache, rel, ns) if rel else (None, [])
        if st:
            res["trace_status"], res["pages"] = st, ",".join(map(str, pg[:4]))
            out.append(res)
            continue
        # composite: every component line found
        labels = [l.strip() for l in r.get("line_item_label", "").split(" + ")]
        if len(labels) > 1 and rel:
            comp, xls = r["source_id"].split(" | ")[0].split("/", 1)
            s0, e0 = period_bounds(r["period"], r["period_end"])
            vals = []
            for lab in labels:
                rows = [x for x in xbrl.get((comp, xls, lab), []) if x["end"] == e0 and x["start"] in (s0, "", e0)]
                if rows:
                    vals.append(float(rows[0]["value"]))
            if vals and len(vals) == len(labels):
                found = []
                for cv in vals:
                    if abs(cv) < 100:
                        found.append("small")
                        continue
                    s1, p1 = locate(arch, cache, rel, [int(round(abs(cv)))])
                    found.append(",".join(map(str, p1[:2])) if s1 else None)
                if all(found):
                    res["trace_status"], res["pages"], res["detail"] = "components_found", ";".join(f for f in found if f != "small"), "components: " + " + ".join(labels)
                    out.append(res)
                    continue
        # later filings of the same company (comparative columns)
        yr = int(r["period"][-4:])
        hit = None
        for cand in sorted(company_pdfs.get(r["ticker"], [])):
            fy = int(os.path.basename(cand)[:4])
            if fy < yr or cand == rel:
                continue
            st, pg = locate(arch, cache, cand, ns)
            if st:
                hit = (cand, st, pg)
                break
        if hit:
            res["trace_status"], res["pdf_used"], res["pages"], res["detail"] = "later_filing", hit[0], ",".join(map(str, hit[2][:4])), f"found by {hit[1]} in a later filing"
        else:
            res["trace_status"], res["detail"] = "not_found", "value not printed as such in the archive PDFs (rounding, computed XBRL subtotal, or unreadable scan)"
        out.append(res)

    # calculated facts: recompute from inputs
    F = {
        "PPOP": lambda g: g("TOI") - g("OPEX_PRE"),
        "EQ_ORD": lambda g: g("EQ_ATTR") - (g("T1_SUKUK", 0.0)),
        "OTHER_OI": lambda g: g("TOI") - g("NSCI") - g("FEES_NET"),
        "FCF": lambda g: g("CFO") - g("CAPEX") - g("IP_CAPEX", 0.0),   # owners of let property also deduct investment-property spend
        "CAPEX_TOT": lambda g: g("CAPEX") + g("IP_CAPEX", 0.0),
        "FFO": lambda g: g("NI") + g("DA_CF", 0.0) + g("IMPAIR_CF", 0.0) - g("GAIN_DISP", 0.0),   # REITs
        "NET_DEBT": lambda g: g("DEBT") + g("LEASE_LIAB", 0.0) - g("CASH"),
        "REV_M": lambda g: g("REV") + g("OIRS", 0.0),
        "EBITDA_C": lambda g: g("OPINC") + g("DA_CF", 0.0) + g("IMPAIR_CF", 0.0) - g("FV_IP", 0.0),   # fair-value gains on investment property out
        "OPINC": lambda g: g("PBT") + g("FIN_COST", 0.0) - g("FIN_INC", 0.0) - (0.0 if g.t in HOLDING else g("SHARE_JV", 0.0)),
        "EBITDA_U": lambda g: g("EBITDA_C") - sum(float(o["amount_sar_m"]) * (1 if o["direction"] == "gain" else -1)
                                                  for o in oneoffs if o["ticker"] == g.t and o["period"] == g.p and o["in_metric"] == "OPINC"),
        "EQ_ATTR": lambda g: g("TE"),
        "NI_ATTR": lambda g: g("NI"),
    }
    for res in out:
        if res["trace_status"] != "calculated":
            continue
        fn = F.get(res["metric_code"])
        if not fn:
            res["trace_status"] = "calculated_rule"
            continue
        class G:
            def __init__(s, t, p):
                s.t, s.p = t, p

            def __call__(s, m, default=None):
                x = idx.get((s.t, s.p, m))
                if x is None or x["value_sar_m"] in ("", None):
                    if default is None:
                        raise KeyError(m)
                    return default
                return float(x["value_sar_m"])
        g = G(res["ticker"], res["period"])
        try:
            calc = fn(g)
            ok = abs(calc - float(res["value_sar_m"])) <= max(0.01, abs(calc) * 1e-6)
            res["trace_status"] = "calculated_ok" if ok else "calculated_diff"
            res["detail"] = f"recomputed {calc:,.3f}" + ("" if ok else f" vs stored {float(res['value_sar_m']):,.3f}")
        except KeyError as e:
            res["trace_status"], res["detail"] = "calculated_rule", f"input {e} not stored; rule in derive.py"
    os.makedirs(os.path.join(root, "data", "trace"), exist_ok=True)
    fields = list(out[0].keys())
    with open(os.path.join(root, "data", "trace", "full_trace.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader(); w.writerows(out)
    c = Counter(r["trace_status"] for r in out)
    print(len(out), "facts;", dict(sorted(c.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main(*sys.argv[1:5])
