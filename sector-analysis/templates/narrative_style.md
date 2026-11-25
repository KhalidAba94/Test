# Narrative standard (company and sector write-ups)

Applies to every sector. A narrative file is `data/narratives/<ticker>.yaml` (company) or
`data/narratives/sector_<sector>.yaml` (sector). Numbers in the narrative must match `data/<sector>/facts.csv`
and `data/dataset.json` exactly (same rounding as the tables: SAR m, whole numbers above 100; percentages to one decimal).

## Rules
1. **Evidence first.** Every sentence with a number or a causal claim carries a source: a fact id from the
   facts table (e.g. `2222-FY2025-REV`) in `refs`, and/or an archive file + page in `source`
   (e.g. `2222_SAUDI_ARAMCO/2025_Annual_filed2026-03-10.pdf p.66`).
2. **Disclosed vs ours.** Say "the company reports/discloses…" for company figures and statements; say "we calculate…" or
   "we estimate…" for our numbers. Management explanations are attributed ("management attributes … to …") and are not
   presented as established fact.
3. **Periods.** Full years are compared with full years; 9M 2026 only with 9M 2025. Always name the period.
4. **Growth language.** "Reported growth" vs "organic" vs "like-for-like (existing business)". Price/rate effects are part of
   like-for-like. Use "not determinable" when the filings do not support a split, and say why in one clause.
5. **One-offs.** Name them with amount, period, P&L line and source; give underlying profit only when every adjusting
   item is identified.
6. **What it means.** 2–4 short sentences: what improved, what weakened, why, what is still uncertain. Each claim must be
   checkable against the tables. No forecasts, recommendations or valuation views.
7. **Plain English.** Short sentences, active voice, no jargon without a definition, no hype.
8. **Confidence.** High / Medium / Low / Not determinable, per the methodology.

## Company YAML fields
```yaml
ticker: "2222"
headline: "One sentence: the single most important thing about this company's 2022–2026 numbers."
lfl_basis:
  definition_used: "How LFL is defined here and why (company-specific differences)."
  perimeter_changes: [ {event, date, effect, source} ]
  capacity_changes: [ {event, date, effect, source} ]
  fx_exposure: "..."
  price_volume_support: "What disclosure allows a price/volume split, or 'not determinable' and why."
  confidence: "High | Medium | Low | Not determinable"
price_volume: [ {period: "9M2026 vs 9M2025", text, basis: "calculated|estimated|disclosed", confidence, source, refs: []} ]
profit_and_margin:
  drivers: [ {period, driver, source, refs: []} ]
  one_offs: [ {item, period, amount_sar_m, line, source} ]
developments: [ {date: "YYYY-MM or YYYY-MM-DD", category: "operations|capacity|M&A|strategy|mix|financing|regulation|event", text, source} ]
what_it_means: {improved, weakened, why, uncertain}
confidence_overall: "High | Medium | Low"
data_notes: [ "restatements, overrides, definitional caveats for this company" ]
```

## Adjustments register (`data/adjustments.csv`)
`adj_id,ticker,comparison,bridge_step,metric_affected,amount_sar_m,basis,method,assumptions,source,page,confidence,notes`
* `comparison` is one of `FY2023/FY2022`, `FY2024/FY2023`, `FY2025/FY2024`, `9M2026/9M2025`.
* `bridge_step` is one of `perimeter`, `fx`, `hyperinflation`, `accounting_other`, `new_capacity`.
* `amount_sar_m` = the step's contribution to the change in the top line (positive if it added to growth).
  Example: an acquisition consolidated from 1 March 2023 contributing SAR 9,428m of FY2023 revenue → `perimeter`, `+9428`
  for `FY2023/FY2022`.
* `basis`: `disclosed` | `calculated` | `estimated` | `not determinable` (amount blank when not determinable).
* Record a row with `basis = none identified` only as a note; absence of rows means no adjustment was identified.

## Sector YAML fields
```yaml
headline: "One or two sentences."
main_changes: [ {change, driver, evidence, refs: []} ]   # pricing, volumes, capacity, acquisitions, mix, market/regulatory
takeaways: {improved, weakened, why, concentration, ytd_2026, uncertain}
data_notes: []
```
