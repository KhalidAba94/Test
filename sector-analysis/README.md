# Sector & company financial analysis (2022–2026)

Reusable pipeline for Saudi-listed sector analyses. **Pilots: Energy (6 companies) and Banks (10 banks)**, FY2022–FY2025 and
9M 2026, built from the Saudi Exchange filings archive (audited/reviewed PDFs plus the exchange's XBRL renderings).

## Deliverables

| File | What it is |
|---|---|
| `output/Saudi_Sector_Analysis_Energy_Banks.xlsx` | Workbook: contents, how to read, definitions, coverage, sector summaries with charts, one sheet per company, budget and policy, adjustments register, data (every figure with file and location), sources, review log, template changes. Live formulas, recalculated. |
| `output/index.html` | Single-file review page (open in any browser): sector and company views, source drawer for every figure, like-for-like bridges, budget and policy section, coverage and review log. |
| `METHODOLOGY.md` | The rules every sector follows (periods, restatements, units, provenance, materiality, LFL bridge, aggregation, narrative and review standards). |

## Folder map

| Path | Contents |
|---|---|
| `config/metrics.csv` | Metric dictionary (definitions, formulas, aggregation rule) |
| `config/sectors.json` | Per-sector top line, ratios, constituents and short names |
| `config/mapping_<sector>.json` | XBRL label → metric mapping |
| `data/<sector>/facts.csv` | One row per company × period × metric, with provenance, source file, location and PDF page |
| `data/<sector>/sources.csv` | Source register: every archive file and the checks done inside it |
| `data/coverage.csv` | Company × period coverage with flags |
| `data/adjustments_parts/`, `data/overrides_parts/` | Like-for-like adjustments and PDF-based corrections per company (merged by `build/merge_parts.py`) |
| `data/one_offs.csv`, `data/restatement_reasons.csv`, `data/source_notes.csv` | One-off register, reasons for restated comparatives, notes on source files |
| `data/narratives/` | One YAML per company plus sector narratives and the how-to-read guide (template in `templates/`) |
| `data/policy/` | Budget and policy fact base (dated, sourced, classed), impact rows and the assessment, kept separate from historical data |
| `data/review/` | Independent reviewers' issues, value checks, rechecks and resolutions; merged into `data/review_log.csv` |
| `data/template_changes.csv` | What the pilots changed in the template before roll-out |
| `build/` | Pipeline scripts (see below) |
| `tests/` | Unit tests for the calculation engine |

## Rebuilding

* Full run from the archive: `build/run_pipeline.sh <work_dir>` (XBRL parsing → mapping → latest-restated selection → PDF page
  location → overrides → derived metrics → source register → analytics).
* Outputs only: `RECALC=<path to recalc.py> build/rebuild_outputs.sh <work_dir>`. This runs merge → derive → analyze → coverage →
  workbook → LibreOffice recalculation → `check_workbook.py` (Excel vs Python, must show 0 mismatches) → review log →
  `build_web.py`. The last step runs `check_narratives.py` and stops if any reference chip does not resolve.
