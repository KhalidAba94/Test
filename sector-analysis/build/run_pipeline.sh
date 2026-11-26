#!/usr/bin/env bash
# Rebuild data for the configured sectors (config/sectors.json) from the downloaded archive.
# Usage: build/run_pipeline.sh <work_dir_with_archive> [sector keys...]   (archive/<archive folder>/<company_dir>/ files)
set -euo pipefail
WORK="$1"; HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="${SA_ROOT:-$(dirname "$HERE")}"   # SA_ROOT: another project root, e.g. sets/seven
python3 "$HERE/merge_parts.py" "$ROOT"
mkdir -p "$WORK/parsed"
# sectors from config/sectors.json (key, slug, template, archive folder); pass sector keys as extra arguments to build only those
ONLY="${*:2}"
while read -r S s; do
  if [ -n "$ONLY" ] && ! [[ " $ONLY " == *" $S "* ]]; then continue; fi
  A=$(python3 "$HERE/sectors.py" "$ROOT" archive | awk -v k="$S" '$1==k{print $2}')
  T=$(python3 "$HERE/sectors.py" "$ROOT" template | awk -v k="$S" '$1==k{print $2}')
  [ -d "$WORK/archive/$A" ] || { echo "skip $S: no archive folder $A"; continue; }
  mkdir -p "$ROOT/data/$s"
  if ! ls "$WORK/archive/$A"/*/*.xls >/dev/null 2>&1; then
    # no XBRL in the archive (e.g. REIT fund reports): every figure comes from the PDFs via overrides
    echo "fact_id,sector,ticker,company,period,period_end,period_months,metric_code,value_sar_m,value_original,unit_original,currency_original,provenance,source_id,location,line_item_label,reported_in_filing,original_value,original_source,assurance,n_documents,pdf_file,pdf_status,pdf_pages" > "$WORK/parsed/${s}_facts_located.csv"
    echo "company_dir,file,entity_name,symbol,isin,sector,industry_group,period_covered,start,end,start_comparative,end_comparative,nature,status,currency,rounding,is_method,n_values,read_note,parse_error" > "$WORK/parsed/${s}_meta.csv"
    python3 "$HERE/derive.py" "$S" "$WORK/parsed/${s}_facts_located.csv" "$ROOT/data/overrides.csv" "$ROOT/data/$s/facts.csv"
    python3 "$HERE/source_register.py" "$WORK/archive/$A" "$S" "$WORK/parsed/${s}_meta.csv" "$ROOT/data/$s/sources.csv" "$ROOT/data/$s/coverage_documents.csv"
    continue
  fi
  python3 "$HERE/parse_xbrl_xls.py" "$WORK/archive/$A" "$WORK/parsed/${s}_xbrl.csv" "$WORK/parsed/${s}_meta.csv"
  python3 "$HERE/extract_facts.py" "$WORK/parsed/${s}_xbrl.csv" "$WORK/parsed/${s}_meta.csv" "$ROOT/config/mapping_$( [ -f "$ROOT/config/mapping_${s}.json" ] && echo "$s" || echo "$T" ).json" "$WORK/parsed/${s}_candidates.csv"
  if [ "$T" = "bank" ]; then
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
  python3 "$HERE/pdf_locate.py" "$WORK/archive/$A" "$WORK/parsed/${s}_facts_xbrl.csv" "$WORK/parsed/${s}_facts_located.csv"
  python3 "$HERE/derive.py" "$S" "$WORK/parsed/${s}_facts_located.csv" "$ROOT/data/overrides.csv" "$ROOT/data/$s/facts.csv"
  python3 "$HERE/source_register.py" "$WORK/archive/$A" "$S" "$WORK/parsed/${s}_meta.csv" "$ROOT/data/$s/sources.csv" "$ROOT/data/$s/coverage_documents.csv"
done < <(python3 "$HERE/sectors.py" "$ROOT" slug)
FACTS=(); while read -r S s; do [ -f "$ROOT/data/$s/facts.csv" ] && FACTS+=("$ROOT/data/$s/facts.csv"); done < <(python3 "$HERE/sectors.py" "$ROOT" slug)
(cd "$HERE" && python3 analyze.py "$ROOT/config/sectors.json" "$ROOT/data/dataset.json" "${FACTS[@]}")
