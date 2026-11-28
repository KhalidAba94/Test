#!/usr/bin/env bash
# Re-apply overrides and rebuild analytics, workbook and HTML (no re-parsing of the archive).
# Usage: build/rebuild_outputs.sh <work_dir>
set -euo pipefail
WB="${SA_WORKBOOK:-Saudi_Sector_Analysis_Energy_Banks.xlsx}"   # workbook file name
WORK="$1"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="${SA_ROOT:-$(dirname "$HERE")}"   # SA_ROOT: another project root, e.g. sets/seven
python3 "$HERE/merge_parts.py" "$ROOT"
FACTS=()
while read -r S s; do
  [ -f "$WORK/parsed/${s}_facts_located.csv" ] || { echo "skip $S (not built yet)"; continue; }
  python3 "$HERE/derive.py" "$S" "$WORK/parsed/${s}_facts_located.csv" "$ROOT/data/overrides.csv" "$ROOT/data/$s/facts.csv"
  FACTS+=("$ROOT/data/$s/facts.csv")
done < <(python3 "$HERE/sectors.py" "$ROOT" slug)
(cd "$HERE" && python3 analyze.py "$ROOT/config/sectors.json" "$ROOT/data/dataset.json" "${FACTS[@]}")
python3 "$HERE/coverage.py" "$ROOT"
(cd "$HERE" && python3 build_workbook.py "$ROOT" "$ROOT/output/$WB")
python3 "$RECALC" "$ROOT/output/$WB" 300 | head -5
python3 "$HERE/check_workbook.py" "$ROOT" "$ROOT/output/$WB" | tail -3
python3 "$HERE/review_log.py" "$ROOT" | tail -1
if [ -z "${SA_SKIP_WEB:-}" ]; then python3 "$HERE/build_web.py" "$ROOT" "$ROOT/output/index.html" ${ARTIFACT_OUT:-}; fi
