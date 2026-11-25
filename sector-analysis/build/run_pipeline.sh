#!/usr/bin/env bash
# Rebuild all data for the pilot sectors from the downloaded archive.
# Usage: build/run_pipeline.sh <work_dir_with_archive>   (archive/<Sector>/<company_dir>/ files)
set -euo pipefail
WORK="$1"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
mkdir -p "$WORK/parsed" "$ROOT/data/energy" "$ROOT/data/banks"
for S in Energy Banks; do
  s=$(echo "$S" | tr '[:upper:]' '[:lower:]')
  python3 "$HERE/parse_xbrl_xls.py" "$WORK/archive/$S" "$WORK/parsed/${s}_xbrl.csv" "$WORK/parsed/${s}_meta.csv"
  python3 "$HERE/extract_facts.py" "$WORK/parsed/${s}_xbrl.csv" "$WORK/parsed/${s}_meta.csv" "$ROOT/config/mapping_${s}.json" "$WORK/parsed/${s}_candidates.csv"
  if [ "$S" = "Banks" ]; then
    (cd "$HERE" && python3 bank_is.py "$WORK/parsed/banks_xbrl.csv" "$WORK/parsed/banks_meta.csv" "$WORK/parsed/banks_is_candidates.csv")
    python3 - "$WORK" <<'PY'
import sys, pandas as pd
w=sys.argv[1]
a=pd.read_csv(f'{w}/parsed/banks_candidates.csv'); b=pd.read_csv(f'{w}/parsed/banks_is_candidates.csv')
a=a[~a.metric_code.isin(['FEES','FEES_GROSS_IN','FEES_GROSS_OUT','OTHER_GA','IMPAIR_FIN','IMPAIR_OTH'])]
pd.concat([a,b.drop(columns=['check'])]).to_csv(f'{w}/parsed/banks_candidates.csv', index=False)
PY
  fi
  python3 "$HERE/select_facts.py" "$WORK/parsed/${s}_candidates.csv" "$S" "$WORK/parsed/${s}_facts_xbrl.csv" "$ROOT/data/$s/cross_document_checks.csv"
  python3 "$HERE/pdf_locate.py" "$WORK/archive/$S" "$WORK/parsed/${s}_facts_xbrl.csv" "$WORK/parsed/${s}_facts_located.csv"
  python3 "$HERE/derive.py" "$S" "$WORK/parsed/${s}_facts_located.csv" "$ROOT/data/overrides.csv" "$ROOT/data/$s/facts.csv"
  python3 "$HERE/source_register.py" "$WORK/archive/$S" "$S" "$WORK/parsed/${s}_meta.csv" "$ROOT/data/$s/sources.csv" "$ROOT/data/$s/coverage_documents.csv"
done
(cd "$HERE" && python3 analyze.py "$ROOT/config/sectors.json" "$ROOT/data/dataset.json" "$ROOT/data/energy/facts.csv" "$ROOT/data/banks/facts.csv")
