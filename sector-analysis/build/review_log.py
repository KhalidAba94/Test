"""Merge reviewer issue files with resolutions into data/review_log.csv."""
import csv, glob, os, sys
root = sys.argv[1]
res = {r["issue_id"]: r for r in csv.DictReader(open(os.path.join(root, "data", "review", "resolutions.csv"), encoding="utf-8"))}
area = {"energy_data": "Energy data accuracy", "banks_data": "Banks data accuracy", "policy_review": "Budget & policy reasoning", "html_review": "HTML presentation & usability", "fullreview": "Full review (every figure)"}
out = []
for f in sorted(glob.glob(os.path.join(root, "data", "review", "*_issues.csv"))):
    key = os.path.basename(f).replace("_issues.csv", "")
    for r in csv.DictReader(open(f, encoding="utf-8")):
        iid = r.get("issue_id", "")
        rr = res.get(iid, {})
        loc = " ".join(x for x in (r.get("ticker", ""), r.get("period", ""), r.get("metric", ""), r.get("view", ""), r.get("location", ""))) .strip()
        sev = r.get("severity", "") or r.get("severity(high|medium|low)", "")
        out.append({"issue_id": iid, "review": area.get(key, key), "severity": sev, "where": loc[:120],
                    "finding": r.get("finding", "")[:600], "status": rr.get("status", "open"),
                    "fix": rr.get("fix", ""), "recheck": rr.get("recheck", "")})
with open(os.path.join(root, "data", "review_log.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=["issue_id", "review", "severity", "where", "finding", "status", "fix", "recheck"])
    w.writeheader(); w.writerows(out)
from collections import Counter
print(len(out), "issues;", Counter((o["review"], o["status"]) for o in out))
