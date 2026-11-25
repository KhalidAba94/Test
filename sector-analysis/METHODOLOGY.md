# Sector & Company Financial Analysis: Methodology Guide

Version 0.1 (pilot draft, written before the source archive was read). Pilots: **Energy** and **Banks**.
The rules below apply to every sector. A sector may add its own metrics (section 6) but may not change the
core definitions in sections 1–5 without logging the change in `Template_Changes`.

---

## 1. Periods and comparison basis

| Rule | Detail |
|---|---|
| Full years shown | FY2022, FY2023, FY2024, FY2025 (where filed). |
| Partial year | **2026 YTD** is the latest cumulative interim period filed (e.g. 9M to 30 Sep 2026). It is compared **only** with the same 2025 period (e.g. 9M 2025). It is always labelled with its exact months, never just "2026". |
| Never mixed | A partial year is never compared with a full year, never summed with full years, and never used in a multi-year CAGR. |
| CAGR | **2022–2025 CAGR = (FY2025 ÷ FY2022)^(1/3) − 1** (three compounding years). A 2022–2026 CAGR needs full-year 2026 and is shown as "n/a until FY2026 is filed". CAGR is "n.m." (not meaningful) if either end is ≤ 0. |
| Growth | YoY % = current ÷ prior − 1. If the prior value is ≤ 0 or the sign changes, growth is "n.m." and the absolute change is shown instead. |
| Restatements | Each period uses the **latest restated figure**: the comparative column of the most recent filing that presents that period. The originally reported figure is kept in the data, and any difference above 0.5% is flagged `R` with the reason given in the filing. |
| Fiscal year | Companies are expected to have a 31 December year-end. Any other year-end, or a change of year-end, is flagged `FY≠Dec` / `FY-change` in Coverage. A short or long transition period is never compared with a 12-month year. |
| Annualised ratios | Ratios with a balance-sheet denominator (ROE, cost of risk) are annualised for YTD periods (× 12 ÷ months) and labelled "annualised". Income-statement figures are **never** annualised. |

## 2. Units, currency and source hierarchy

* Standard unit: **SAR million**, one decimal place. The original scale (SAR '000, SAR m, USD '000) is recorded per data point.
* USD figures are converted at the SAR/USD peg of **3.75**. The conversion is flagged, and the peg's existence means it is not treated as an FX effect.
* Order of preference for a figure: (1) audited annual financial statements; (2) reviewed interim financial statements; (3) the company's own results announcement or investor presentation (used for operating KPIs and management-defined measures only); (4) anything else, which is used only for context and is labelled.
* Files marked stale or "do not use", or superseded drafts, are excluded and listed in the Source Register with the reason.
* A figure is accepted only after checking **inside the file**: the company name, the period end date, the period length, the currency, the unit and the line-item label. The filename is never relied on.

## 3. Provenance and confidence labels

Every number carries a **provenance flag**:

| Flag | Meaning |
|---|---|
| **D** | Disclosed: as printed in the filing (after unit conversion only). |
| **R** | Restated: a disclosed comparative that differs from the original filing. |
| **C** | Calculated by us from disclosed figures. The formula is shown in the workbook. |
| **E** | Estimated by us using a stated assumption. Never used for headline totals. |
| **—** | Missing or not filed. Shown blank with a reason; **never filled silently**. |

Every adjustment and conclusion carries a **confidence level**:

| Level | Test |
|---|---|
| High | Company-disclosed amount, or simple arithmetic on audited or reviewed figures. |
| Medium | Disclosed inputs combined with one explicit assumption (e.g. annualising an acquired entity's disclosed post-acquisition revenue). |
| Low | Relies on proxies or management commentary without amounts. |
| Not determinable | Disclosure is insufficient. **No number is shown.** |

## 4. Reported vs like-for-like growth

Revenue (Banks: total operating income) growth is bridged in this fixed order. Each step is shown in SAR m and in percentage points of prior-year revenue, so that the steps add up to reported growth.

```
Reported growth
  − Perimeter effect         acquisitions, disposals, (de)consolidation, change in ownership that changes consolidation
  − FX translation effect    only for non-SAR, non-pegged operations; hyperinflation restatement (IAS 29) shown here separately
  − Accounting / other       change in accounting policy or presentation, fiscal-year change, material one-off revenue items
  = Organic growth           (same group, constant currency, same accounting)
  − New-capacity effect      organic expansion: new rigs, vessels, stations, plants, branches commissioned in the comparison window
  = Like-for-like (LFL)      growth of the existing business
        of which price / rate / margin
        of which volume / activity / mix
```

**Definitions**

* **Perimeter effect.** The revenue of an acquired business for the months it was **not** owned in the prior period. Disposals work the other way: the disposed business's prior-period revenue is removed from the base. The source is the acquisition note (IFRS 3 disclosure of post-acquisition revenue) or the segment note. If the company does not disclose the acquired revenue, the effect is "not determinable" and LFL is not shown.
* **New-capacity effect.** Revenue from assets added after the start of the prior period. It is quantified only where the company discloses it, or where an asset-count × rate calculation is possible from disclosed figures (confidence Medium or Low, flagged `E`). Otherwise it is "not determinable" and the organic figure is shown as the closest available measure.
* **Price is not automatically non-organic.** Price, tariff, rate and margin changes in the existing business are part of LFL. They are split from volume only where disclosure supports it (e.g. realised oil price × volumes; average yield × average earning assets).
* **FX.** The SAR is pegged to the USD, so FX is nil for SAR and USD operations. It is computed only for other currencies (e.g. TRY, EGP, PKR, CLP) where segment data allow, by restating current-period revenue at prior-period rates.
* **Company-specific differences** in the LFL basis (e.g. same-station sales for fuel retail, operating-rig days for drillers) are stated in the company sheet under "Adjustment basis".

**One-offs.** Material non-recurring items are listed with amount, line, source and tax/zakat treatment where disclosed. Examples are gains or losses on disposals, impairments, zakat settlements with ZATCA, restructuring, insurance recoveries and hyperinflation monetary gains or losses. Profit is shown **reported** and **underlying** (reported − one-offs). A one-off is labelled as such only when the filing identifies it as non-recurring, or when it is clearly outside normal operations; the reason is recorded.

## 5. Sector aggregation rules

* **Constituents.** The sector is the companies classified in that sector by the Saudi Exchange at the analysis date, cross-checked against the archive folder.
* **Matched sample.** A sector growth rate uses only companies with data in **both** periods. The number of companies in each total is shown next to it. If a company joined the market mid-window (IPO), its pre-IPO figures are used where audited; otherwise it is excluded from that comparison and flagged.
* **Ratios from totals.** Sector ratios are calculated from summed numerators and denominators, **never** by averaging company percentages. For example, sector cost-to-income = Σ operating expenses ÷ Σ operating income.
* **Contribution.** A company's contribution to sector growth = (company change) ÷ (sector prior-period total), in percentage points. Contributions sum to sector growth.
* **Share.** Company share of sector revenue or profit is shown for each year. If some companies are loss-making, profit shares can exceed 100%; the table then also shows the gross total of profit-makers.
* **Concentration view.** Every sector table is shown "All companies" and "Excluding largest". Largest means the company with the highest FY2025 revenue (Banks: total operating income). If a different company is largest by profit, that is stated. The top-1 share and the Herfindahl index (HHI) are also reported.

## 6. Sector-specific metrics

### Banks
| Metric | Definition |
|---|---|
| Total operating income (TOI) | As reported. It is the sum of net special commission (financing) income, fees, FX, trading, investment and other income. The components are checked to sum to it. |
| Net special commission income (NSCI) | Conventional banks: special commission income − expense. Islamic banks report "net income from financing and investments", which is mapped to the same line and flagged. |
| Net fee & commission income | As reported. |
| Operating expenses (pre-impairment) | Total operating expenses **excluding** expected credit loss (ECL) and other impairment charges. Calculated (`C`) where the filing includes impairments in total operating expenses. |
| Cost-to-income | Operating expenses (pre-impairment) ÷ TOI. |
| Pre-provision profit | TOI − operating expenses (pre-impairment). |
| Impairment charge / cost of risk | ECL charge on financing ÷ average net financing (annualised for YTD). |
| Net profit attributable to shareholders | Net income attributable to equity holders of the bank, after zakat and tax. |
| ROE (calculated, comparable) | (Attributable net profit − Tier 1 sukuk distributions) ÷ average equity attributable to ordinary shareholders (total attributable equity − Tier 1 sukuk). The average is (opening + closing) ÷ 2. Bank-reported ROE is shown separately where disclosed, labelled "company definition". |
| NSCI margin (proxy) | NSCI ÷ average total assets. This is a consistent proxy because company NIM definitions differ. |
| Balance-sheet context | Total assets, net financing, customer deposits, loan-to-deposit ratio (net financing ÷ customer deposits). |
| Price / volume of NSCI | Volume = Δ average assets × prior margin; Rate = Δ margin × current average assets (C, Medium). |

### Energy
| Metric | Definition |
|---|---|
| Revenue | As reported. Any company-specific top line (e.g. revenue plus other income related to sales, where a company reports government compensation for regulated domestic prices) is defined on that company's sheet and used consistently. |
| EBITDA | Company-reported where disclosed, with its definition. Sector EBITDA always uses the calculated basis: operating income + depreciation, amortisation and impairment from the cash-flow statement (`C`), so that it is consistent across companies. |
| Operating income, net profit attributable to shareholders | As reported. |
| Margins | Gross, EBITDA, operating and net (attributable net profit ÷ revenue). |
| Capex, operating cash flow, free cash flow | FCF = operating cash flow − capex (C), where both are disclosed. |
| Operating KPIs by sub-industry | Integrated oil & gas: hydrocarbon and crude production, realised price. Drilling: rig count, utilisation, backlog. Shipping: fleet by segment, rates. Refining and base oils: throughput, utilisation, cracks. Fuel retail: stations, volumes. Each is tagged D/C/E with a source. |

## 7. Narrative standard

Each company analysis covers, in this order:

1. Headline figures: FY2022–FY2025 and 2026 YTD vs 2025 YTD.
2. The growth bridge from reported to LFL, with the adjustment basis stated.
3. Profit and margin drivers, including one-offs.
4. Key developments: operations, capacity, M&A, strategy and mix, each dated with a source.
5. **What it means**: 2–4 sentences, each tied to a figure in the tables. It covers what improved, what weakened, why, and what is still uncertain.

Every narrative claim cites the source file and page (or sheet and cell). Statements in management commentary are attributed ("management states …") and are not presented as fact.

## 8. Budget and policy assessment (kept separate)

The forward-looking assessment sits in its own sheet and HTML section. It never feeds historical or LFL calculations. Each item is classified as one of:

* **Confirmed measure or figure**: a final approved budget or an enacted regulation, with the official source and date.
* **Preliminary figure**: for example the pre-budget statement, labelled as preliminary.
* **Policy signal**: a ministerial or official statement, with the speaker, role, date and link.
* **Our interpretation**: impact channel, direction, timing, significance and confidence. These are quantified only where the evidence supports a number.

## 9. Review and audit

Independent reviewers (separate from the builder) re-extract figures from source files and recalculate all derived numbers. They check the like-for-like evidence and partial-year consistency, and challenge conclusions and the budget reasoning. Issues are logged in `Audit_Log` with severity, fix and re-check status. The review summary states the share of figures checked; a sample check is never described as a full audit.
