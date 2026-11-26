# Roll-out plan: all sectors

The archive is final. The coverage index of 26 Nov 2026 (`data/archive_coverage_index.xlsx`) lists 273 Main Market companies in 22 sectors, all on Drive. Collected is not the same as validated: the index's own checks are sample-based.

The Energy (6) and Banks (10) pilots are signed off. The remaining 257 companies are built in waves. Each wave follows `METHODOLOGY.md` and the 27 template changes, including the full trace of every figure. Each wave is added to the same workbook, HTML and deck, so the all-sector presentation grows wave by wave.

## Waves

| Wave | Sectors | Companies | Template | Known issues from the index |
|---|---|---|---|---|
| 1 | Telecommunication Services, Utilities | 4 + 6 | corporate | One telecom has a 31 Mar year-end; one utility has scanned PDFs |
| 2 | Materials | 49 | corporate | 17 with scanned PDFs; one Sep and one Mar year-end; Luberef (from Energy) |
| 3 | Capital Goods, Transportation, Commercial & Professional Services | 18 + 9 + 7 | corporate | OGC moved from Nomu (Jul 2025); two Capital Goods period checks unresolved |
| 4 | Consumer Discretionary Distribution & Retail, Consumer Durables & Apparel, Consumer Services, Media and Entertainment | 12 + 5 + 19 + 4 | corporate | Aldrees (from Energy, Sep 2025); July and March year-ends |
| 5 | Consumer Staples Distribution & Retail, Food & Beverages, Household & Personal Products | 8 + 22 + 1 | corporate | SADAFCO year-end change (short 9-month 2023); NOFOTH moved from Nomu (Jan 2026) |
| 6 | Health Care Equipment & Services, Pharma, Biotech & Life Sciences, Software & Services | 12 + 3 + 7 | corporate | CMCER and AZM moved from Nomu; AZM has a 30 Jun year-end |
| 7 | Real Estate Management & Development, REITs | 16 + 19 | corporate; REIT | REIT PDFs may be fund reports, not full statements; several scanned annuals |
| 8 | Financial Services, Insurance | 10 + 26 | financial services; insurance (IFRS 17) | Insurance XBRL is about four years stale, so 2023–2026 must come from the PDFs |

## Templates

- **corporate**: the Energy template. Revenue, gross profit, EBITDA (calculated, IFRS 16 basis), operating income, net profit, operating cash flow, capex, free cash flow and net debt, plus sector-specific operating measures where filed.
- **bank**: the Banks template.
- **REIT**: rental income, funds from operations, net asset value per unit, distributions and leverage.
- **insurance**: IFRS 17 insurance revenue, insurance service result, net investment result, combined ratio where it can be derived, and solvency where disclosed.
- **financial services**: by business model (exchange, asset managers and brokers, finance companies); the bank-style or corporate-style lines are used per company and labelled.

## Non-December year-ends and transfers from Nomu

Fiscal years are kept as filed and labelled by their period end. Sector totals use each company's fiscal year that ends within the calendar year, and the 9M figures use the nine months to the latest quarter end. Each mismatch is flagged on the company page. Companies that moved from Nomu are included in every period (constant universe); their pre-transfer Nomu filings are used and labelled as such.
