# Sector & company financial analysis (2022–2026)

Reusable pipeline for Saudi-listed sector analyses. **Pilots: Energy and Banks.**

| Path | Contents |
|---|---|
| `METHODOLOGY.md` | Rules for periods, units, provenance, like-for-like bridge, sector aggregation, sector metrics, narrative and review standards |
| `config/metrics.csv` | Metric dictionary (definitions, formulas, aggregation rule) |
| `data/*_schema.csv` | Column schemas for the source register, facts table, adjustments register and policy items |
| `data/narratives/` | One YAML per company (template in `templates/`) |
| `data/policy/` | Budget and policy facts (dated, sourced) and impact assessments, kept separate from historical data |
| `build/calc.py` | Calculation engine (growth, CAGR, matched-sample sector growth, contributions, ratios from totals, ROE, LFL bridge) |
| `tests/` | Unit tests for the engine (synthetic inputs only) |
| `output/` | Generated Excel workbook and HTML review interface |

Status: framework drafted; source archive not yet read (Drive folder requires sign-in).
