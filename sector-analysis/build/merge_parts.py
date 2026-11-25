"""Merge per-company part files into data/adjustments.csv and data/overrides.csv (sorted, de-duplicated)."""
import csv, glob, os, sys
root = sys.argv[1]
for name, key in (("adjustments", "adj_id"), ("overrides", None)):
    rows, fields = [], None
    for f in sorted(glob.glob(os.path.join(root, "data", f"{name}_parts", "*.csv"))):
        rd = list(csv.DictReader(open(f, encoding="utf-8")))
        if rd and fields is None:
            fields = list(rd[0].keys())
        rows += rd
    if not rows:
        continue
    seen, out = set(), []
    for r in rows:
        k = r.get(key) if key else (r["ticker"], r["period"], r["metric_code"])
        if k in seen:
            print(f"duplicate {name} key {k} - later part file wins")
            out = [x for x in out if (x.get(key) if key else (x["ticker"], x["period"], x["metric_code"])) != k]
        seen.add(k); out.append(r)
    allf = list(dict.fromkeys([c for r in out for c in r.keys()]))
    with open(os.path.join(root, "data", f"{name}.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=allf, extrasaction="ignore"); w.writeheader(); w.writerows(out)
    print(f"{name}: {len(out)} rows")
