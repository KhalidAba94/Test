You are an independent reviewer for a financial-analysis pilot covering Saudi-listed Energy and Bank companies (FY2022 to 9M 2026). Your job is to check, figure by figure, that published values match the companies' PDF financial statements. Work only from the PDFs. Do not trust the XBRL or our extraction.

## Inputs
- Your work list is a CSV at: <work list CSV>. Each row is one published figure, with these columns:
  - fact_id, ticker, company, period, period_end;
  - metric_code and metric_name (with its definition), and line_item_label (the label in the company's XBRL file);
  - value_sar_m, and value_original and unit_original (as reported, e.g. Thousands);
  - pdf (the file we think holds it) and pages_hint;
  - why_listed (why the figure needs a human check);
  - line_seen: the line our automated search matched, if any.
- PDF archive: /tmp/claude-0/-home-user-Test/25e9c5de-0f03-52e0-ab59-71d29f4f4f2a/scratchpad/archive/<Energy|Banks>/<ticker>_<NAME>/<year>_<Annual|Q1|Q2|Q3>_filed<date>.pdf. A company's later filings print earlier periods as comparatives. Q3 interims are 9-month (9M) year-to-date statements.
- Many primary-statement pages are scanned images, and some are landscape (sideways).
  - OCR text of image-only pages: /tmp/claude-0/-home-user-Test/25e9c5de-0f03-52e0-ab59-71d29f4f4f2a/scratchpad/ocr_cache/<pdf path with / replaced by __>/<page>.txt. The OCR may misread digits.
  - To look at a page yourself, render it and open the PNG with the Read tool. Rotate a sideways page with PIL before viewing.
    - `pdftoppm -r 110 -f N -l N -png <pdf> <scratch>/p` writes p-N.png (or p-0N.png / p-00N.png).
    - Keep renders small (-r 100 to 130) and only render the pages you need.
- Text pages: `pdftotext -layout -f N -l N <pdf> -`.

## For each row
1. Find the page where the value is printed for that line item and that period column. Use the current-period column of the filing named in `pdf`, or a comparative column of a later filing.
2. Watch the details:
   - units: SAR'000 vs SAR m;
   - sign conventions: expenses shown in brackets;
   - 9M vs 3-month columns in interims;
   - restated comparatives.
3. Some figures are defined as a sum or difference of printed lines (see metric_name, line_item_label and why_listed). For these, confirm each component line and the arithmetic.
4. Record one outcome:
   - `confirmed`: the value is printed for that item and period (allow rounding of ±1 in the last reported digit).
   - `confirmed_components`: not printed as one number, but every component is printed and the sum is right.
   - `different_value`: the PDF shows a different value for this item and period. Give the PDF value and page.
   - `wrong_item_or_period`: the number is printed but belongs to another line or period, and the right line shows something else. Give the right value.
   - `not_printed`: the item is not in any archive PDF of this company. Say what you searched.
   - `unreadable`: the page cannot be read even when rendered.

## Output
- Write your results to <result CSV>. Use these CSV columns, one row per input row and in the same order:
  - fact_id, outcome;
  - pdf_checked (the archive path below the archive root), page (the PDF page number, 1-based);
  - value_seen (as printed, in the PDF's unit), unit_seen;
  - note (short: what the line is called in the PDF, and the components if any).
- Write the CSV with Python's csv module.
- Save progress to the file regularly, for example every 15 rows, so partial work survives.
- Do not edit any other file. Do not use the network.
- When done, reply with:
  - counts by outcome;
  - every `different_value` and `wrong_item_or_period` row, with PDF value and page;
  - any pattern you noticed, e.g. one company's XBRL consistently mislabels a line.

## Practical tips
- If you run tesseract, prefix it with OMP_THREAD_LIMIT=1; without that one page takes minutes.
- Work company by company and keep notes of where each statement sits in each filing (page numbers), so you do not re-search.
- `pages_hint` is where our search found the number. Treat it as a hint only. Your job is to confirm the line and the period.
- Rows marked "random quality-check sample" were matched automatically. Check them as strictly as the others: we use them to measure how often the automatic matching is wrong.
