"""Build the HTML review interface (single self-contained page) from the dataset.

Usage: python build_web.py <root_dir> <out.html>
"""
from __future__ import annotations

import csv
import json
import os
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))


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


def main(root, out):
    ds = json.load(open(os.path.join(root, "data", "dataset.json")))
    metrics = {m["metric_code"]: {"name": m["name"], "def": m["definition"], "unit": m["unit"]}
               for m in load_csv(os.path.join(root, "config", "metrics.csv"))}
    srcs = {}
    for s in ("energy", "banks"):
        for r in load_csv(os.path.join(root, "data", s, "sources.csv")):
            srcs[r["source_id"]] = {"url": r.get("exchange_url", ""), "type": r.get("doc_type", ""),
                                   "assurance": r.get("assurance", ""), "status": r.get("status", ""),
                                   "reason": r.get("status_reason", ""), "pages": r.get("pages", ""),
                                   "entity": r.get("company_named_in_file", ""), "end": r.get("period_end", "")}
    narr = {}
    for t in [t for S in ("Energy", "Banks") for t in ds[S]["tickers"]]:
        narr[t] = load_yaml(os.path.join(root, "data", "narratives", f"{t}.yaml"))
    sector_narr = {S: load_yaml(os.path.join(root, "data", "narratives", f"sector_{S.lower()}.yaml")) for S in ("Energy", "Banks")}
    web = {
        "as_of": load_yaml(os.path.join(root, "data", "narratives", "guide.yaml")).get("as_of", ""),
        "guide": load_yaml(os.path.join(root, "data", "narratives", "guide.yaml")),
        "sectors": compact(ds), "metrics": metrics, "sources": srcs, "narr": narr, "sector_narr": sector_narr,
        "adjustments": load_csv(os.path.join(root, "data", "adjustments.csv")),
        "coverage": load_csv(os.path.join(root, "data", "coverage.csv")),
        "policy_items": load_csv(os.path.join(root, "data", "policy", "items.csv")),
        "policy_impacts": load_csv(os.path.join(root, "data", "policy", "impacts.csv")),
        "policy_narr": load_yaml(os.path.join(root, "data", "policy", "assessment.yaml")),
        "review": load_csv(os.path.join(root, "data", "review_log.csv")),
        "review_summary": load_yaml(os.path.join(root, "data", "review_summary.yaml")),
        "template_changes": load_csv(os.path.join(root, "data", "template_changes.csv")),
    }
    payload = json.dumps(web, separators=(",", ":"), default=lambda o: None).replace("</", "<\\/")
    tpl = open(os.path.join(HERE, "web_template.html"), encoding="utf-8").read()
    html = tpl.replace("/*__DATA__*/null", payload)
    open(out, "w", encoding="utf-8").write(html)
    print(f"html -> {out} ({len(html)/1024:.0f} KB)")


if __name__ == "__main__":
    main(*sys.argv[1:3])
