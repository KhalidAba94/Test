#!/usr/bin/env bash
# Re-apply overrides and rebuild analytics, workbook and HTML (no re-parsing of the archive).
# Usage: build/rebuild_outputs.sh <work_dir>
set -euo pipefail
WORK="$1"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
python3 "$HERE/merge_parts.py" "$ROOT"
for S in Energy Banks; do s=$(echo "$S" | tr '[:upper:]' '[:lower:]')
  python3 "$HERE/derive.py" "$S" "$WORK/parsed/${s}_facts_located.csv" "$ROOT/data/overrides.csv" "$ROOT/data/$s/facts.csv"; done
(cd "$HERE" && python3 analyze.py "$ROOT/config/sectors.json" "$ROOT/data/dataset.json" "$ROOT/data/energy/facts.csv" "$ROOT/data/banks/facts.csv")
python3 "$HERE/coverage.py" "$ROOT"
(cd "$HERE" && python3 build_workbook.py "$ROOT" "$ROOT/output/Saudi_Sector_Analysis_Energy_Banks.xlsx")
python3 "$RECALC" "$ROOT/output/Saudi_Sector_Analysis_Energy_Banks.xlsx" 300 | head -5
python3 "$HERE/check_workbook.py" "$ROOT" "$ROOT/output/Saudi_Sector_Analysis_Energy_Banks.xlsx" | tail -3
python3 "$HERE/review_log.py" "$ROOT" | tail -1
python3 "$HERE/build_web.py" "$ROOT" "$ROOT/output/index.html" ${ARTIFACT_OUT:-}
