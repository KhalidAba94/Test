"""Build the HTML review interface (single self-contained page) from the dataset.

Usage: python build_web.py <root_dir> <out.html> [<artifact_body.html>]

<out.html> is a standalone document (doctype, charset and viewport added).
The optional third path receives the same page without the document head,
for hosts that wrap the page in their own skeleton.
The build fails if any reference chip in the narratives or the budget section
does not resolve (see check_narratives.py).
"""
from __future__ import annotations

import csv
import glob
import json
import os
import re
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import check_narratives  # noqa: E402

REF_RE = re.compile(r"^(\d{4})-(FY20\d\d|9M20\d\d)-([A-Z0-9_]+)$")
# inputs shown in the source drawer for calculated (C) figures
CALC_INPUTS = {
    "OPINC": ["PBT", "FIN_COST", "FIN_INC", "SHARE_JV"], "EBITDA_C": ["OPINC", "DA_CF", "IMPAIR_CF"],
    "EBITDA_U": ["EBITDA_C"], "FCF": ["CFO", "CAPEX"], "REV_M": ["REV", "OIRS"], "EQ_ORD": ["EQ_ATTR", "T1_SUKUK"],
    "PPOP": ["TOI", "OPEX_PRE"], "OTHER_OI": ["TOI", "NSCI", "FEES_NET"], "EQ_ATTR": ["TE"], "NI_ATTR": ["NI"],
}
STANDALONE_HEAD = ('<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n'
                   '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')


def load_csv(p):
    return list(csv.DictReader(open(p, encoding="utf-8"))) if os.path.exists(p) else []


def load_yaml(p):
    return (yaml.safe_load(open(p, encoding="utf-8")) or {}) if os.path.exists(p) else {}


def r6(x):
    if isinstance(x, float):
        return round(x, 6)
    return x


def compact(o):
    if isinstance(o, dict):
        return {k: compact(v) for k, v in o.items()}
    if isinstance(o, list):
        return [compact(v) for v in o]
    return r6(o)


def fact_obj(r):
    num = lambda x: None if x in ("", None) else float(x)
    return {"v": num(r["value_sar_m"]), "prov": r["provenance"], "src": r["source_id"], "loc": r["location"],
            "pdf": r.get("pdf_file", ""), "pages": r.get("pdf_pages", ""), "label": r.get("line_item_label", ""),
            "orig": num(r.get("original_value")), "note": r.get("note", ""), "trace": r.get("trace_status", ""),
            "review": r.get("review", ""), "supporting": True}


def main(root, out, body_out=None):
    if check_narratives.main(root):
        sys.exit("build_web: unresolved reference chips (see above); fix the narratives or add the facts")
    ds = json.load(open(os.path.join(root, "data", "dataset.json")))
    metrics = {m["metric_code"]: {"name": m["name"], "def": m["definition"], "unit": m["unit"], "formula": m.get("formula", "")}
               for m in load_csv(os.path.join(root, "config", "metrics.csv"))}
    import sectors
    SEC = [s for s in sectors.load(root) if s["key"] in ds]
    srcs = {}
    for s in [x["slug"] for x in SEC]:
        sp = os.path.join(root, "data", s, "sources.csv")
        for r in (load_csv(sp) if os.path.exists(sp) else []):
            srcs[r["source_id"]] = {"url": r.get("exchange_url", ""), "type": r.get("doc_type", ""),
                                   "assurance": r.get("assurance", ""), "status": r.get("status", ""),
                                   "reason": r.get("status_reason", ""), "pages": r.get("pages", ""),
                                   "entity": r.get("company_named_in_file", ""), "end": r.get("period_end", "")}
    # supporting facts: referenced in narratives or inputs to calculated figures, but not in the company series
    facts = {}
    for f in glob.glob(os.path.join(root, "data", "*", "facts.csv")):
        for r in csv.DictReader(open(f, encoding="utf-8")):
            if r["value_sar_m"] not in ("", None):
                facts[(r["ticker"], r["period"], r["metric_code"])] = r
    in_series = {(t, p, m) for S in ds.values() for t, c in S["companies"].items() for m, ser in c["series"].items() for p in ser}
    wanted = set()
    narr_files = glob.glob(os.path.join(root, "data", "narratives", "*.yaml")) + [os.path.join(root, "data", "policy", "assessment.yaml")]
    for p in narr_files:
        for ref in check_narratives.collect_refs(load_yaml(p)):
            m = REF_RE.match(ref)
            if m:
                wanted.add((m.group(1), m.group(2), m.group(3)))
    for r in load_csv(os.path.join(root, "data", "policy", "impacts.csv")):
        for ref in re.split(r"[;, ]+", r.get("evidence_item_ids", "")):
            m = REF_RE.match(ref)
            if m:
                wanted.add((m.group(1), m.group(2), m.group(3)))
    for (t, p, m) in in_series:
        for inp in CALC_INPUTS.get(m, []):
            wanted.add((t, p, inp))
    extra = {f"{t}|{p}|{m}": fact_obj(facts[(t, p, m)]) for (t, p, m) in sorted(wanted - in_series) if (t, p, m) in facts}

    # traceability statistics for the disclosed figures shown in company tables
    st = {"figures": 0, "disclosed": 0, "with_page": 0, "with_link": 0, "calculated": 0, "by_method": {}, "reviewed": 0, "review_out": {}}
    PAGED = ("text_statement", "text_other", "ocr_statement", "ocr_other", "components_found", "later_filing", "pdf_override_confirmed", "pdf_override_page", "manual_confirmed")
    for S in ds.values():
        for t, c in S["companies"].items():
            for m, ser in c["series"].items():
                for p, x in ser.items():
                    if p == "FY2021":
                        continue
                    st["figures"] += 1
                    if x["prov"] == "C":
                        st["calculated"] += 1
                        continue
                    st["disclosed"] += 1
                    st["with_page"] += bool(x.get("pages"))
                    k = x.get("trace") or "untraced"
                    if x.get("review", "").startswith(("confirmed", "confirmed_components")) and k in ("not_found", "too_small"):
                        k = "manual_confirmed"
                    st["by_method"][k] = st["by_method"].get(k, 0) + 1
                    if x.get("review"):
                        st["reviewed"] += 1
                        o = x["review"].split(" ")[0]
                        st["review_out"][o] = st["review_out"].get(o, 0) + 1
                    ids = (x.get("src") or "").split(" | ") + [x.get("pdf") or ""]
                    st["with_link"] += any(srcs.get(i, {}).get("url") for i in ids)

    narr = {}
    for t in [t for S in ds for t in ds[S]["tickers"]]:
        narr[t] = load_yaml(os.path.join(root, "data", "narratives", f"{t}.yaml"))
    sector_narr = {s["key"]: load_yaml(os.path.join(root, "data", "narratives", f"sector_{s['slug']}.yaml")) for s in SEC}
    guide = load_yaml(os.path.join(root, "data", "narratives", "guide.yaml"))
    web = {
        "as_of": guide.get("as_of", ""), "guide": guide,
        "sectors": compact(ds), "metrics": metrics, "sources": srcs, "extra": compact(extra), "calc_inputs": CALC_INPUTS,
        "trace": st, "narr": narr, "sector_narr": sector_narr,
        "rollout": json.load(open(os.path.join(root, "config", "rollout.json"))) if os.path.exists(os.path.join(root, "config", "rollout.json")) else {},
        "adjustments": load_csv(os.path.join(root, "data", "adjustments.csv")),
        "coverage": load_csv(os.path.join(root, "data", "coverage.csv")),
        "policy_items": load_csv(os.path.join(root, "data", "policy", "items.csv")),
        "policy_impacts": load_csv(os.path.join(root, "data", "policy", "impacts.csv")),
        "policy_narr": load_yaml(os.path.join(root, "data", "policy", "assessment.yaml")),
        "review": load_csv(os.path.join(root, "data", "review_log.csv")),
        "review_summary": load_yaml(os.path.join(root, "data", "review_summary.yaml")),
        "template_changes": load_csv(os.path.join(root, "data", "template_changes.csv")),
    }
    if not web["review"] or not web["review_summary"]:
        print("WARNING: review log or review summary missing; the 'Sources & review' view will say so")
    payload = json.dumps(web, separators=(",", ":"), default=lambda o: None).replace("</", "<\\/")
    tpl = open(os.path.join(HERE, "web_template.html"), encoding="utf-8").read()
    body = tpl.replace("/*__DATA__*/null", payload)
    open(out, "w", encoding="utf-8").write(STANDALONE_HEAD + body)
    print(f"html -> {out} ({len(body)/1024:.0f} KB); supporting facts: {len(extra)}; "
          f"disclosed figures with PDF page {st['with_page']}/{st['disclosed']}, with link {st['with_link']}/{st['disclosed']}")
    if body_out:   # hosted page: no document head, data in data.json beside the page
        open(body_out, "w", encoding="utf-8").write(tpl)
        open(os.path.join(os.path.dirname(os.path.abspath(body_out)), "data.json"), "w", encoding="utf-8").write(
            json.dumps(web, separators=(",", ":"), default=lambda o: None))
        print(f"artifact body -> {body_out} (+ data.json)")


if __name__ == "__main__":
    main(*sys.argv[1:4])
