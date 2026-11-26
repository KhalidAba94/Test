# Verification notes: budget and policy fact base (Energy and Banks)

As of 2026-11-25. Companion to `items.csv` (146 items after the review rounds; counts below describe the 2026-11-25 pass of 138 items). Facts only; no impact interpretation.

## 1. Scope and method

- **Inputs:**
  - `fiscal_facts.md` (F-xxx): 106 items, mostly read from MoF, SPA and NDMC documents.
  - `sector_policy_facts.md` (E-xxx, B-xxx): 92 items, all from search extracts (read_primary = N).
- **Output:** 49 F, 48 E, 26 B and 15 new V items. Duplicates and trivia were merged into the notes of the item that kept the fact (each note says "Merged X").
- **Meaning of `read_primary`:**
  - **Y** means I opened the primary document myself in this pass (2026-11-25) and checked the key figures against it.
  - For the 49 F items kept, every figure check matched the source. A full-SAR versus SAR bn formatting difference was resolved by reading the text.
  - Secondary articles I read in full are still read_primary = N, and the note says "article read".
- **Result:** 83 of 138 items have read_primary = Y; 97 are tagged primary.
- **Access:**
  - Fetched directly with curl: spa.gov.sa, sama.gov.sa (needs HTTP/1.1 and browser headers), mof.gov.sa, ndmc.gov.sa, stats.gov.sa, argaam.com, arabnews.com, saudigazette.com.sa, zawya.com and english.aawsat.com.
  - WebFetch failed with DNS errors on opec.org and eia.gov. Per the tool's guidance I stopped trying other non-allowlisted hosts (iea.org, aramco.com, cma.org.sa, saudiexchange.sa, rulebook.sama.gov.sa, src.sa and portalcdn.spa.gov.sa). Facts from those hosts come from WebSearch extracts and are marked read_primary = N.
  - To read them, these hosts must be added to the session's network settings.

## 2. What was verified against primary sources (read_primary = Y)

**Conflict timeline (SPA, MoE, MOFA, Cabinet)**
- Crisis start "February 28, 2026": Minister of Finance at Budget Forum, SPA N2736002 (E-011).
- Ras Tanura:
  - 2 Mar, limited fire from debris of 2 intercepted drones (SPA N2526213, E-013).
  - 4 Mar, attempted drone attack with no damage (SPA N2528037, V-001).
- 9 Apr MoE statement (E-015):
  - East-West Pipeline pumping station hit, about 700 kb/d of throughput lost.
  - Manifa and Khurais each lost 300 kb/d of capacity.
  - Refineries hit: SATORP, Ras Tanura, SAMREF and Riyadh.
- 12 Apr: East-West Pipeline back to about 7 mb/d and Manifa restored; Khurais still pending (E-016).
- 8 Sep: southern-region facilities attacked (E-019).
- 10 Sep: East-West Pipeline attacks and shutdown; MOFA says the drones were launched from Iraq (E-020).
- 13 Oct: Cabinet commended the restored pipeline flows (V-004).
- 13 Oct: Aramco Dhahran administrative building hit (V-005).
- 5 Oct: MOFA statement on Houthi targeting of Saudi cities and vessels (V-003).

**OPEC+**
- SPA texts of the decisions of 1 Mar, 5 Apr, 5 Jul and 6 Sep 2026 (E-032 to E-035).
- The country tables are images on portalcdn.spa.gov.sa, which is unreachable. Saudi required levels therefore remain secondary.

**Aramco (SPA)**
- MSC directive of 30 Jan 2024 (E-042).
- FY2025 results on 10 Mar 2026 (E-052).
- Q1 2026 results on 10 May (E-045).
- Q2 2026 results on 4 Aug (V-008).
- Gas strategy release of 26 Feb 2026 (E-046).
- Q3 2025 performance-linked dividend (cited in E-051).
- Energy Minister at the WPC Congress: East-West Pipeline throughput to about 10 mb/d "in the coming years" (E-043).

**SAMA**
- Rate releases: 22 Mar 2023; 18 Sep and 18 Dec 2024; 17 Sep, 29 Oct and 10 Dec 2025; 16 Sep 2026 (B-002 to B-005).
- I read every SAMA news page from news-1100 to news-1176 (15 Sep 2025 to 23 Nov 2026). They contain no liquidity facility, injection or CCyB release (B-021).
- Key Economic Developments Q1 2026: deposits, credit, M3 and real-estate loans (V-012, V-013).
- FSR 2025: NPL, CAR, LCR, NSFR and the CCyB footnote (B-015, B-018).

**MoF**
- FY2027 Budget Statement:
  - Brent futures averaged USD 88.74 in Jan–Sep 2026; September was 102.02 (V-006).
  - Oil supply averaged 7.9 mb/d in Jan–Sep, down 15% (F-053).
  - Banking section: credit up 7.3%, private credit up 6.2%, real estate 12.4% of credit, NPL 1.0%, CAR 20.9% (F-093).
  - Tariff and subsidy reform (F-055).
- Pre-Budget Statement; Q1, Q2 and Q3 reports; FY2026 Budget Statement; NDMC ABP 2026; NDMC notices.

**Other**
- GASTAT: Q2 2026 GDP publication (E-008); Q3 flash headline of -3.8% on the GASTAT homepage (E-009).
- CMA opening to all foreign investors from 1 Feb 2026 (SPA N2483007, B-024).
- Non-Saudi property law in force from 22 Jan 2026 (SPA N2496274, B-031).
- Riyadh land measures of 29 Mar 2025 (SPA Arabic text, B-029).
- Royal Order on citizen support, 25 Oct 2026 (F-097).
- Saudi Energy tariff announcement, 25 Oct 2026 (E-050).

## 3. Corrections to the earlier notes

| id | earlier note | verified / corrected |
|---|---|---|
| E-013 | Ras Tanura 2 Mar cited SPA N2528037 | N2528037 is a **separate 4 Mar** attempted attack (now V-001). The 2 Mar item is SPA N2526213. |
| B-002 | SAMA news-836 cited for the July 2023 hike | news-836 is the **22 Mar 2023** hike to 5.50%. The July 2023 hike to 6.00% comes from Argaam. |
| B-004 | Sep 2025 cut "exact day not verified" | **17 Sep 2025** to 4.75%/4.25% (SAMA news-1108). |
| E-052 | Aramco FY2025 results "exact day NOT FOUND" | **10 Mar 2026** (SPA N2532901). |
| E-051 | "No PLD for FY2025 found" | A PLD **was** paid in 2025: Q3 2025 USD 0.2bn (SPA N2435663); Q1 2025 USD 0.219bn (secondary). |
| E-034 | Saudi August 2026 target "about 10.4 mb/d" | **10.416 mb/d** (search extracts, two outlets). Consistent with 10.478 from September. |
| E-040 | 2026 YTD Brent NOT FOUND; March and July missing | EIA spot: Jan 67, Mar 103, Jul about 84 (derived). Jan–Oct average about **96.3 (derived)**. Official MoF YTD figure is Brent futures, 88.74 for Jan–Sep (V-006). |
| E-039 | 2025 Brent 69 | 69.04 (EIA finance table, search extract). |
| E-047 | 44.1 GW; "50% of generation" | **44.2 GW** under development; SPA says about 50% of generation **capacity**. |
| E-055 | Petro Rabigh completion date conflicting | Completed **9 Oct 2025** (Aramco Tadawul statement via Argaam). |
| E-056 | Arabian Drilling "Q2 revenue impact SAR 122m" | Not found. The CEO guided Q2 revenue **down 12% q/q**. On **12 Aug** notices came to resume all remaining offshore rigs, with 100% utilisation expected by end-Q3. |
| V-002 | Bahri hit "23/24 Aug" | **24 Aug 2026**, VLCC AMZAN, crew safe (Bahri statement via Argaam). |
| B-011 | 2024 mortgages SAR 93.6bn; 2025 total NOT FOUND | 2024 **SAR 91.07bn** (Argaam's SAMA table). 2025 **SAR 80.4bn (-12%)**. |
| B-026 | Bank sukuk about SAR 30.75bn (MEO) | **SAR 34.5bn (USD 9.20bn)** to 19 Sep 2026 (Argaam, read). |
| B-028 | Rent-freeze scope conflict | Both articles read: covers **residential and commercial**, **existing and new** contracts, in Riyadh's urban boundary, from 25 Sep 2025. |
| B-031 | Effective 21 or 22 Jan 2026 | **22 Jan 2026** (REGA via SPA). |
| B-021 | No SAMA liquidity measure found (secondary) | Now confirmed from **SAMA's own press releases** to 23 Nov 2026 (primary). |
| F-093 | Banking context | Added from the same page: real estate 12.4% of credit (+15.2%), utilities credit +25.6%, personal loans SAR 1.47tn. |

## 4. Still unverified (kept, read_primary = N)

The note "unverified – single secondary source" is used where only one secondary source exists:
- **Events:**
  - IEA's 2.5 mb/d offshore shut-in (E-012).
  - SAMREF hit on 19 Mar (date only; the attack itself is confirmed by the MoE on 9 Apr).
  - Ras Tanura restart about 13 Mar.
  - 9 Aug Jazan fire.
  - 25 Nov 2026 Ras Tanura drone attack; no Saudi or Aramco statement found (E-021).
  - Seatrade's "4 Bahri vessels attacked, 2 deaths".
  - Pipeline bypass of 1.2 mb/d (E-044).
- **Prices and markets:**
  - Arab Light OSPs (E-041).
  - IEA's October Gulf flows (E-023).
  - Gasoline prices (E-048).
  - 2026 ethane and methane prices (E-049).
  - All 3M SAIBOR data points (B-006).
  - SAMA-measure LDR of 83.24% (B-012).
  - Previous electricity tariffs (F-098).
- **Aramco:** FY2026 capex guidance "held at USD 50–55bn incl. restoration and HUMAIN" (E-053).
- **Search extracts of primary data** (opec.org, eia.gov, iea.org, rulebook, src.sa not reachable):
  - OPEC MOMR production series (E-036 to E-038).
  - OPEC decisions before 2026 (E-029 to E-031) and the 1 Nov 2026 decision (V-007).
  - EIA prices (E-039, E-040, E-057).
  - Basel III and mortgage risk weights (B-017).
  - SRC (B-027).
- **Secondary only:** JODI exports (E-022; the earlier Zawya URL now returns 404).
- **Not found:**
  - 3M SAIBOR in Nov 2026 and year-end 2022–2025 levels.
  - SAMA monthly bulletin for Sep and Oct 2026. Bulletin URLs return 404 since SAMA relaunched its website on 30 Apr 2026, and the October bulletin is due 29 Nov.
  - End-2025 total deposits and private credit (derived only).
  - Khurais restoration completion.
  - December 2026 OSP.
  - CMA 49%/10% caps in a primary text.
  - SEC tariff attachment (blocked CDN).

## 5. Conflicts between sources (not resolved unless stated)

1. **Brent basis.**
   - MoF uses Brent futures: PBS USD 87 for Jan–Aug, up 23.9%. Budget Statement USD 88.74 for Jan–Sep and Sep 102.02.
   - EIA uses spot, which is higher (Sep 114; Apr 117 against the MoF monthly maximum of 103.7 in Jan–Aug).
   - The Budget Statement also says USD 90.7 for Jan–Aug, up 27.2% (p.28), which conflicts with the PBS figure of 87.
2. **Oil supply in MoF documents.** Jan–Aug is 7.9 mb/d in the PBS but 7.8 mb/d (-15.4%) on p.28 of the Budget Statement. Jan–Sep is 7.9 mb/d.
3. **East-West Pipeline capacity.** The MoE and Aramco say 7 mb/d; the SAMA Governor (Istanbul, 8 Oct) said about 5.8 mb/d (B-023).
4. **Saudi production series.** For October 2026, OPEC secondary sources give 9.19 mb/d; Saudi direct communication gives 10.563 mb/d (supply to market 9.203). JODI March–May production matches direct communication.
5. **Government deposits.**
   - The Minister says government deposits with SAMA were kept at SAR 399bn (F-061, F-049).
   - Fitch says government-entity deposits at SAMA were about SAR 370bn at end-September, near a five-year low (B-013).
   - The definitions differ.
6. **Reserve assets in H1 2026.** The Minister gives SAR 1.7tn; the Budget Statement gives SAR 1.85tn of "total foreign reserve assets".
7. **2026 non-oil growth.** 2.5% in the Budget Statement, the Crown Prince's statement and the SPA presser; 2.3% in the MoF English release. 2027 GDP: 10.9% in the documents against the Minister's rounded "10%".
8. **Real-estate share of credit.** SAMA KED gives "real estate loans" at 28.9% of bank credit, including retail mortgages. MoF gives "real estate activities" at 12.4% of credit. These are different classifications.
9. **Loan-to-deposit ratio.** The SAMA regulatory measure is below 85–90%; simple loans to deposits is 106–113%.
10. **ADES Saudi rigs.** The ADES CEO said in August that notices had come to resume 2 Saudi offshore rigs; AGBI (search only) says all Saudi offshore rigs were back in operation.
11. **Q3 2026 deposits.** Fitch gives -1.8% q/q; Fitch's Lopatin, quoted by Asharq Al-Awsat, gives about -1.5%. A July 2026 report of SAR 3.11tn is not re-checked against the September figure of 3.076tn.

## 6. Final vs preliminary (as tagged in `item_class`)

- **FY2026 final budget** (FINAL_BUDGET, 2025-12-02): F-001, F-011.
- **FY2027 Pre-Budget Statement** (PRE_BUDGET_STATEMENT, 2026-09-30, preliminary): F-023, F-028, F-030, F-031, F-032. Each note says which final item supersedes it.
- **FY2027 final budget** (FINAL_BUDGET, 2026-11-24): F-040 to F-056, F-093, V-006.

## 7. Upcoming items that may change the picture

- OPEC+ ministerial meeting on 2026-11-29: 2027 baselines and capacity-audit results, and whether the group-wide cuts expire at end-2026.
- SAMA October 2026 bulletin, due 2026-11-29.
- FOMC on 2026-12-09, a likely trigger for a SAMA rate decision.
- NDMC Annual Borrowing Plan 2027, expected around end-Dec 2026.
- Electricity and water tariffs take effect on 2027-01-01.
- J.P. Morgan GBI-EM inclusion of SAR sukuk from 2027-01-29.
