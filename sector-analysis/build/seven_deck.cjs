// SEVEN priority companies deck (phase 2), built from sets/seven/deck/deck_data.json (figures from the confirmed workbook).
// Usage: NODE_PATH=<dir with pptxgenjs> node build/seven_deck.cjs <deck_data.json> <out.pptx>
// Structure follows the SEVEN benchmark deck: action titles ("Group | message"), summary first, how-to-read,
// one colour-coded table per group with a "What it means" line, then margins, balance sheets, distortions and method.
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const SKILL = "/root/.claude/skills/synced/d460f705-4699-4d5b-b495-db252a0657e2_c6ac2004-2be6-4e40-9791-76746721773d/pptx";
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");

const [, , DATA, OUT] = process.argv;
const D = JSON.parse(fs.readFileSync(DATA, "utf8"));
const ASOF = "FY2022–FY2025 and 9M 2026 · as of 27 November 2026";

const THEME = {
  name: "SEVEN analysis", headFontFace: "Arial", bodyFontFace: "Arial",
  colors: { dk1: "1F2A44", lt1: "FFFFFF", dk2: "1F4E9A", lt2: "F2F2F2", accent1: "2556A3", accent2: "17A2C9", accent3: "1E8E3E",
            accent4: "C62828", accent5: "8A97AB", accent6: "A0175F", hlink: "2556A3", folHlink: "6B4FA0" },
};
const HEX = { navy: "1F4E9A", blue: "2556A3", teal: "17A2C9", green: "1E8E3E", red: "C62828", grey: "555555", ink: "1F2A44",
              muted: "6B7280", line: "C9CED6", gfill: "E8F5EC", rfill: "FCE8E8", nfill: "F7F7F7", cfill: "E8F0FA", lfill: "E3F3FA", plum: "A0175F" };
const CELL_M = [0.03, 0.05, 0.03, 0.06];   // table cell margins, inches

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";   // 13.333 x 7.5 in, as the reference deck
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "SEVEN priority companies: financial performance 2022–2026";
pres.author = "Sector analysis";

// ------------------------------------------------------------------ layouts
pres.defineSlideMaster({
  title: "TITLE", background: { color: "FFFFFF" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 2.0, w: 6.2, h: 2.0, fontSize: 38, color: HEX.blue, align: "left", valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 4.25, w: 6.0, h: 1.7, fontSize: 16, color: HEX.plum, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: "F2F2F2" },
  margin: [0.4, 0.45, 0.5, 0.45],
  slideNumber: { x: 12.55, y: 7.08, w: 0.4, h: 0.25, fontSize: 10, color: HEX.muted, align: "right" },
  objects: [
    { text: { text: ASOF, options: { x: 8.3, y: 0.12, w: 4.6, h: 0.25, fontSize: 10, bold: true, color: HEX.blue, align: "right", margin: 0 } } },
    { placeholder: { options: { name: "title", type: "title", x: 0.45, y: 0.42, w: 12.45, h: 0.55, fontSize: 22, color: HEX.blue, align: "center", valign: "middle", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.45, y: 1.02, w: 12.45, h: 0.32, fontSize: 12, color: HEX.grey, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});

// ------------------------------------------------------------------ helpers
const pct = (v, d = 1) => (typeof v === "number" ? (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d) + "%" : v == null ? "–" : String(v));
const pctPlain = (v, d = 1) => (typeof v === "number" ? (v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(d) + "%" : v == null ? "–" : String(v));
const mult = (v) => (typeof v === "number" ? (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "x" : v == null ? "–" : String(v));
const sar = (v) => (typeof v !== "number" ? "–" : (v < 0 ? "−" : "") + (Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(1)));
const tone = (v) => (typeof v !== "number" ? "n" : v > 0.02 ? "g" : v < -0.02 ? "r" : "n");
const TONE = { g: [HEX.green, HEX.gfill], r: [HEX.red, HEX.rfill], n: [HEX.grey, HEX.nfill] };

function title(slide, head, msg) {
  slide.addText([{ text: head, options: { bold: true, color: HEX.teal } }, { text: "  |  ", options: { color: HEX.teal } }, { text: msg, options: { color: HEX.blue } }],
    { placeholder: "title" });
}
function sub(slide, text) { slide.addText(text, { placeholder: "body" }); }
function foot(slide, text, y = 6.95) {
  slide.addText(text, { x: 0.45, y, w: 11.9, h: 0.42, fontSize: 9, color: HEX.muted, valign: "top", margin: 0, isTextBox: true, objectName: "footnote" });
}
function card(slide, x, y, w, h, head, bullets, accent = HEX.blue, fs = 11.5) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: "FFFFFF" }, line: { color: accent, width: 1.5 }, rectRadius: 0.08, objectName: "card" });
  slide.addText(head, { x: x + 0.18, y: y + 0.1, w: w - 0.36, h: 0.36, fontSize: 15, bold: true, color: accent, margin: 0, isTextBox: true });
  slide.addText(bullets.map((b, i) => ({ text: b, options: { bullet: { indent: 12 }, breakLine: i < bullets.length - 1 } })),
    { x: x + 0.18, y: y + 0.5, w: w - 0.36, h: h - 0.6, fontSize: fs, color: HEX.ink, valign: "top", margin: 0, paraSpaceAfter: 5, isTextBox: true });
}
function chartCard(slide, head) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 1.5, w: 7.55, h: 5.3, fill: { color: "FFFFFF" }, line: { color: HEX.blue, width: 1.5 }, rectRadius: 0.08, objectName: "chart card" });
  slide.addText(head, { x: 0.65, y: 1.6, w: 7.2, h: 0.35, fontSize: 14, bold: true, color: HEX.blue, margin: 0, isTextBox: true });
}
function barOpts(extra) {
  return Object.assign({ x: 0.6, y: 2.0, w: 7.25, h: 4.65, barDir: "bar", barGrouping: "clustered", chartColors: [HEX.blue, HEX.teal],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt", dataLabelColor: HEX.ink,
    catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: HEX.ink, catAxisOrientation: "maxMin", catAxisLabelPos: "low",
    valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt", valAxisLabelColor: HEX.muted,
    valGridLine: { color: "E3E6EA", size: 0.5 }, catGridLine: { style: "none" }, showLegend: true, legendPos: "b", legendFontSize: 10, legendFontFace: "+mn-lt" }, extra);
}
const hdr = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: HEX.blue }, fontSize: 9.5, align: "center", valign: "middle", margin: CELL_M } });
const hdrL = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: HEX.blue }, fontSize: 9.5, align: "left", valign: "middle", margin: CELL_M } });

function growthCell(c) {
  const v = c.v, t = tone(v);
  const [col, fill] = TONE[t];
  const main = v == null ? "–" : typeof v === "number" ? pct(v) : String(v);
  const runs = [{ text: main, options: { bold: true, fontSize: 10.5, color: typeof v === "number" ? col : HEX.muted, breakLine: true } }];
  if (typeof c.a === "number" && typeof c.b === "number") runs.push({ text: `${sar(c.a)} vs ${sar(c.b)}`, options: { fontSize: 7.5, color: HEX.muted } });
  else runs.push({ text: " ", options: { fontSize: 7.5 } });
  return { text: runs, options: { fill: { color: typeof v === "number" ? fill : "FFFFFF" }, align: "center", valign: "middle", margin: CELL_M } };
}
function plainCell(main, subtxt) {
  const runs = [{ text: main, options: { bold: true, fontSize: 10.5, color: HEX.ink, breakLine: !!subtxt } }];
  if (subtxt) runs.push({ text: subtxt, options: { fontSize: 7.5, color: HEX.muted } });
  return { text: runs, options: { fill: { color: "FFFFFF" }, align: "center", valign: "middle", margin: CELL_M } };
}
function nameCell(r) {
  const subtxt = r.total ? r.sub.replace(" · FY2025 revenue ", " · ") : r.sub;
  const runs = [{ text: r.name.replace(": group total", " total"), options: { bold: true, fontSize: 10, color: r.total ? "FFFFFF" : HEX.navy, breakLine: true } },
                { text: subtxt, options: { fontSize: 7.5, color: r.total ? "E8F0FA" : HEX.muted } }];
  return { text: runs, options: { fill: { color: r.total ? HEX.navy : HEX.cfill }, valign: "middle", margin: CELL_M } };
}
function shortBasis(b) {
  if (!b) return "";
  return b.replace(/^Not measurable: (.*) not disclosed$/, "Not measurable ($1 not disclosed)")
          .replace("No acquisitions, FX or accounting effects", "No acquisitions, FX or accounting effects found");
}
function adjCells(r) {
  const a = r.adj || {};
  if (r.total) return [{ text: "", options: { fill: { color: HEX.lfill } } }, { text: "", options: { fill: { color: "FFFFFF" } } }];
  let main;
  if (typeof a.v === "number") main = [{ text: pct(a.v), options: { bold: true, fontSize: 10.5, color: TONE[tone(a.v)][0], breakLine: true } },
                                       { text: `${a.label}; reported ${pct(a.rep)}`, options: { fontSize: 7.5, color: HEX.muted } }];
  else if (a.v === "= reported") main = [{ text: "= reported", options: { bold: true, fontSize: 9.5, color: HEX.blue, breakLine: true } },
                                         { text: "9M 2026", options: { fontSize: 7.5, color: HEX.muted } }];
  else main = [{ text: "–", options: { fontSize: 10.5, color: HEX.muted } }];
  return [{ text: main, options: { fill: { color: HEX.lfill }, align: "center", valign: "middle", margin: CELL_M } },
          { text: shortBasis(a.basis), options: { fontSize: 8, color: HEX.ink, fill: { color: "FFFFFF" }, valign: "middle", margin: CELL_M } }];
}
function marginCell(r) {
  const m = r.margin || {};
  const main = typeof m.FY2025 === "number" ? pctPlain(m.FY2025) : (m.FY2025 == null ? "–" : String(m.FY2025));
  const s = (typeof m["9M2026"] === "number" || typeof m["9M2025"] === "number") ? `9M ${pctPlain(m["9M2026"])} vs ${pctPlain(m["9M2025"])}` : "";
  return plainCell(main, s);
}
const meansCell = (r) => ({ text: r.line, options: { fontSize: 8.5, color: HEX.ink, fill: { color: r.total ? HEX.cfill : "FFFFFF" }, valign: "middle", bold: !!r.total, margin: CELL_M } });
function legend(slide, y, withAdj = true) {
  const leg = [["Above +2%", HEX.gfill, HEX.green], ["−2% to +2%", HEX.nfill, HEX.grey], ["Below −2%", HEX.rfill, HEX.red], ["Adjusted growth", HEX.lfill, HEX.blue]].slice(0, withAdj ? 4 : 3);
  leg.forEach(([t, f, l], i) => {
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.45 + i * 1.75, y: y + 0.04, w: 0.22, h: 0.16, fill: { color: f }, line: { color: l, width: 0.75 }, objectName: "legend swatch" });
    slide.addText(t, { x: 0.74 + i * 1.75, y, w: 1.4, h: 0.24, fontSize: 9.5, color: HEX.ink, margin: 0, isTextBox: true });
  });
}

// ------------------------------------------------------------------ 1. title
pres.addSection({ title: "Summary" });
{
  const s = pres.addSlide({ masterName: "TITLE", sectionTitle: "Summary" });
  // geometric diagonal panels (shapes only), echoing the reference cover
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: 6.2, y: 0, w: 7.15, h: 7.5, fill: { color: "3FA7DA" }, line: { color: "3FA7DA" }, flipH: true, objectName: "cover panel 1" });
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: 8.4, y: 0, w: 4.95, h: 7.5, fill: { color: "2F78C4" }, line: { color: "2F78C4" }, flipH: true, objectName: "cover panel 2" });
  s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: 10.3, y: 0, w: 3.05, h: 7.5, fill: { color: "22408F" }, line: { color: "22408F" }, flipH: true, objectName: "cover panel 3" });
  s.addText("SEVEN priority companies: performance 2022–2026", { placeholder: "title" });
  s.addText([
    { text: "47 Saudi-listed companies in 8 groups: reported and adjusted revenue growth, margins and balance sheets, FY2022–FY2025 and 9M 2026 vs 9M 2025", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Entertainment and leisure · media · F&B · delivery · malls · retail REITs · retailers · supporting consumer goods", options: { fontSize: 12 } },
  ], { placeholder: "body" });
  s.addText("Sector analysis · 27 November 2026 · from the reviewed SEVEN priority companies workbook (company filings and fund fact sheets)", { x: 0.6, y: 6.45, w: 5.6, h: 0.5, fontSize: 11, color: HEX.grey, margin: 0, isTextBox: true });
  s.addNotes("Built from the reviewed workbook SEVEN_Priority_Companies.xlsx (27 November 2026). Every figure on the following slides is in that workbook.");
}

// ------------------------------------------------------------------ 2. summary: growth vs profit
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Summary" });
  title(s, "Summary", "Revenue still grows; profit and margins do not keep up");
  sub(s, "9M 2026 against 9M 2025, group totals (matched sample). Revenue grew in every group shown; attributable profit fell in three of the five.");
  const ov = D.overview.filter((o) => typeof o.g9 === "number" && typeof o.ni9 === "number");
  chartCard(s, "Revenue and attributable profit, 9M 2026 vs 9M 2025, %");
  s.addChart(pres.charts.BAR, [
    { name: "Revenue", labels: ov.map((o) => o.label), values: ov.map((o) => +(o.g9 * 100).toFixed(1)) },
    { name: "Attributable profit", labels: ov.map((o) => o.label), values: ov.map((o) => +(o.ni9 * 100).toFixed(1)) },
  ], barOpts({ dataLabelFormatCode: '+0.0"%";−0.0"%"', valAxisLabelFormatCode: '0"%"', valAxisMinVal: -40, valAxisMaxVal: 100, objectName: "growth vs profit chart" }));
  const c = D.counts;
  card(s, 8.25, 1.5, 4.65, 1.6, "Growth", [`9M revenue rose at ${c.rev_up} of ${c.rev_n} companies that report a comparable 9M.`,
       "Fastest: delivery (+37.5%, with Snoonu) and F&B (+11.6%); malls flat (+0.9%)."]);
  card(s, 8.25, 3.2, 4.65, 1.75, "Profit and margins", [`Attributable profit rose at only ${c.ni_up} of ${c.ni_n}; EBITDA margin (excl. one-offs) rose at ${c.m_up} of ${c.m_n}.`,
       "Retailers −19.6% and Supporting −8.8% despite higher revenue; MBC and Jahez moved to losses."], HEX.teal);
  card(s, 8.25, 5.05, 4.65, 1.75, "Balance sheets", ["Retailers' net debt rose from 1.3x to 2.5x EBITDA (FY2022 to FY2025); malls stand at 7.9x.",
       "REIT loan to value rose from 33% to 43% as funds bought property with debt."]);
  foot(s, "Group totals are sums of the companies' figures (not consolidated). Media (MBC) and Platform (Jahez) turned from profit to loss in 9M 2026, so their profit growth is n.m.; REIT 9M figures are n.a. (fact sheets cover too few funds). F&B profit growth is led by Americana (+60%). Counts cover companies with both 9M periods.");
}

// ------------------------------------------------------------------ 3. summary: bought vs grown
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Summary" });
  title(s, "Summary", "Part of the headline growth is bought, one-off or a basis change");
  sub(s, "Each pair compares the same period: reported revenue growth vs growth after the adjustment named (disclosed or calculated from the filings).");
  const SHORT = { "6017": "Jahez FY25: excl. Snoonu", "4161": "BinDawood FY25: excl. acquisitions", "6014": "Alamar 9M: excl. Five Guys",
                  "6016": "Burgerizzr 9M: excl. SHOVEL", "4150": "ARDCO 9M: excl. land sales", "4190": "Jarir FY24: same revenue basis",
                  "2287": "Entaj FY24: same revenue basis" };
  const ORDER = ["6017", "4161", "6014", "6016", "4150", "4190", "2287"];   // numeric-looking keys would otherwise sort
  const P = ORDER.map((t) => D.pairs.find((p) => p.ticker === t)).filter(Boolean);
  chartCard(s, "Revenue growth vs the same period a year earlier, %");
  s.addChart(pres.charts.BAR, [
    { name: "Reported (all revenue)", labels: P.map((p) => SHORT[p.ticker]), values: P.map((p) => +(p.reported * 100).toFixed(1)) },
    { name: "Adjusted (basis in label)", labels: P.map((p) => SHORT[p.ticker]), values: P.map((p) => +(p.adjusted * 100).toFixed(1)) },
  ], barOpts({ catAxisLabelFontSize: 10.5, dataLabelFormatCode: '+0.0"%";−0.0"%"', valAxisLabelFormatCode: '0"%"', valAxisMinVal: -30, valAxisMaxVal: 40, objectName: "reported vs adjusted chart" }));
  card(s, 8.25, 1.5, 4.65, 2.1, "Bought, not grown", ["Jahez: FY2025 +4.7% is −5.5% without Snoonu; 9M delivery revenue inside Saudi Arabia fell 10%.",
       "BinDawood FY2025 +11.8% is +3.9% without acquisitions; Burgerizzr 9M +27.5% is +6.1% without SHOVEL; Alamar +18.3% is about +11% without Five Guys."]);
  card(s, 8.25, 3.7, 4.65, 1.45, "One-off sales and prices", ["ARDCO 9M −17.7% is +2.7% without land sales.",
       "Lazurde 9M +29.3% rides the gold price; volumes are not disclosed."], HEX.teal);
  card(s, 8.25, 5.25, 4.65, 1.55, "What the filings do not say", ["None of the 47 companies reports same-store sales, so growth from new stores cannot be separated.",
       "Jarir and Entaj changed revenue bases; on one basis Jarir FY2024 is +2.2%."]);
  foot(s, "Adjustments are disclosed amounts (acquired revenue, land sales) or calculated from restated comparatives (Jarir net agent sales, Entaj reclassification). Alamar's adjusted figure still includes the Makkah and Taif branches it bought (not split). Other bridge steps are on each group table.");
}

// ------------------------------------------------------------------ 4. how to read
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Summary" });
  title(s, "How to read the tables", "Full years vs the year before; 9M 2026 vs 9M 2025");
  sub(s, "One table per group. Growth cells show the change and, underneath, the revenue it compares (SAR m).");
  const cellO = (j) => ({ fontSize: 11, bold: j === 0, color: j === 0 ? HEX.navy : HEX.ink, fill: { color: j === 0 ? HEX.cfill : "FFFFFF" }, valign: "middle" });
  const rows = [
    [hdrL("Column"), hdrL("Compares"), hdrL("Example (Leejam Sports)")],
    ["FY23 vs FY22 · FY24 vs FY23 · FY25 vs FY24", "Each full year's revenue against the year before (latest restated figures)", "FY25 vs FY24: +7.5% (1,614 vs 1,501)"],
    ["9M-26 vs 9M-25", "January–September 2026 against January–September 2025", "+4.0% (1,231 vs 1,183)"],
    ["Adjusted growth and basis", "The same comparison after removing what the basis names (acquisitions, land sales, a change of revenue basis); '= reported' where the filings show no such effect", "= reported: no acquisitions, FX or accounting effects in 9M 2026"],
    ["EBITDA margin (excl. one-offs)", "FY2025 margin, with 9M 2026 vs 9M 2025 underneath; one-offs are listed in the workbook's One_offs sheet (REITs: FFO margin)", "47.2% (9M 42.9% vs 46.4%)"],
    ["Net debt / EBITDA", "Borrowings + leases − cash − short-term bank deposits, over FY2025 EBITDA (REITs: loan to value)", "2.4x"],
  ].map((r, i) => i === 0 ? r : r.map((t, j) => ({ text: t, options: cellO(j) })));
  s.addTable(rows, { x: 0.45, y: 1.5, w: 12.45, colW: [3.0, 5.85, 3.6], rowH: [0.42, 0.52, 0.52, 0.72, 0.72, 0.6], border: { type: "solid", pt: 0.75, color: HEX.line }, fontFace: "Arial", objectName: "how to read table" });
  card(s, 0.45, 5.3, 3.95, 1.5, "Colours", ["Green above +2%, red below −2%, grey in between.", "Adjusted-growth cells are shaded light blue."]);
  card(s, 4.7, 5.3, 3.95, 1.5, "n.m. and n.a.", ["n.m.: not meaningful (short year, base under SAR 10m, loss).", "n.a.: group figure covers under 75% of group revenue."], HEX.teal);
  card(s, 8.95, 5.3, 3.95, 1.5, "Sources", ["Audited and reviewed filings; Americana in USD at 3.75.", "Every figure and its PDF page is in the workbook."]);
}

// ------------------------------------------------------------------ 5. overview of groups
pres.addSection({ title: "Groups" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Groups" });
  title(s, "Eight groups", "Retail and food carry the revenue; malls and leisure the margins");
  sub(s, "Group totals (sums of the companies, not consolidated). Growth on a matched sample; ratios from summed figures.");
  const head = ["Group", "Revenue FY2025 (SAR bn)", "CAGR 2022–25", "FY25 vs FY24", "9M-26 vs 9M-25", "Profit 9M y/y", "Margin FY2025", "Leverage FY2025", "Largest (share)", "What it means"];
  const rows = [head.map((h, i) => (i === 0 || i === 9 ? hdrL(h) : hdr(h)))];
  for (const o of D.overview) {
    rows.push([
      { text: [{ text: o.label, options: { bold: true, fontSize: 10.5, color: HEX.navy, breakLine: true } }, { text: `${o.n} ${o.n > 1 ? "companies" : "company"}`, options: { fontSize: 8, color: HEX.muted } }], options: { fill: { color: HEX.cfill }, valign: "middle", margin: CELL_M } },
      plainCell((o.rev25 / 1000).toFixed(1), ""),
      growthCell({ v: o.cagr }), growthCell({ v: o.g25 }), growthCell({ v: o.g9 }), growthCell({ v: o.ni9 }),
      plainCell(typeof o.margin25 === "number" ? pctPlain(o.margin25) : "–", o.margin_kind === "FFO" ? "FFO margin" : "EBITDA excl. one-offs"),
      plainCell(o.lev_kind === "LTV" ? pctPlain(o.lev25) : mult(o.lev25), o.lev_kind === "LTV" ? "loan to value" : "net debt / EBITDA"),
      plainCell(o.largest, typeof o.share === "number" ? `${pctPlain(o.share, 0)} of revenue` : ""),
      { text: o.line, options: { fontSize: 9, color: HEX.ink, fill: { color: "FFFFFF" }, valign: "middle", margin: CELL_M } },
    ]);
  }
  s.addTable(rows, { x: 0.45, y: 1.45, w: 12.45, colW: [1.75, 0.9, 0.85, 0.85, 0.9, 0.85, 1.05, 1.0, 1.3, 3.0], rowH: [0.5].concat(Array(8).fill(0.6)),
    border: { type: "solid", pt: 0.75, color: HEX.line }, fontFace: "Arial", objectName: "group overview table" });
  foot(s, "n.a.: Malls FY2022 and REIT 9M figures cover less than 75% of group revenue (Cenomi Centers' nine-month FY2022; REIT fact sheets). n.m.: profit turned to a loss (Media, Platform). Margin: EBITDA excluding identified one-offs (REITs: FFO margin). Leverage: net debt / EBITDA (REITs: loan to value).", 6.9);
}

// ------------------------------------------------------------------ group tables
// Each slide lists its rows explicitly; the two largest groups run over two slides so that every table fits.
const GROUP_SLIDES = [
  { head: "Entertainment and media", msg: "Gyms grow; Baan shrinks; MBC falls back in 2026", parts: [["Entertainment", true], ["Media", false]] },
  { head: "F&B and delivery", msg: "Americana recovers; smaller chains shrink or buy growth", parts: [["FnB", true], ["Platform", false]] },
  { head: "Mall operators", msg: "Revenue flat; the two largest carry 8–10x net debt to EBITDA", parts: [["Malls", true]] },
  { head: "Retail REITs", msg: "Revenue bought with debt; FFO and payouts under pressure", parts: [["REITs", true]], reit: true },
  { head: "Retailers (1 of 2)", msg: "Revenue still grows; 9M profit fell at five of these six", parts: [["Retailers", true, ["4001", "4161", "4190", "4003", "4164", "4163"]]],
    note: "Grocery, electronics, books and pharmacy. Group total covers all 11 retailers." },
  { head: "Retailers (2 of 2)", msg: "9M losses at SACO and Nice One; debt highest at Lazurde", parts: [["Retailers", false, ["4240", "4008", "4192", "4193", "4011"]]],
    note: "Fashion, home, beauty and jewellery. Group total on the previous slide." },
  { head: "Supporting goods (1 of 2)", msg: "Almarai and Tanmiah grow; SADAFCO shrinks", parts: [["Supporting", true, ["2280", "2050", "2270", "6010", "6001", "2281"]]],
    note: "Food, dairy and poultry producers (Savola includes the Panda supermarkets). Group total covers all 13 companies." },
  { head: "Supporting goods (2 of 2)", msg: "Mills keep 31–41% margins; Entaj has 15x net debt", parts: [["Supporting", false, ["2282", "2287", "2283", "2284", "2285", "2286", "4165"]]],
    note: "Water, poultry, flour mills and fragrance. Group total on the previous slide." },
];
const STD_SUB = "Revenue growth vs the year before, with the revenue it compares underneath (SAR m); adjusted growth removes acquisitions, land sales or basis changes.";
for (const G of GROUP_SLIDES) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Groups" });
  title(s, G.head, G.msg);
  sub(s, G.reit ? "Rental revenue growth vs the year before (9M from unaudited fact sheets, where printed), with FFO margin, loan to value and payout (SAR m)."
                : (G.note ? G.note + " " : "") + (G.note ? "Growth vs the year before; revenue compared underneath (SAR m)." : STD_SUB));
  const list = [];
  for (const [k, withTotal, only] of G.parts) {
    const g = D.groups[k];
    if (withTotal && g.total) list.push(g.total);
    for (const r of g.rows) if (!only || only.includes(r.ticker)) list.push(r);
  }
  let rows, colW;
  if (!G.reit) {
    rows = [[hdrL("Company"), hdr("FY23 vs FY22"), hdr("FY24 vs FY23"), hdr("FY25 vs FY24"), hdr("9M-26 vs 9M-25"), hdr("Adjusted growth"), hdrL("Adjusted basis"),
             hdr("EBITDA margin FY25"), hdr("Net debt / EBITDA FY25"), hdrL("What it means")]];
    for (const r of list) rows.push([nameCell(r)].concat(r.cells.map(growthCell), adjCells(r), [marginCell(r), plainCell(mult(r.lev), "")], [meansCell(r)]));
    colW = [1.62, 0.86, 0.86, 0.86, 0.9, 1.0, 1.4, 1.1, 0.75, 3.1];
  } else {
    rows = [[hdrL("Fund"), hdr("FY23 vs FY22"), hdr("FY24 vs FY23"), hdr("FY25 vs FY24"), hdr("9M-26 vs 9M-25"), hdr("FFO margin FY25"), hdr("Loan to value FY25"),
             hdr("Payout FY25"), hdr("Net profit FY25 (SAR m)"), hdrL("What it means")]];
    for (const r of list) rows.push([nameCell(r)].concat(r.cells.map(growthCell), [marginCell(r), plainCell(pctPlain(r.lev), ""), plainCell(pctPlain(r.payout), ""),
        plainCell(r.total ? "" : sar(r.ni25), "")], [meansCell(r)]));
    colW = [1.75, 0.86, 0.86, 0.86, 0.9, 1.1, 0.95, 0.85, 0.9, 3.42];
  }
  const n = rows.length - 1;
  const rh = Math.min(0.66, 4.62 / n);
  s.addTable(rows, { x: 0.45, y: 1.42, w: 12.45, colW, rowH: [0.46].concat(Array(n).fill(rh)), border: { type: "solid", pt: 0.75, color: HEX.line }, fontFace: "Arial", objectName: `${G.head} table` });
  legend(s, 6.62, !G.reit);
  foot(s, G.reit ? "9M figures come from unaudited fact sheets, so 9M group figures are n.a. FFO = net income + depreciation and impairment of real estate − disposal gains (we calculate). Payout = distributions / FFO. Group total row: sums of the funds."
                 : "Group total: sums of the companies (matched-sample growth; n.a. if the companies reporting are under 75% of group revenue). EBITDA margin excludes identified one-offs. Net debt includes leases, less cash and short-term bank deposits. n.m.: short year, base under SAR 10m or a loss.", 6.95);
}

// ------------------------------------------------------------------ margins
pres.addSection({ title: "Across groups" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Across groups" });
  title(s, "Margins", "Five of seven groups lost margin in 9M 2026; malls and F&B gained");
  sub(s, "EBITDA margin excluding identified one-offs, group totals; 9M 2026 compared only with 9M 2025.");
  const groups = D.overview.filter((o) => o.margin_kind === "EBITDA");
  chartCard(s, "EBITDA margin excl. one-offs, 9M 2025 vs 9M 2026, %");
  s.addChart(pres.charts.BAR, [
    { name: "9M 2025", labels: groups.map((o) => o.label), values: groups.map((o) => +(o.m["9M2025"] * 100).toFixed(1)) },
    { name: "9M 2026", labels: groups.map((o) => o.label), values: groups.map((o) => +(o.m["9M2026"] * 100).toFixed(1)) },
  ], barOpts({ chartColors: ["8A97AB", HEX.blue], dataLabelFormatCode: '0.0"%"', valAxisLabelFormatCode: '0"%"', valAxisMinVal: 0, valAxisMaxVal: 70, objectName: "margin chart" }));
  const fmt = (x) => `${x.name}: ${pctPlain(x.b)} to ${pctPlain(x.a)}`;
  const down = D.margins.down.filter((x) => x.name !== "Raydan Food").slice(0, 5);
  card(s, 8.25, 1.5, 4.65, 2.55, "Largest falls (9M 2025 to 9M 2026)", down.map(fmt));
  card(s, 8.25, 4.15, 4.65, 2.65, "Largest gains (9M 2025 to 9M 2026)", D.margins.up.slice(0, 5).map(fmt), HEX.teal);
  foot(s, "Raydan (margin −16.4% to −53.7% as it winds down) is left out of the lists. Cenomi Centers' SAR 250m insurance claim (9M 2025) is excluded as a one-off; with it, malls' 9M margin would have fallen. Company margins are on each group table.");
}

// ------------------------------------------------------------------ balance sheets
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Across groups" });
  title(s, "Balance sheets", "Debt rose where property was bought or built");
  sub(s, "Net debt (borrowings + leases − cash − short-term bank deposits) over EBITDA, FY2025; REITs: loan to value.");
  const top = D.leverage.top.map((x) => ({ ...x, name: x.name.replace("Abdullah Al Othaim Markets", "Othaim Markets") }));
  chartCard(s, "Highest net debt / EBITDA, FY2025, x");
  s.addChart(pres.charts.BAR, [{ name: "Net debt / EBITDA", labels: top.map((x) => x.name), values: top.map((x) => +x.v.toFixed(1)) }],
    barOpts({ chartColors: [HEX.blue], dataLabelFormatCode: '0.0"x"', valAxisLabelFormatCode: '0"x"', valAxisMinVal: 0, valAxisMaxVal: 50, showLegend: false, objectName: "leverage chart" }));
  const ov = Object.fromEntries(D.overview.map((o) => [o.group, o]));
  card(s, 8.25, 1.5, 4.65, 2.05, "Groups, FY2022 to FY2025", [`Retailers ${mult(ov.Retailers.lev22)} to ${mult(ov.Retailers.lev25)}; Entertainment ${mult(ov.Entertainment.lev22)} to ${mult(ov.Entertainment.lev25)}; F&B ${mult(ov.FnB.lev22)} to ${mult(ov.FnB.lev25)}.`,
       `Supporting fell from ${mult(ov.Supporting.lev22)} to ${mult(ov.Supporting.lev25)}; malls ${mult(ov.Malls.lev25)} in FY2025; REIT loan to value ${pctPlain(ov.REITs.lev22, 0)} to ${pctPlain(ov.REITs.lev25, 0)}.`]);
  card(s, 8.25, 3.65, 4.65, 1.75, "Read with care", ["Lazurde's debt is mostly gold borrowed from banks (SAR 1,932m), matched by gold stock and receivables; without it net debt is about nil.",
       "Cenomi Retail has negative equity."], HEX.teal);
  card(s, 8.25, 5.5, 4.65, 1.3, "Net cash at end-2025", [D.leverage.netcash.map((x) => x.name.replace(" Beauty", "").replace(" Group", "")).join(", ") + "."]);
  foot(s, "Short-term deposits are those due within a year; Americana's longer deposits (USD 117.8m) are not deducted. Net debt includes IFRS 16 lease liabilities for every company.");
}

// ------------------------------------------------------------------ distortions
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Across groups" });
  title(s, "What distorts the totals", "One-offs, cross-holdings and short years");
  sub(s, "Largest identified one-offs inside operating income (SAR m, pre-tax), removed in 'EBITDA excl. one-offs'; net profit is kept as reported.");
  const ITEM = {
    "2050|FY2024": "Gain on handing the 34.5% Almarai stake to shareholders (in kind)",
    "4001|FY2022": "Gain on selling 13.7% of Abdullah Al-Othaim for Investment",
    "4072|9M2026": "Fair-value result: unrealised loss on ACSC and Anghami, net of option gains",
    "6010|FY2024": "Gain on the Arabian Mills stake at its IPO (part sold, rest revalued)",
    "4321|FY2025": "Insurance claim for the May 2022 Mall of Dhahran fire",
    "4321|FY2023": "Gain on selling part of the Jawharat Riyadh land",
    "4240|FY2024": "Gain on disposal of brands",
    "4072|FY2025": "Fair-value result: gain on reclassifying ACSC, less fair-value losses",
    "4072|FY2024": "Gain on selling 4.9% of ACSC (associate)",
  };
  const rows = [[hdrL("Company"), hdr("Period"), hdrL("Item"), hdr("SAR m")]];
  for (const o of D.oneoffs.slice(0, 9)) {
    const item = ITEM[`${o.ticker}|${o.period}`];
    if (!item) throw new Error("no short label for one-off " + o.ticker + " " + o.period);
    rows.push([{ text: o.name.replace("Abdullah Al Othaim Markets", "Othaim Markets"), options: { bold: true, color: HEX.navy, fill: { color: HEX.cfill }, fontSize: 10.5, valign: "middle" } },
      { text: o.period.replace("9M", "9M "), options: { align: "center", fontSize: 10.5, fill: { color: "FFFFFF" }, valign: "middle" } },
      { text: item, options: { fontSize: 10, fill: { color: "FFFFFF" }, valign: "middle" } },
      { text: (o.amount >= 0 ? "+" : "−") + sar(Math.abs(o.amount)), options: { align: "right", bold: true, fontSize: 10.5, color: o.amount >= 0 ? HEX.green : HEX.red, fill: { color: "FFFFFF" }, valign: "middle" } }]);
  }
  s.addTable(rows, { x: 0.45, y: 1.5, w: 7.55, colW: [1.7, 0.9, 4.05, 0.9], rowH: [0.42].concat(Array(rows.length - 1).fill(0.54)), border: { type: "solid", pt: 0.75, color: HEX.line }, fontFace: "Arial", objectName: "one-offs table" });
  card(s, 8.25, 1.5, 4.65, 2.45, "Cross-holdings (counted twice)", ["Savola held 34.5% of Almarai until Dec 2024: SAR 0.6–0.8bn of profit a year sits in both.",
       "Savola consolidates Herfy (49%); Alandalus consolidates Alahli REIT 1 (68.7%).", "Othaim's joint venture owns 70% of Fourth Milling."]);
  card(s, 8.25, 4.05, 4.65, 1.4, "Short years", ["Left out of group totals: SADAFCO FY2022 and FY2023, Cenomi Centers and Cenomi Retail FY2022, MBC FY2023."], HEX.teal);
  card(s, 8.25, 5.55, 4.65, 1.25, "Treatments kept", ["Nahdi bank charges in finance costs; Entaj fair-value gains in EBITDA (memos in the workbook)."]);
  foot(s, "The tax and minority effects of one-offs are not disclosed, so net profit is not adjusted. Full registers: workbook One_offs and Cross_holdings sheets.");
}

// ------------------------------------------------------------------ method
pres.addSection({ title: "Method" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Method" });
  title(s, "Method and limits", "Every figure traces to a filing page; the limits are named");
  sub(s, "Source: the reviewed workbook SEVEN_Priority_Companies.xlsx (27 November 2026), which holds every figure, its file and page, and the review record.");
  card(s, 0.45, 1.55, 4.0, 3.75, "How the figures were built", ["Audited annual and reviewed interim filings from the exchange archive; the exchange's XBRL files corrected from the PDFs.",
       "Each year uses the latest restated figure; restatements are listed with their reason.", "One definition for every company: operating income = profit before zakat and tax + finance costs − finance income − associates.",
       "Group totals are sums of companies, not consolidated."], HEX.blue, 12);
  card(s, 4.67, 1.55, 4.0, 3.75, "How they were checked", ["Analyst: every core figure compared with the PDF statements (5,791 checks); a 94-figure independent sample (93 confirmed, 1 without a PDF).",
       "Review of 27 November 2026 (reviewer's own checks): all 17,798 formulas recalculated without error; core metrics rebuilt from the Data sheet; 65 of 65 FY2025 inputs found in the PDFs for five companies."], HEX.teal, 12);
  card(s, 8.9, 1.55, 4.0, 3.75, "Limits", ["SADAFCO's year to March 2023 and three restated September 2025 balance sheets exist only as XBRL files.",
       "REIT nine-month figures come from unaudited fact sheets.", "No company reports same-store sales; currency effects (e.g. the Egyptian pound) are not disclosed.",
       "Deposit restrictions or pledges were not checked."], HEX.blue, 12);
  // where to find things in the workbook
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 5.5, w: 12.45, h: 1.15, fill: { color: HEX.cfill }, line: { color: HEX.cfill }, rectRadius: 0.08, objectName: "workbook map" });
  s.addText([
    { text: "Where to look in the workbook  ", options: { bold: true, color: HEX.navy } },
    { text: "Overview: all groups · <Group>_Group: totals and company comparison · one sheet per company (figures, ratios, revenue bridge, notes) · Adjustments: bridge steps and basis · One_offs · Restatements · Cross_holdings · Data: every figure with its file and page · Sources", options: { color: HEX.ink } },
  ], { x: 0.65, y: 5.6, w: 12.05, h: 0.95, fontSize: 12, valign: "middle", margin: 0, isTextBox: true });
}

pres.writeFile({ fileName: OUT }).then(async () => {
  await applyTheme(OUT, THEME);
  console.log("deck ->", OUT);
});
