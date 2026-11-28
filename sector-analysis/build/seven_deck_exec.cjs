// SEVEN priority companies: executive deck (v4, after the 28 Nov 2026 review), in the house style of the "KSA Budget FY2027 Overview" deck:
// navy cover and section dividers with gold numbers, Georgia italic action titles, Calibri body, light-grey cards,
// navy-header tables, a running footer and a source line on every content slide.
// Storyline follows the user's revised deck (27 Nov 2026); evidence tables are rebuilt natively in the appendix.
// Usage: NODE_PATH=<dir with pptxgenjs> node build/seven_deck_exec.cjs <deck_data.json> <out.pptx>
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const SKILL = "/root/.claude/skills/synced/d460f705-4699-4d5b-b495-db252a0657e2_c6ac2004-2be6-4e40-9791-76746721773d/pptx";
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");

const [, , DATA, OUT] = process.argv;
const D = JSON.parse(fs.readFileSync(DATA, "utf8"));

// ------------------------------------------------------------------ palette (sampled from the budget deck)
const THEME = {
  name: "SEVEN executive", headFontFace: "Georgia", bodyFontFace: "Calibri",
  colors: { dk1: "1F2937", lt1: "FFFFFF", dk2: "14213D", lt2: "F3F4F6", accent1: "2A5B8F", accent2: "C0843A", accent3: "A8B3C4",
            accent4: "14213D", accent5: "6B7280", accent6: "D9C29C", hlink: "2A5B8F", folHlink: "6B7280" },
};
const K = { navy: "14213D", ink: "1F2937", steel: "2A5B8F", steelL: "A8B3C4", gold: "C0843A", goldL: "D9C29C", goldD: "9A6420",
            card: "F3F4F6", zebra: "F9FAFB", total: "E9EEF5", line: "E5E7EB", muted: "6B7280", foot: "9CA3AF", pale: "C9CED8",
            posF: "E4ECF5", negF: "F6EADB", adjF: "EEF1F5", white: "FFFFFF" };
const FOOTER = "SEVEN priority companies  |  Performance 2022 to 2026  |  November 2026";
const CM = [0.035, 0.06, 0.035, 0.07];   // table cell margins (in)

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "SEVEN priority companies: performance 2022 to 2026";
pres.author = "Sector analysis";

// "9M" is written out: every text, table cell, chart label and note passes through T()
function T(x) {
  if (typeof x !== "string") return x;
  return x.replace(/9M 2026 vs 9M 2025/g, "Jan–Sep 2026 vs Jan–Sep 2025").replace(/9M-26 vs 9M-25/g, "Jan–Sep 2026 vs 2025")
          .replace(/9M ?(20\d\d)/g, "Jan–Sep $1").replace(/\b9M\b/g, "Jan–Sep");
}
function TT(v) {
  if (typeof v === "string") return T(v);
  if (Array.isArray(v)) return v.map(TT);
  if (v && typeof v === "object" && "text" in v) return Object.assign({}, v, { text: TT(v.text) });
  return v;
}
const _addSlide = pres.addSlide.bind(pres);
pres.addSlide = (o) => {
  const sl = _addSlide(o);
  const at = sl.addText.bind(sl), ab = sl.addTable.bind(sl), ac = sl.addChart.bind(sl), an = sl.addNotes.bind(sl);
  sl.addText = (t, opt) => at(TT(t), opt);
  sl.addTable = (rows, opt) => ab(rows.map((r) => r.map(TT)), opt);
  sl.addChart = (type, data, opt) => ac(type, Array.isArray(data) ? data.map((d) => Object.assign({}, d, { name: T(d.name), labels: (d.labels || []).map(T) })) : data, opt);
  sl.addNotes = (t) => an(T(t));
  return sl;
};

// ------------------------------------------------------------------ layouts
pres.defineSlideMaster({
  title: "COVER", background: { color: K.navy },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.55, w: 8.4, h: 1.9, fontSize: 36, italic: true, color: K.white, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.65, w: 7.8, h: 1.0, fontSize: 15, color: K.goldL, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "DIVIDER", background: { color: K.navy },
  slideNumber: { x: 12.45, y: 7.02, w: 0.45, h: 0.25, fontSize: 9, color: K.muted, align: "right" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 3.85, w: 9.5, h: 0.8, fontSize: 34, italic: true, color: K.white, valign: "top", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 4.85, w: 8.6, h: 1.0, fontSize: 14, color: K.pale, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: K.white },
  margin: [0.3, 0.45, 0.6, 0.45],
  slideNumber: { x: 12.45, y: 7.02, w: 0.45, h: 0.25, fontSize: 9, color: K.foot, align: "right" },
  objects: [
    { text: { text: FOOTER, options: { x: 0.45, y: 7.02, w: 8.0, h: 0.25, fontSize: 8.5, color: K.foot, margin: 0 } } },
    { placeholder: { options: { name: "title", type: "title", x: 0.45, y: 0.32, w: 12.4, h: 0.95, fontSize: 25, italic: true, color: K.navy, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});

// ------------------------------------------------------------------ helpers
const pct = (v, d = 1) => (typeof v === "number" ? (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d) + "%" : v == null ? "–" : String(v));
const pctP = (v, d = 1) => (typeof v === "number" ? (v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(d) + "%" : v == null ? "–" : String(v));
const mult = (v) => (typeof v === "number" ? (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "x" : v == null ? "–" : String(v));
const sar = (v) => (typeof v !== "number" ? "–" : (v < 0 ? "−" : "") + (Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString("en-US") : Math.abs(v).toFixed(1)));
const tone = (v) => (typeof v !== "number" ? "n" : v > 0.02 ? "p" : v < -0.02 ? "m" : "n");
const TONE = { p: [K.steel, K.posF], m: [K.goldD, K.negF], n: [K.ink, K.white] };
const OV = Object.fromEntries(D.overview.map((o) => [o.group, o]));
const C = D.counts;
const V = D.v4, VG = D.v4.groups, SIX = D.v4.six;
const MT = D.v4.margin_table, MA = D.v4.margin_all;
const mDir = (v, base) => (typeof v !== "number" || typeof base !== "number" ? null : Math.abs(v - base) < 0.0005 ? 0 : v < base ? -1 : 1);
const mEnd = (g, k) => (MT[g].reit ? (k === "FY2025" ? MT[g].FY2025 : null) : MT[g][k]);
const lowerCount = (k) => Object.keys(MT).filter((g) => mDir(MT[g].reit ? MT[g].FY2025 : MT[g][k], MT[g].m_base) === -1).length;
const yr = (p) => (p === "2026E" ? "2026E" : p.replace("FY20", "FY"));

function content(title, section) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}
function source(s, text) {
  s.addText(text, { x: 0.45, y: 6.62, w: 12.4, h: 0.36, fontSize: 8.5, color: K.muted, valign: "bottom", margin: 0, isTextBox: true, objectName: "source" });
}
function divider(num, title, sub, section) {
  pres.addSection({ title: section });
  const s = pres.addSlide({ masterName: "DIVIDER", sectionTitle: section });
  s.addText(num, { x: 0.6, y: 2.75, w: 3, h: 1.0, fontFace: "Georgia", fontSize: 58, color: K.gold, margin: 0, isTextBox: true, objectName: "section number" });
  s.addText(title, { placeholder: "title" });
  s.addText(sub, { placeholder: "body" });
  return s;
}
function box(s, x, y, w, h, fill = K.card, name = "card") {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.06, objectName: name });
}
function numCircle(s, x, y, n, d = 0.42) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: K.navy }, line: { color: K.navy }, objectName: "number circle" });
  s.addText(String(n), { x, y, w: d, h: d, fontSize: 13, bold: true, color: K.white, align: "center", valign: "middle", margin: 0, isTextBox: true });
}
// card with optional number circle, heading and either paragraph text or bullets
function card(s, x, y, w, h, head, body, o = {}) {
  box(s, x, y, w, h, o.fill || K.card);
  let tx = x + 0.22;
  if (o.num) { numCircle(s, x + 0.22, y + 0.2, o.num); tx = x + 0.78; }
  s.addText(head, { x: tx, y: y + 0.2, w: x + w - tx - 0.2, h: 0.42, fontSize: o.hs || 14, bold: true, color: o.hc || K.navy, valign: "middle", margin: 0, isTextBox: true });
  const bodyY = y + 0.75;
  const runs = Array.isArray(body)
    ? body.map((b, i) => (typeof b === "string" ? { text: b, options: { bullet: { indent: 11 }, breakLine: i < body.length - 1 } } : b))
    : [{ text: body }];
  s.addText(runs, { x: x + 0.22, y: bodyY, w: w - 0.44, h: h - (bodyY - y) - 0.15, fontSize: o.fs || 12, color: o.tc || K.ink, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true });
}
function kpi(s, x, y, w, h, big, label, sub, accent = K.navy) {
  box(s, x, y, w, h);
  s.addText(big, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.62, fontSize: 30, bold: true, color: accent, margin: 0, isTextBox: true });
  s.addText(label, { x: x + 0.25, y: y + 0.86, w: w - 0.5, h: 0.32, fontSize: 13, bold: true, color: K.ink, margin: 0, isTextBox: true });
  s.addText(sub, { x: x + 0.25, y: y + 1.2, w: w - 0.5, h: h - 1.3, fontSize: 10.5, color: K.muted, valign: "top", margin: 0, isTextBox: true });
}
function navyBar(s, y, text, h = 0.5) {
  s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y, w: 12.4, h, fill: { color: K.navy }, line: { color: K.navy }, objectName: "so-what bar" });
  s.addText(text, { x: 0.65, y, w: 12.0, h, fontSize: 12.5, bold: true, color: K.white, valign: "middle", margin: 0, isTextBox: true });
}
function chartTitle(s, x, y, w, t) {
  s.addText(t, { x, y, w, h: 0.3, fontSize: 11.5, bold: true, color: K.navy, align: "center", margin: 0, isTextBox: true });
}
function barOpts(extra) {
  return Object.assign({ barDir: "bar", barGrouping: "clustered", showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt",
    dataLabelColor: K.ink, catAxisLabelFontSize: 10.5, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: K.ink, catAxisOrientation: "maxMin", catAxisLabelPos: "low",
    catAxisLineShow: false, valAxisLabelFontSize: 9.5, valAxisLabelFontFace: "+mn-lt", valAxisLabelColor: K.muted, valGridLine: { color: "E5E7EB", size: 0.5 },
    catGridLine: { style: "none" }, showLegend: true, legendPos: "t", legendFontSize: 10, legendFontFace: "+mn-lt", legendColor: K.ink, barGapWidthPct: 60 }, extra);
}
// table cells
const TH = (t, al = "center") => ({ text: t, options: { bold: true, color: K.white, fill: { color: K.navy }, fontSize: 10, align: al, valign: "middle", margin: CM } });
function zebra(rows, startIdx = 1) {   // apply zebra fill to body rows lacking an explicit fill
  rows.forEach((r, i) => { if (i < startIdx) return; r.forEach((c) => { c.options = c.options || {}; if (!c.options.fill) c.options.fill = { color: (i - startIdx) % 2 ? K.zebra : K.white }; }); });
  return rows;
}
const TD = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 10.5, color: K.ink, valign: "middle", margin: CM }, o) });
function gCell(v, a, b, o = {}) {
  const t = tone(v), [col, fill] = TONE[t];
  const runs = [{ text: typeof v === "number" ? pct(v) : v == null ? "–" : String(v), options: { bold: true, fontSize: o.fs || 10.5, color: typeof v === "number" ? col : K.muted, breakLine: !!o.sub } }];
  if (o.sub) runs.push({ text: typeof a === "number" && typeof b === "number" ? `${sar(a)} vs ${sar(b)}` : " ", options: { fontSize: 7.5, color: K.muted } });
  return { text: runs, options: { align: "center", valign: "middle", margin: CM, fill: { color: typeof v === "number" && t !== "n" ? fill : (o.base || K.white) } } };
}
function legend(s, y, withAdj = true) {
  const items = [["Above +2%", K.posF, K.steel], ["−2% to +2%", K.white, K.steelL], ["Below −2%", K.negF, K.goldD]].concat(withAdj ? [["Like-for-like", K.adjF, K.navy]] : []);
  items.forEach(([t, f, l], i) => {
    s.addShape(pres.shapes.RECTANGLE, { x: 0.45 + i * 1.7, y: y + 0.04, w: 0.22, h: 0.15, fill: { color: f }, line: { color: l, width: 0.75 }, objectName: "legend swatch" });
    s.addText(t, { x: 0.74 + i * 1.7, y, w: 1.35, h: 0.23, fontSize: 9, color: K.ink, margin: 0, isTextBox: true });
  });
}

const SHORT_NAME = (n) => n.replace("Abdullah Al Othaim Markets", "Othaim Markets").replace(" Restaurants", "").replace(" Food Services", "").replace(" International", "")
  .replace(" Property", "").replace(" Holding", "").replace(" Marketing", "").replace(" Medical Services", "").replace(" Medical", "")
  .replace("United Electronics", "eXtra").replace(" Stores", "").replace(" Beauty", "").replace(" Group", "").replace(" Sports", "")
  .replace(" Foods", "").replace(" Food", "").replace(" Bros", "");
async function makeIcons() {
  const R = require("react"), RS = require("react-dom/server"), sharp = require("sharp"), fa = require("react-icons/fa6");
  const out = {};
  for (const [k, comp] of Object.entries({ exercise: fa.FaMagnifyingGlassChart, groups: fa.FaLayerGroup, outcomes: fa.FaChartLine })) {
    const svg = RS.renderToStaticMarkup(R.createElement(comp, { color: "#FFFFFF", size: 256 }));
    out[k] = "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
  }
  return out;
}
function iconHead(s, x, y, icon, text, w) {
  const d = 0.46;
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: K.navy }, line: { color: K.navy }, objectName: "icon circle" });
  s.addImage({ data: icon, x: x + 0.11, y: y + 0.11, w: 0.24, h: 0.24, altText: text + " icon" });
  s.addText(text, { x: x + 0.58, y, w: w - 0.6, h: d, fontSize: 14, bold: true, color: K.navy, valign: "middle", margin: 0, isTextBox: true });
}

async function main() {
const ICON = await makeIcons();

// ================================================================== 1. cover
pres.addSection({ title: "Summary" });
{
  const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Summary" });
  s.addText("SEVEN PRIORITY COMPANIES  ·  2022 TO 2026", { x: 0.6, y: 1.0, w: 8, h: 0.3, fontSize: 11, bold: true, color: K.gold, charSpacing: 1, margin: 0, isTextBox: true });
  s.addText("Revenue has grown since 2022; profit is not following everywhere", { placeholder: "title" });
  s.addText("How 47 Tadawul-listed companies in consumer, leisure, food, retail and retail-property businesses performed from 2022 to 2026", { placeholder: "body" });
  s.addText("November 2026  |  Company filings to September 2026 and fund fact sheets  |  Figures as of 27 November 2026", { x: 0.6, y: 4.95, w: 8.5, h: 0.3, fontSize: 10, color: K.pale, margin: 0, isTextBox: true });
  s.addText("Entertainment and leisure · media · F&B · delivery · malls · retail REITs · retailers · supporting consumer goods", { x: 0.6, y: 6.55, w: 9, h: 0.3, fontSize: 10, color: K.foot, margin: 0, isTextBox: true });
  s.addNotes("Built from the reviewed workbook SEVEN_Priority_Companies.xlsx (27 November 2026). Reported figures are in that workbook with their filing and page; 2026E, the like-for-like aggregates and the 2022-to-2026 comparisons are calculated for this deck from those figures (method in the appendix).");
}

// ================================================================== 2. executive summary (1 of 2): the exercise and what was benchmarked
{
  const s = content("Executive summary (1 of 2): we benchmarked 47 Tadawul-listed companies in eight groups, from 2022 to 2026", "Summary");
  const y0 = 1.42, h0 = 4.5;
  const P = [[0.45, 5.6], [6.2, 6.65]];
  P.forEach(([x, w]) => box(s, x, y0, w, h0));
  iconHead(s, P[0][0] + 0.2, y0 + 0.18, ICON.exercise, "The exercise", P[0][1] - 0.4);
  const ex = [["Why. ", "Benchmark how 47 Tadawul-listed companies in consumer, leisure, food, retail and retail-property businesses have performed since 2022."],
              ["What. ", "Revenue growth (reported and like-for-like), attributable profit, EBITDA margin excluding one-offs, and net debt (REITs: FFO and loan to value)."],
              ["When. ", "Each full year from FY2022 to FY2025 against the year before; January–September 2026 against January–September 2025; and 2026E, our estimate for the full year 2026."],
              ["How. ", "Audited and reviewed filings from the Saudi Exchange archive (REIT January–September figures from fact sheets). The analyst traced each reported figure to its filing page; our review re-checked a sample and recalculated the workbook, not every figure (see Sources, checks and limits)."]];
  s.addText(ex.flatMap(([h, t], i) => [{ text: h, options: { bold: true, color: K.navy } }, { text: t, options: { breakLine: i < ex.length - 1 } }]),
    { x: P[0][0] + 0.22, y: y0 + 0.82, w: P[0][1] - 0.44, h: h0 - 0.95, fontSize: 13, color: K.ink, valign: "top", margin: 0, paraSpaceAfter: 10, isTextBox: true });
  iconHead(s, P[1][0] + 0.2, y0 + 0.18, ICON.groups, "What we benchmarked", P[1][1] - 0.4);
  const EX = { Entertainment: "Leejam Sports, Sport Clubs, Armah, Baan", Media: "MBC Group", FnB: "Americana, Herfy, Alamar, Burgerizzr",
               Platform: "Jahez", Malls: "Cenomi Centers, Alandalus, ARDCO", REITs: "Bonyan, SEDCO Capital, Alahli REIT 1",
               Retailers: "Jarir, Othaim, Nahdi, eXtra, BinDawood", Supporting: "Savola, Almarai, NADEC, SADAFCO, four flour mills" };
  s.addText(D.overview.flatMap((o, i) => [{ text: `${o.label} `, options: { bold: true, color: K.navy } }, { text: `(${o.n} ${o.n > 1 ? "companies" : "company"}): `, options: { color: K.muted } },
                                          { text: EX[o.group], options: { color: K.ink, breakLine: i < D.overview.length - 1 } }]),
    { x: P[1][0] + 0.22, y: y0 + 0.82, w: P[1][1] - 0.44, h: h0 - 0.95, fontSize: 13, valign: "top", margin: 0, paraSpaceAfter: 8, isTextBox: true });
  navyBar(s, 6.07, "In this deck:   01  Since 2022: growth, profit and margins     ·     02  2026 so far     ·     03  Quality of growth and balance sheets     ·     A  Evidence", 0.48);
  s.addText("All 47 companies are listed with their revenue growth on the next pages. Source: SEVEN priority companies workbook (reviewed 27 Nov 2026).", { x: 0.45, y: 6.72, w: 12.4, h: 0.26, fontSize: 8.5, color: K.muted, margin: 0, isTextBox: true });
}

// ================================================================== 3. executive summary (2 of 2): key outcomes with their numbers
{
  const s = content("Executive summary (2 of 2): revenue keeps growing, but profit is not following everywhere", "Summary");
  const W = 4.0, H = 2.55, X = [0.45, 4.65, 8.85], Y = [1.38, 4.03];
  const rr = V.group_ratios.Retailers;
  const O = [
    ["Growth since 2022", pct(VG.ALL.cagr), "Revenue growth a year, FY2022 to 2026E", `Like-for-like ${pct(VG.ALL.cagr_lfl)}‡. Seven of eight groups grew, fastest delivery ${pct(VG.Platform.cagr)} (with Snoonu) and leisure ${pct(VG.Entertainment.cagr)}; ${SIX.rev_up} of ${SIX.rev_n} companies have higher revenue.`, K.navy],
    ["Still growing in 2026", `${C.rev_up} of ${C.rev_n}`, "Higher revenue, Jan–Sep 2026 vs 2025", `Only media fell (MBC −22.8%). All 47 companies: ${pct(VG.ALL.steps["9M"].rep)} on the same months.`, K.navy],
    ["Profit is not following", `${SIX.ni_up} of ${SIX.ni_n}`, "Higher attributable profit, 2026E vs FY2022", `Jan–Sep 2026 vs 2025: profit rose at only ${C.ni_up} of ${C.ni_n}; retailers −19.6%, malls −18.5%, while leisure and F&B gained.`, K.gold],
    ["Margins slip", `${lowerCount("9M2026")} of 8`, "Groups with a lower EBITDA margin than in 2022", `FY2022 (or first full year) vs Jan–Sep 2026; ${lowerCount("FY2025")} of 8 on FY2025, ${lowerCount("2026E")} on 2026E. Lower on every available basis: leisure, retailers, REITs. All operating companies: ${pctP(MA.FY2022)} to ${pctP(MA["9M2026"])}.`, K.gold],
    ["Some growth is bought", "−5.5%", "Jahez FY2025 growth without Snoonu (reported +4.7%)", "BinDawood FY2025 +11.8% is +3.9% without acquisitions; Burgerizzr Jan–Sep 2026 +27.5% is +6.1% without SHOVEL.", K.gold],
    ["Debt is rising in places", mult(rr.l_to[1]), `Retailers' net debt / EBITDA, Sep 2026 (${mult(rr.l_from[1])} in FY2022)`, `All operating companies about ${mult(SIX.lev9m26)}, as in FY2022; malls ${mult(V.group_ratios.Malls.l_to[1])}; REIT loan to value ${pctP(OV.REITs.lev22, 0)} to ${pctP(OV.REITs.lev25, 0)} (FY2025).`, K.gold],
  ];
  O.forEach(([head, big, label, text, col], i) => {
    const x = X[i % 3], y = Y[Math.floor(i / 3)];
    box(s, x, y, W, H);
    numCircle(s, x + 0.2, y + 0.18, i + 1, 0.38);
    s.addText(head, { x: x + 0.7, y: y + 0.18, w: W - 0.9, h: 0.38, fontSize: 13.5, bold: true, color: K.navy, valign: "middle", margin: 0, isTextBox: true });
    s.addText(big, { x: x + 0.22, y: y + 0.66, w: W - 0.44, h: 0.56, fontSize: 28, bold: true, color: col, margin: 0, isTextBox: true });
    s.addText(label, { x: x + 0.22, y: y + 1.22, w: W - 0.44, h: 0.3, fontSize: 11, bold: true, color: K.ink, margin: 0, isTextBox: true });
    s.addText(text, { x: x + 0.22, y: y + 1.55, w: W - 0.44, h: H - 1.65, fontSize: 10.5, color: K.muted, valign: "top", margin: 0, isTextBox: true });
  });
  source(s, "Basis: slides 'Profit since 2022' and 'Margins since 2022'; 2026E method in the appendix. 2026E = Jan–Sep 2026 actual + Oct–Dec 2025 grown at the Jan–Sep revenue rate (corrected for deals already in Oct–Dec 2025); profit and EBITDA scaled by the same factor. ‡ Like-for-like: quantified deals removed; others and currency remain.");
}

// ================================================================== 4. the 47 companies, with revenue CAGR
{
  const ordered = D.overview.slice().sort((a, b) => VG[b.group].cagr - VG[a.group].cagr);
  const lo = ordered[ordered.length - 1], hi = ordered[0];
  const s = content(`The 47 companies benchmarked: revenue growth from 2022 to 2026E ranges from ${pct(VG[lo.group].cagr)} a year (${lo.label.toLowerCase()}) to ${pct(VG[hi.group].cagr)} (${hi.label.toLowerCase().replace(" platform", "")})`, "Summary");
  s.addText("Tadawul-listed companies in eight groups; revenue CAGR (compound annual growth) from FY2022 to 2026E unless marked; companies in order of FY2025 revenue", { x: 0.45, y: 1.26, w: 12.4, h: 0.26, fontSize: 11, italic: true, color: K.muted, margin: 0, isTextBox: true });
  const span = (b, e) => (b === "FY2022" && e === "2026E" ? "" : `${yr(b)} to ${yr(e)}`);
  const rows = [[TH("Group", "left"), TH("Companies"), TH("Revenue CAGR"), TH("Companies, revenue CAGR (in order of FY2025 revenue)", "left")]];
  for (const o of D.overview) {
    const gv = VG[o.group];
    const list = D.groups[o.group].rows.slice().sort((a, b) => (b.rev25 || 0) - (a.rev25 || 0));
    rows.push([TD(o.label, { bold: true, color: K.navy }), TD(String(o.n), { align: "center", bold: true }),
      TD([{ text: pct(gv.cagr), options: { bold: true, color: TONE[tone(gv.cagr)][0], breakLine: !!span(gv.base, gv.end) } }].concat(span(gv.base, gv.end) ? [{ text: span(gv.base, gv.end), options: { fontSize: 8, color: K.muted } }] : []), { align: "center", fill: { color: TONE[tone(gv.cagr)][1] } }),
      TD(list.flatMap((r, i) => { const cv = V.companies[r.ticker]; const sp = cv ? span(cv.base, cv.end) : "";
        return [{ text: SHORT_NAME(r.name) + " ", options: { color: K.ink } }, { text: cv && cv.cagr != null ? pct(cv.cagr) : "–", options: { color: cv && cv.cagr != null ? TONE[tone(cv.cagr)][0] : K.muted, bold: true } },
                { text: (sp ? ` (${sp})` : "") + (i < list.length - 1 ? "  ·  " : ""), options: { color: K.muted, fontSize: 9 } }]; }), { fontSize: 10 })]);
  }
  rows.push([TD("All 47 companies", { bold: true, fill: { color: K.total } }), TD("47", { align: "center", bold: true, fill: { color: K.total } }),
    TD(pct(VG.ALL.cagr), { align: "center", bold: true, color: K.steel, fill: { color: K.total } }),
    TD("Matched sample: each year compares only the companies with figures in both years; group totals are sums, not consolidated.", { fill: { color: K.total }, color: K.muted, fontSize: 10 })]);
  s.addTable(zebra(rows), { x: 0.45, y: 1.6, w: 12.4, colW: [2.2, 0.95, 1.15, 8.1], rowH: [0.45].concat(Array(9).fill(0.5)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "company list" });
  source(s, "2026E = Jan–Sep 2026 actual + Oct–Dec 2025 grown at the Jan–Sep 2026 rate (our estimate). Other start years where FY2022 is a short year or missing; REITs without Jan–Sep 2026 figures end at FY2025. Source: SEVEN priority companies workbook.");
}

// ================================================================== section 01
divider("01", "Since 2022: growth, profit and margins", "How did revenue, profit and margins move from 2022 to 2026? Revenue grew in seven of eight groups; profit and margins did not keep pace.", "01 Since 2022");
const LFLtxt = (x) => (x == null ? "" : x.flag === "n.d." ? "LFL n.d." : x.flag === "n.a." || x.lfl == null ? "" : `LFL ${pct(x.lfl)}${x.flag}`);
{
  const s = content("Revenue grew from 2022 to 2026E in seven of eight groups, at very different speeds", "01 Since 2022");
  const CATS = ["FY2022", "FY2023", "FY2024", "FY2025", "2026E"];
  const SER = [["All 47 companies", "ALL", K.navy], ["Delivery (Jahez)", "Platform", K.steel], ["Entertainment and leisure", "Entertainment", "6F8FB8"],
               ["Retailers", "Retailers", K.gold], ["Supporting goods", "Supporting", K.steelL], ["F&B operators", "FnB", "8C5A1E"]];
  chartTitle(s, 0.45, 1.35, 7.5, "Revenue index, FY2022 = 100 (matched growth each year, chained; 2026E estimated)");
  s.addChart(pres.charts.LINE, SER.map(([n, g]) => ({ name: n, labels: CATS.map((c) => (c === "2026E" ? "2026E" : c)), values: CATS.map((c) => VG[g].idx[c]) })), {
    x: 0.45, y: 1.7, w: 7.5, h: 4.8, chartColors: SER.map((x) => x[2]), lineSize: 2.25, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    catAxisLabelFontSize: 10.5, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: K.ink, valAxisLabelFontSize: 9.5, valAxisLabelFontFace: "+mn-lt", valAxisLabelColor: K.muted,
    valAxisMinVal: 80, valAxisMaxVal: 210, valAxisMajorUnit: 20, valGridLine: { color: "E5E7EB", size: 0.5 }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", legendFontSize: 10, legendFontFace: "+mn-lt", legendColor: K.ink, objectName: "revenue index chart" });
  const order = ["ALL", "Platform", "Entertainment", "Retailers", "REITs", "Supporting", "FnB", "Malls", "Media"];
  const lab = Object.fromEntries(D.overview.map((o) => [o.group, o.label])); lab.ALL = "All 47 companies";
  const rows = [[TH("Group", "left"), TH("Revenue CAGR"), TH("Like-for-like"), TH("Period")]];
  for (const g of order) {
    const x = VG[g];
    rows.push([TD(lab[g], { bold: g === "ALL", color: g === "ALL" ? K.navy : K.ink, fontSize: 10 }), gCell(x.cagr, null, null, { fs: 10 }),
      x.cagr_lfl == null ? TD("n.d.", { align: "center", color: K.muted, fontSize: 10 }) : TD(pct(x.cagr_lfl) + x.lfl_flag, { align: "center", bold: true, fontSize: 10, color: K.steel }),
      TD(`${yr(x.base)}–${yr(x.end)}`, { align: "center", color: K.muted, fontSize: 9.5 })]);
  }
  s.addTable(zebra(rows), { x: 8.2, y: 1.4, w: 4.65, colW: [1.9, 0.95, 0.95, 0.85], rowH: [0.42].concat(Array(9).fill(0.33)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "CAGR table" });
  card(s, 8.2, 4.95, 4.65, 1.55, "How 2026E is estimated", ["Jan–Sep 2026 actual + Oct–Dec 2025 grown at the company's Jan–Sep rate; Jahez and Burgerizzr corrected for deals already in Oct–Dec 2025. Our estimate (appendix)."], { fs: 10.5 });
  source(s, "Like-for-like (LFL): growth after removing every effect the filings quantify (deals, disposals, basis changes, hyperinflation); undisclosed currency effects stay in. n.d. where companies with unquantified deals hold over half of the revenue in a year; ‡ over a quarter. REITs (no 2026E), malls and media are in the table only.");
}
{
  const s = content("Growth by group: each year since 2022, January–September 2026, and the trend to 2026E, reported and like-for-like", "01 Since 2022");
  const READ = { Entertainment: "Growth slowing each year; gyms keep adding", Media: "FY2025 jump, then 2026 falls back", FnB: "Flat to 2024; recovery in 2025 and 2026",
                 Platform: "Fastest since 2022; Snoonu from Oct 2025", Malls: "Flat since 2023", REITs: "Accelerating to 2025, bought with debt",
                 Retailers: "Steady, +5% to +8% a year", Supporting: "2023 dip, then recovery", ALL: "About +5% a year since 2022" };
  const sub = (x) => ({ text: LFLtxt(x) || " ", options: { fontSize: 8.5, color: K.muted } });
  const cellL = (v, x) => { const c = gCell(v); c.text = [c.text[0], sub(x)]; c.text[0] = { text: c.text[0].text, options: Object.assign({}, c.text[0].options, { breakLine: true }) }; return c; };
  const rows = [[TH("Group", "left"), TH("FY2023 vs FY2022"), TH("FY2024 vs FY2023"), TH("FY2025 vs FY2024"), TH("Jan–Sep 2026 vs Jan–Sep 2025"), TH("CAGR to 2026E"), TH("Read across 2022 to 2026", "left")]];
  for (const o of D.overview.concat([{ group: "ALL", label: "All 47 companies", n: 47 }])) {
    const r = o.group === "ALL" ? null : (D.groups[o.group].total || D.groups[o.group].rows[0]);
    const st = VG[o.group].steps, x = VG[o.group];
    const rep = (i, key) => (r ? r.cells[i].v : st[key].rep);
    const cg = gCell(x.cagr); cg.text = [{ text: cg.text[0].text, options: Object.assign({}, cg.text[0].options, { breakLine: true }) },
      { text: (x.cagr_lfl == null ? "LFL n.d." : `LFL ${pct(x.cagr_lfl)}${x.lfl_flag}`) + (x.base === "FY2022" && x.end === "2026E" ? "" : ` · ${yr(x.base)}–${yr(x.end)}`), options: { fontSize: 8, color: K.muted } }];
    const tot = o.group === "ALL";
    const row = [TD([{ text: o.label, options: { bold: true, color: K.navy } }, { text: `  (${o.n})`, options: { color: K.muted } }], tot ? { fill: { color: K.total } } : {}),
      cellL(rep(0, "FY2023"), st.FY2023), cellL(rep(1, "FY2024"), st.FY2024), cellL(rep(2, "FY2025"), st.FY2025), cellL(rep(3, "9M"), st["9M"]), cg, TD(READ[o.group], tot ? { fill: { color: K.total }, bold: true } : {})];
    rows.push(row);
  }
  s.addTable(zebra(rows), { x: 0.45, y: 1.45, w: 12.4, colW: [2.55, 1.2, 1.2, 1.2, 1.45, 1.35, 3.45], rowH: [0.5].concat(Array(9).fill(0.455)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "growth by group table" });
  legend(s, 6.33, false);
  source(s, "Reported growth vs the year before (matched sample); n.a.: under 75% of group revenue covered; n.m.: short year. LFL: every effect the filings quantify removed (deals, disposals, basis changes, hyperinflation); undisclosed currency effects stay in; n.d. where companies with unquantified deals hold over half of the revenue, ‡ over a quarter. No company reports same-store sales.");
}

{
  const PT = D.v4.profit_table;
  const up = PT.filter((x) => x.higher).length;
  const s = content(`Profit since 2022: ${up} of ${PT.length} companies earn more attributable profit in 2026E than in FY2022`, "01 Since 2022");
  s.addText("Attributable profit, SAR m. 2026E = Jan–Sep 2026 actual + Oct–Dec 2025 profit scaled by the company's Oct–Dec revenue factor, so the Oct–Dec margin stays at its 2025 level.", { x: 0.45, y: 1.26, w: 12.4, h: 0.28, fontSize: 11, italic: true, color: K.muted, margin: 0, isTextBox: true });
  const GL = { Entertainment: "Leisure", Media: "Media", FnB: "F&B", Platform: "Delivery", Malls: "Malls", REITs: "REIT", Retailers: "Retail", Supporting: "Supporting" };
  const half = Math.ceil(PT.length / 2);
  const mk = (part) => {
    const rows = [[TH("Company", "left"), TH("FY2022"), TH("Jan–Sep 2026"), TH("2026E"), TH("2026E vs FY2022")]];
    for (const x of part) {
      const hi = x.higher;
      rows.push([TD([{ text: SHORT_NAME(x.name) + " ", options: { color: K.ink, bold: true } }, { text: GL[x.group], options: { color: K.muted, fontSize: 7.5 } }], { fontSize: 9, margin: [0.01, 0.06, 0.01, 0.07] }),
        TD(sar(x.fy22), { align: "right", fontSize: 9, margin: [0.01, 0.06, 0.01, 0.07] }), TD(sar(x.m26), { align: "right", fontSize: 9, color: K.muted, margin: [0.01, 0.06, 0.01, 0.07] }), TD(sar(x.e26), { align: "right", fontSize: 9, bold: true, margin: [0.01, 0.06, 0.01, 0.07] }),
        TD((hi ? "Higher" : "Lower") + (x.close ? " *" : ""), { align: "center", fontSize: 9, margin: [0.01, 0.06, 0.01, 0.07], bold: true, color: hi ? K.steel : K.goldD, fill: { color: hi ? K.posF : K.negF } })]);
    }
    return rows;
  };
  const opt = (x) => ({ x, y: 1.58, w: 6.1, colW: [2.15, 0.9, 1.05, 0.9, 1.1], rowH: [0.34].concat(Array(half).fill(0.243)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "profit table" });
  s.addTable(zebra(mk(PT.slice(0, half))), opt(0.45));
  s.addTable(zebra(mk(PT.slice(half))), opt(6.75));
  const ex = D.v4.profit_excluded;
  source(s, `Same count (${D.v4.six.ni_up_flat} of ${PT.length}) if Oct–Dec 2026 profit is held at its 2025 level. * Within 10% of FY2022. Left out (${ex.length}): ${ex.map((x) => SHORT_NAME(x.name)).join(", ")} (short or missing FY2022, or no Jan–Sep 2026 profit). Profit as reported, one-offs included. Source: workbook company sheets (NI_ATTR); 2026E calculated.`);
}
{
  const s = content(`Margins since 2022: lower in ${lowerCount("9M2026")} of 8 groups and about flat for all operating companies`, "01 Since 2022");
  s.addText("EBITDA margin excluding identified one-offs (REITs: FFO margin), group totals. Compared with FY2022, or the group's first full year.", { x: 0.45, y: 1.26, w: 12.4, h: 0.28, fontSize: 11, italic: true, color: K.muted, margin: 0, isTextBox: true });
  const lab = Object.fromEntries(D.overview.map((o) => [o.group, o.label]));
  const cellM = (v, base) => { const d = mDir(v, base);
    return TD(typeof v === "number" ? pctP(v) : "n.a.", { align: "center", bold: d !== null, color: d === -1 ? K.goldD : d === 1 ? K.steel : K.ink, fill: { color: d === -1 ? K.negF : d === 1 ? K.posF : K.white } }); };
  const verdict = (g) => {
    const m = MT[g];
    if (m.reit) return "Lower (FY2025; no 2026 figures)";
    const ds = ["FY2025", "9M2026", "2026E"].map((k) => mDir(m[k], m.m_base));
    if (ds.every((d) => d === -1)) return "Lower on every basis";
    if (ds.every((d) => d === 1)) return "Higher on every basis";
    return "Depends on the period";
  };
  const rows = [[TH("Group", "left"), TH("Base year"), TH("Base-year margin"), TH("FY2025"), TH("Jan–Sep 2026"), TH("2026E"), TH("Reading", "left")]];
  for (const o of D.overview) {
    const m = MT[o.group];
    rows.push([TD(lab[o.group], { bold: true, color: K.navy }), TD(yr(m.base), { align: "center", color: K.muted }), TD(pctP(m.m_base) + (m.reit ? " (FFO)" : ""), { align: "center", bold: true }),
      cellM(m.FY2025, m.m_base), cellM(m.reit ? null : m["9M2026"], m.m_base), cellM(m.reit ? null : m["2026E"], m.m_base), TD(verdict(o.group))]);
  }
  rows.push([TD(`All operating companies (${MA.n})`, { bold: true, fill: { color: K.total } }), TD("FY2022", { align: "center", color: K.muted, fill: { color: K.total } }), TD(pctP(MA.FY2022), { align: "center", bold: true, fill: { color: K.total } }),
    TD(pctP(MA.FY2025), { align: "center", fill: { color: K.total } }), TD(pctP(MA["9M2026"]), { align: "center", fill: { color: K.total } }), TD(pctP(MA["2026E"]), { align: "center", fill: { color: K.total } }),
    TD("About flat on every basis", { bold: true, fill: { color: K.total } })]);
  s.addTable(zebra(rows), { x: 0.45, y: 1.62, w: 12.4, colW: [2.6, 1.0, 1.4, 1.2, 1.3, 1.2, 3.7], rowH: [0.42].concat(Array(9).fill(0.4)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "margin table" });
  s.addText([{ text: "Count of groups below the base year: ", options: { bold: true, color: K.navy } },
             { text: `${lowerCount("9M2026")} of 8 on Jan–Sep 2026 (the headline), ${lowerCount("FY2025")} on FY2025, ${lowerCount("2026E")} on 2026E. The count is stable; which groups fall depends on the period for media, delivery and malls.`, options: { color: K.ink } }],
    { x: 0.45, y: 5.75, w: 12.4, h: 0.5, fontSize: 11.5, valign: "top", margin: 0, isTextBox: true });
  source(s, "Shading: below (gold) or above (blue) the base-year margin; within 0.05 points counts as unchanged. Base: FY2022; malls FY2023 (Cenomi Centers' nine-month FY2022); media FY2024. Jan–Sep margins are seasonal. Source: workbook group sheets (EBITDA_M_U, FFO_M; company sums for 2026E and the all-company row, matched sample).");
}

// ================================================================== section 02
divider("02", "2026 so far", "Is growth continuing in 2026, and is it turning into profit? January–September 2026 against the same months of 2025.", "02 2026 so far");
{
  const s = content("Jan–Sep 2026 vs 2025: revenue rose in every group shown, while attributable profit fell in three of five", "02 2026 so far");
  s.addText([{ text: "Attributable profit: ", options: { bold: true, color: K.navy } }, { text: "net profit attributable to the company's shareholders, after minority interests, as reported (one-off items included).", options: { color: K.ink } }], { x: 0.45, y: 1.3, w: 12.4, h: 0.28, fontSize: 11.5, margin: 0, isTextBox: true });
  const ov = D.overview.filter((o) => typeof o.g9 === "number" && typeof o.ni9 === "number");
  chartTitle(s, 0.45, 1.68, 7.9, "Revenue and attributable profit, 9M 2026 vs 9M 2025, %");
  s.addChart(pres.charts.BAR, [
    { name: "Revenue", labels: ov.map((o) => o.label), values: ov.map((o) => +(o.g9 * 100).toFixed(1)) },
    { name: "Attributable profit", labels: ov.map((o) => o.label), values: ov.map((o) => +(o.ni9 * 100).toFixed(1)) },
  ], barOpts({ x: 0.45, y: 2.0, w: 7.9, h: 4.5, chartColors: [K.steel, K.gold], dataLabelFormatCode: '+0.0"%";−0.0"%"', valAxisLabelFormatCode: '0"%"', valAxisMinVal: -40, valAxisMaxVal: 100, objectName: "revenue vs profit chart" }));
  card(s, 8.65, 1.72, 4.2, 1.5, "Growth is broad", [`9M revenue rose at ${C.rev_up} of ${C.rev_n} companies; fastest: delivery +37.5% (with Snoonu), F&B +11.6%; malls flat (+0.9%).`], { fs: 11.5 });
  card(s, 8.65, 3.34, 4.2, 1.5, "Profit is not", [`Attributable profit rose at ${C.ni_up} of ${C.ni_n}. Retailers −19.6% and supporting goods −8.8% despite higher revenue.`], { fs: 11.5 });
  card(s, 8.65, 4.96, 4.2, 1.54, "Two groups turned to losses", ["MBC (SAR 575m fair-value loss on ACSC and Anghami) and Jahez moved from profit to loss, so their profit growth is n.m."], { fs: 11.5 });
  source(s, "Group totals are sums of companies (not consolidated), matched sample. Media and Delivery are not plotted (profit turned to a loss); REIT 9M figures are n.a. (fact sheets cover too few funds). F&B profit growth is led by Americana (+60%). Source: SEVEN priority companies workbook.");
}
{
  const s = content("Group by group: what drove 9M 2026 against 9M 2025", "02 2026 so far");
  const DROVE = { Entertainment: "Gyms grow (Sport Clubs, Armah); Leejam slows; Baan shrinks", Media: "SAR 575m fair-value loss on ACSC and Anghami",
                  FnB: "Americana recovery; Alamar and Burgerizzr partly bought", Platform: "Snoonu adds revenue; Saudi delivery revenue fell 10%",
                  Malls: "Flat revenue; debt-funded development", REITs: "Revenue bought with debt; LTV 33% to 43%",
                  Retailers: "Margins slip; profit fell at 8 of 11 retailers", Supporting: "Food majors grow modestly; mills keep 31% to 41% margins" };
  const rows = [[TH("Group", "left"), TH("Revenue FY2025 vs FY2024"), TH("Revenue 9M 2026 vs 9M 2025"), TH("Attributable profit 9M 2026 vs 9M 2025"), TH("EBITDA margin 9M 2025 to 9M 2026"), TH("What drove it", "left")]];
  for (const o of D.overview) {
    const m = o.margin_kind === "FFO" ? `FFO margin ${pctP(o.margin25)} (FY2025)` : `${pctP(o.m["9M2025"])} to ${pctP(o.m["9M2026"])}`;
    const mUp = typeof o.m["9M2026"] === "number" && o.m["9M2026"] > o.m["9M2025"];
    rows.push([TD([{ text: o.label, options: { bold: true, color: K.navy } }, { text: `  (${o.n})`, options: { color: K.muted } }]),
      gCell(o.g25), gCell(o.g9), o.ni9 === "n.m." ? TD("n.m. (loss)", { align: "center", color: K.goldD, bold: true }) : gCell(o.ni9),
      TD(m, { align: "center", color: o.margin_kind === "FFO" ? K.ink : mUp ? K.steel : K.goldD, bold: o.margin_kind !== "FFO" }), TD(DROVE[o.group])]);
  }
  s.addTable(zebra(rows), { x: 0.45, y: 1.45, w: 12.4, colW: [2.75, 1.3, 1.3, 1.55, 1.75, 3.75], rowH: [0.6].concat(Array(8).fill(0.5)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "9M by group table" });
  legend(s, 6.2, false);
  source(s, "Totals are sums of companies on a matched sample. n.m. = profit turned to a loss; n.a. = under 75% of group revenue covered (REIT 9M fact sheets). Margin: EBITDA excluding identified one-offs (REITs: FFO margin, FY2025). Source: SEVEN priority companies workbook.");
}
{
  const s = content("Five of seven groups lost EBITDA margin in 9M 2026; only malls and F&B gained", "02 2026 so far");
  const gs = D.overview.filter((o) => o.margin_kind === "EBITDA");
  chartTitle(s, 0.45, 1.35, 7.9, "EBITDA margin excluding one-offs, group totals, %");
  s.addChart(pres.charts.BAR, [
    { name: "9M 2025", labels: gs.map((o) => o.label), values: gs.map((o) => +(o.m["9M2025"] * 100).toFixed(1)) },
    { name: "9M 2026", labels: gs.map((o) => o.label), values: gs.map((o) => +(o.m["9M2026"] * 100).toFixed(1)) },
  ], barOpts({ x: 0.45, y: 1.7, w: 7.9, h: 4.75, chartColors: [K.steelL, K.steel], dataLabelFormatCode: '0.0"%"', valAxisLabelFormatCode: '0"%"', valAxisMinVal: 0, valAxisMaxVal: 70, objectName: "margin chart" }));
  const fmt = (x) => `${x.name.replace(" International", "").replace(" Food Services", "").replace(" Restaurants", "")}: ${pctP(x.b)} to ${pctP(x.a)}`;
  card(s, 8.65, 1.4, 4.2, 2.45, "Largest falls", D.margins.down.filter((x) => x.name !== "Raydan Food").slice(0, 5).map(fmt), { fs: 11.5, hc: K.goldD });
  card(s, 8.65, 4.0, 4.2, 2.45, "Largest gains", D.margins.up.slice(0, 5).map(fmt), { fs: 11.5, hc: K.steel });
  source(s, "9M 2025 vs 9M 2026. Raydan (margin −16.4% to −53.7% as it winds down) is left out of the lists. Cenomi Centers' SAR 250m insurance claim (9M 2025) is excluded as a one-off; with it, malls' 9M margin would have fallen. Source: SEVEN priority companies workbook.");
}

{
  const s = content("Only 16 of 38 companies grew both revenue and profit in 9M 2026; 12 grew revenue but earned less", "02 2026 so far");
  const SHORTN = SHORT_NAME;
  const Q = { uu: [], ud: [], du: [], dd: [] };
  for (const [g, gd] of Object.entries(D.groups)) {
    if (g === "REITs") continue;
    for (const r of gd.rows) {
      const rg = r.cells[3].v, [b, a] = r.ni9 || [];
      if (typeof rg !== "number" || typeof a !== "number" || typeof b !== "number") continue;
      const lev = typeof r.lev === "number" && r.lev >= 5;
      const label = SHORTN(r.name) + (a < 0 ? " (loss)" : "") + (lev ? " ▲" : "");
      Q[(rg > 0 ? "u" : "d") + (a > b ? "u" : "d")].push(label);
    }
  }
  const n = Q.uu.length + Q.ud.length + Q.du.length + Q.dd.length;
  // axis labels
  s.addText("Attributable profit higher than 9M 2025", { x: 1.55, y: 1.35, w: 5.55, h: 0.3, fontSize: 11.5, bold: true, color: K.steel, align: "center", margin: 0, isTextBox: true });
  s.addText("Attributable profit lower, or a loss", { x: 7.3, y: 1.35, w: 5.55, h: 0.3, fontSize: 11.5, bold: true, color: K.goldD, align: "center", margin: 0, isTextBox: true });
  s.addText("Revenue up", { x: 0.45, y: 1.75, w: 0.95, h: 2.75, fontSize: 11.5, bold: true, color: K.navy, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("Revenue down", { x: 0.45, y: 4.62, w: 0.95, h: 1.75, fontSize: 11.5, bold: true, color: K.navy, align: "center", valign: "middle", margin: 0, isTextBox: true });
  const quad = (x, y, w, h, fill, head, list, col, cols = 2) => {
    box(s, x, y, w, h, fill);
    s.addText([{ text: String(list.length) + "  ", options: { fontSize: 22, bold: true, color: col } }, { text: head, options: { fontSize: 12, bold: true, color: K.ink } }],
      { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.45, valign: "middle", margin: 0, isTextBox: true });
    const per = Math.ceil(list.length / cols), cw = (w - 0.4) / cols;
    for (let c = 0; c < cols; c++) {
      const part = list.slice(c * per, (c + 1) * per);
      if (!part.length) continue;
      s.addText(part.map((t, i) => ({ text: t, options: { breakLine: i < part.length - 1 } })),
        { x: x + 0.2 + c * cw, y: y + 0.62, w: cw - 0.1, h: h - 0.72, fontSize: 11.5, color: K.ink, valign: "top", margin: 0, paraSpaceAfter: 1, isTextBox: true });
    }
  };
  quad(1.55, 1.75, 5.55, 2.75, K.posF, "Converting: revenue and profit up", Q.uu, K.steel);
  quad(7.3, 1.75, 5.55, 2.75, K.card, "Growing, but earning less", Q.ud, K.goldD);
  quad(1.55, 4.62, 5.55, 1.75, K.card, "Profit up on lower revenue", Q.du, K.steel, 1);
  quad(7.3, 4.62, 5.55, 1.75, K.negF, "Revenue and profit down", Q.dd, K.goldD, 2);
  if (n !== 38) throw new Error("screen count changed: " + n);
  source(s, "9M 2026 vs 9M 2025, attributable profit. ▲ net debt / EBITDA of 5x or more (FY2025). 38 companies: REITs left out (9M from fact sheets; loan to value instead of EBITDA) and TECO (revenue base under SAR 10m). Baan's 9M profit rests on a SAR 69.5m JV sale gain and insurance income. Source: SEVEN priority companies workbook.");
}

// ================================================================== section 03
divider("03", "Quality of growth and balance sheets", "How much growth is bought, one-off or price-driven, and which balance sheets are thin?", "03 Quality and balance sheets");
{
  const s = content("Without their acquisitions, growth is far lower at Jahez, BinDawood, Burgerizzr and Alamar; without land sales, ARDCO grows", "03 Quality and balance sheets");
  s.addText([{ text: "How to read: ", options: { bold: true, color: K.navy } },
             { text: "'Reported' is revenue growth as published. 'Without the deal' removes the revenue that the named acquisition or one-off sale added, as disclosed in the filings. Each company appears in the period its deal affects.", options: { color: K.ink } }],
    { x: 0.45, y: 1.28, w: 12.4, h: 0.5, fontSize: 11.5, valign: "top", margin: 0, isTextBox: true });
  const pick = (t) => D.pairs.find((p) => p.ticker === t);
  const panel = (y, h, head, items) => {
    chartTitle(s, 0.45, y, 7.4, head);
    s.addChart(pres.charts.BAR, [
      { name: "Reported", labels: items.map((x) => x[1]), values: items.map((x) => +(pick(x[0]).reported * 100).toFixed(1)) },
      { name: "Without the deal", labels: items.map((x) => x[1]), values: items.map((x) => +(pick(x[0]).adjusted * 100).toFixed(1)) },
    ], barOpts({ x: 0.45, y: y + 0.3, w: 7.4, h: h, chartColors: [K.steelL, K.steel], dataLabelFormatCode: '+0.0"%";−0.0"%"', valAxisLabelFormatCode: '0"%"', valAxisMinVal: -30, valAxisMaxVal: 40,
                 legendPos: "r", layout: { x: 0.38, y: 0.14, w: 0.45, h: 0.8 }, objectName: head }));
  };
  panel(1.9, 1.75, "Full year 2025 vs full year 2024", [["6017", "Jahez: without Snoonu (bought Oct 2025)"], ["4161", "BinDawood: without 2025 acquisitions"]]);
  panel(4.05, 2.3, "January–September 2026 vs January–September 2025", [["6016", "Burgerizzr: without SHOVEL cafés"], ["6014", "Alamar: without Five Guys"], ["4150", "ARDCO: without land sales"]]);
  const rowsT = [["Bought", "Snoonu (Jahez), acquisitions (BinDawood), SHOVEL (Burgerizzr), Five Guys (Alamar)."],
                 ["One-off or price", "ARDCO's land sales swing its headline; Lazurde's Jan–Sep 2026 +29.3% rides the gold price (volumes not disclosed)."],
                 ["Basis change", "Jarir changed its revenue basis in FY2024: +0.2% reported is +2.2% on one basis."],
                 ["Cannot be separated", "None of the 47 reports same-store sales, so growth from new stores cannot be isolated."],
                 ["Real conversion", "Sport Clubs Jan–Sep 2026 revenue +17.2%, profit +54%; Americana revenue +12.9%, profit +60%."]];
  box(s, 8.1, 1.9, 4.75, 4.6);
  s.addText(rowsT.flatMap(([h, t], i) => [{ text: h + ". ", options: { bold: true, color: i === 4 ? K.steel : K.navy } }, { text: t, options: { color: K.ink, breakLine: i < rowsT.length - 1 } }]),
    { x: 8.32, y: 2.08, w: 4.31, h: 4.3, fontSize: 12, valign: "top", margin: 0, paraSpaceAfter: 10, isTextBox: true });
  source(s, "Deal revenue as disclosed (Snoonu SAR 227.6m in FY2025; BinDawood SAR 448.5m from its four 2025 acquisitions, of which Zahrat Al Rawdah SAR 419.8m; SHOVEL SAR 55.7m; Five Guys SAR 46.9m) and land-sale revenue as booked. Alamar's figure still includes the Makkah and Taif branches it bought (revenue not disclosed). Source: SEVEN priority companies workbook, Adjustments sheet.");
}
{
  const s = content("Leverage is high in malls, parts of retail and a handful of companies; supporting goods deleveraged", "03 Quality and balance sheets");
  const top = D.leverage.top.map((x) => ({ ...x, name: x.name.replace("Abdullah Al Othaim Markets", "Othaim Markets").replace(" Property", "") }));
  chartTitle(s, 0.45, 1.35, 6.4, "Highest net debt / EBITDA, FY2025, x");
  s.addChart(pres.charts.BAR, [{ name: "Net debt / EBITDA", labels: top.map((x) => x.name), values: top.map((x) => +x.v.toFixed(1)) }],
    barOpts({ x: 0.45, y: 1.7, w: 6.4, h: 4.75, chartColors: [K.steel], showLegend: false, dataLabelFormatCode: '0.0"x"', valAxisLabelFormatCode: '0"x"', valAxisMinVal: 0, valAxisMaxVal: 50, objectName: "leverage chart" }));
  card(s, 7.1, 1.4, 5.75, 2.75, "Where it is thin", [
    `Malls ${mult(OV.Malls.lev25)} net debt/EBITDA (FY2025); REIT loan to value ${pctP(OV.REITs.lev22, 0)} to ${pctP(OV.REITs.lev25, 0)} (a different measure).`,
    `Retailers ${mult(OV.Retailers.lev22)} (FY2022) to ${mult(OV.Retailers.lev25)} (FY2025).`,
    "Lazurde: mostly gold borrowed from banks (SAR 1,932m), matched by gold stock; without it net debt is about nil.",
    "Entaj's 15.1x includes biological fair-value gains in EBITDA; Cenomi Retail has negative equity.",
  ], { fs: 11, hc: K.goldD });
  card(s, 7.1, 4.3, 5.75, 2.15, "Where it holds", [
    `Net cash at end-2025: ${D.leverage.netcash.map((x) => x.name.replace(" Beauty", "").replace(" Group", "")).join(", ")}.`,
    `Supporting goods fell from ${mult(OV.Supporting.lev22)} to ${mult(OV.Supporting.lev25)}; F&B ${mult(OV.FnB.lev22)} to ${mult(OV.FnB.lev25)}. Americana 0.6x, Nahdi 0.7x, Jahez 0.2x.`,
    "SAMA's repo rate rose to 4.5% in September 2026, which raises the cost of new and floating-rate borrowing.",
  ], { fs: 11, hc: K.steel });
  source(s, "Net debt = borrowings + leases − cash − short-term bank deposits. Americana's longer deposits (USD 117.8m) are not deducted. Source: SEVEN priority companies workbook; SAMA repo rate from KSA Budget FY2027 Overview (Nov 2026), p. 18.");
}

// ================================================================== appendix
divider("A", "Evidence: group tables and registers", "Every company and period behind the story, with key terms, one-offs and sources. Every figure and its filing page is in the workbook.", "Appendix");
{
  const s = content("Reading the analysis: key terms", "Appendix");
  const TERMS = [["Matched sample", "Group growth uses only companies with figures in both periods; group totals are sums, not consolidated."],
             ["Like-for-like (LFL)", "Growth after removing every effect the filings quantify (deals, disposals, basis changes, hyperinflation); n.d. where a deal is not quantified. Undisclosed currency effects stay in. No company reports same-store sales."],
             ["2026E", "Our estimate: Jan–Sep 2026 actual + Oct–Dec 2025 × the Jan–Sep revenue factor (corrected for deals already in Oct–Dec 2025), for revenue, EBITDA and profit alike."],
             ["Attributable profit", "Net profit attributable to the company's shareholders (after minority interests), as reported, one-off items included."],
             ["EBITDA excluding one-offs", "Operating income + depreciation, amortisation and impairments − investment-property fair-value gains, with identified one-off gains and losses taken out."],
             ["Net debt / EBITDA", "Borrowings + lease liabilities − cash − short-term bank deposits, over EBITDA (Jan–Sep annualised). Negative = net cash."],
             ["FFO, payout and loan to value (REITs)", "FFO = net income + real-estate depreciation and impairment − disposal gains; payout = distributions / FFO; loan to value = borrowings / total assets."],
             ["Without the deal", "A company's growth after removing one named acquisition or one-off sale (quality-of-growth slide); like-for-like removes all quantified effects."],
             ["n.m., n.a. and n.d.", "n.m.: not meaningful (short year, base under SAR 10m, or a loss). n.a.: under 75% of group revenue covered. n.d.: not disclosed."],
             ["Short year", "A financial year under 12 months after a year-end change (SADAFCO, Cenomi Centers, Cenomi Retail, MBC), or SADAFCO's non-calendar FY2022."]];
  TERMS.forEach(([h, t], i) => {
    const x = 0.45 + (i % 2) * 6.28, y = 1.32 + Math.floor(i / 2) * 1.06, w = 6.12, h2 = 0.96;
    box(s, x, y, w, h2);
    s.addText([{ text: h, options: { bold: true, color: K.navy, breakLine: true } }, { text: t, options: { color: K.ink } }],
      { x: x + 0.22, y: y + 0.1, w: w - 0.44, h: h2 - 0.16, fontSize: 11, valign: "top", margin: 0, isTextBox: true });
  });
  source(s, "Full definitions: workbook How_to_read and Definitions sheets.");
}
{
  const s = content("2026E: how the estimate is built, the correction for recent acquisitions, and how sensitive the headlines are", "Appendix");
  const F = D.v4.q4fix, VGu = (g) => VG[g].cagr_unfixed;
  card(s, 0.45, 1.4, 4.1, 5.1, "How 2026E is built", [
    "Revenue: Jan–Sep 2026 actual + Oct–Dec 2025 × (1 + the company's Jan–Sep 2026 revenue growth).",
    "EBITDA and attributable profit: Jan–Sep 2026 actual + Oct–Dec 2025 × the same factor, so the Oct–Dec margin stays at its 2025 level (Oct–Dec 2025 one-offs carry over).",
    "Net debt: actual at 30 Sep 2026, over Jan–Sep EBITDA annualised.",
    "REITs: only funds with Jan–Sep fact-sheet figures; REIT group 2026E is n.a.",
    "Our estimate, not a company forecast.",
  ], { fs: 11 });
  s.addText("Correction: deals already in the Oct–Dec 2025 base", { x: 4.75, y: 1.4, w: 8.1, h: 0.3, fontSize: 13, bold: true, color: K.navy, margin: 0, isTextBox: true });
  const rows = [[TH("Company", "left"), TH("Deal in the Oct–Dec 2025 base", "left"), TH("Treatment", "left"), TH("2026E revenue, SAR m")],
    [TD("Jahez", { bold: true, color: K.navy }), TD(`Snoonu, from 6 Oct 2025: SAR 227.6m of SAR ${sar(F["6017"].q4_25)}m Oct–Dec revenue`), TD("Oct–Dec held at the 2025 level (Snoonu's 2026 revenue not disclosed)"),
     TD(`${sar(F["6017"].rev26_unfixed)} → ${sar(F["6017"].rev26_fixed)}`, { align: "center", bold: true })],
    [TD("Burgerizzr", { bold: true, color: K.navy }), TD(`SHOVEL, from 27 Oct 2025: SAR 7.1m of SAR ${sar(F["6016"].q4_25)}m`), TD("Grown at +6.1%, the Jan–Sep rate without SHOVEL"),
     TD(`${sar(F["6016"].rev26_unfixed)} → ${sar(F["6016"].rev26_fixed)}`, { align: "center", bold: true })]];
  s.addTable(zebra(rows), { x: 4.75, y: 1.75, w: 8.1, colW: [1.25, 2.85, 2.6, 1.4], rowH: [0.38, 0.62, 0.55], border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "correction table" });
  s.addText([{ text: "Effect: ", options: { bold: true, color: K.navy } },
             { text: `delivery revenue growth to 2026E ${pct(VGu("Platform"))} → ${pct(VG.Platform.cagr)} a year; all 47 companies ${pct(VGu("ALL"))} → ${pct(VG.ALL.cagr)}; F&B ${pct(VGu("FnB"))} → ${pct(VG.FnB.cagr)}. Not corrected (each below 0.2% of its group's 2026E revenue): Almarai (Pure Beverages, Jul 2025), BinDawood (Toy Triangle, Oct 2025; The Digital Prototype, Jul 2025), Alamar (29 Makkah and Taif branches, Oct 2025, offset by Five Guys from Apr 2026), First Milling (Al-Kenan, Dec 2025).`, options: { color: K.ink } }],
    { x: 4.75, y: 3.4, w: 8.1, h: 1.2, fontSize: 11, valign: "top", margin: 0, isTextBox: true });
  card(s, 4.75, 4.7, 8.1, 1.8, "Sensitivity of the headlines", [
    `Profit: ${D.v4.six.ni_up} of ${D.v4.six.ni_n} above FY2022 whether Oct–Dec 2026 profit grows with revenue or is held at its 2025 level (${D.v4.six.ni_up_flat} of ${D.v4.six.ni_n}); ${D.v4.six.ni_close.length} companies are within 10% of FY2022.`,
    `Margins: lower than the base year in ${lowerCount("9M2026")} of 8 groups on Jan–Sep 2026, ${lowerCount("FY2025")} on FY2025, ${lowerCount("2026E")} on 2026E.`,
    `Jahez: if its business outside Snoonu followed the Saudi delivery trend (−10%) in Oct–Dec, 2026E revenue would be about SAR ${Math.round((F["6017"].q4_25 - 227.576) * 0.1)}m lower.`,
  ], { fs: 10.5 });
  source(s, "Almarai's bound uses the SAR 357m Jan–Sep rise in its 'other activities' revenue, which includes Pure Beverages; the others use the disclosed post-acquisition revenue. Source: workbook Adjustments sheet; company filings.");
}
{
  const s = content("Eight groups at a glance: retail and food carry the revenue; malls and leisure the margins", "Appendix");
  const rows = [[TH("Group", "left"), TH("Revenue FY2025 (SAR bn)"), TH("CAGR to 2026E"), TH("FY25 vs FY24"), TH("9M-26 vs 9M-25"), TH("Profit 9M y/y"), TH("Margin FY2025"), TH("Leverage FY2025"), TH("Largest (share)"), TH("What it means", "left")]];
  for (const o of D.overview) {
    rows.push([TD([{ text: o.label, options: { bold: true, color: K.navy, breakLine: true } }, { text: `${o.n} ${o.n > 1 ? "companies" : "company"}`, options: { fontSize: 8.5, color: K.muted } }]),
      TD((o.rev25 / 1000).toFixed(1), { align: "center", bold: true }), gCell(VG[o.group].cagr), gCell(o.g25), gCell(o.g9), gCell(o.ni9),
      TD([{ text: pctP(o.margin25), options: { bold: true, breakLine: true } }, { text: o.margin_kind === "FFO" ? "FFO" : "EBITDA", options: { fontSize: 8, color: K.muted } }], { align: "center" }),
      TD([{ text: o.lev_kind === "LTV" ? pctP(o.lev25) : mult(o.lev25), options: { bold: true, breakLine: true } }, { text: o.lev_kind === "LTV" ? "LTV" : "ND / EBITDA", options: { fontSize: 8, color: K.muted } }], { align: "center" }),
      TD([{ text: o.largest, options: { bold: true, breakLine: true } }, { text: `${pctP(o.share, 0)} of revenue`, options: { fontSize: 8, color: K.muted } }], { align: "center", fontSize: 10 }),
      TD(o.line, { fontSize: 9.5 })]);
  }
  s.addTable(zebra(rows), { x: 0.45, y: 1.4, w: 12.4, colW: [1.85, 0.9, 0.85, 0.85, 0.9, 0.85, 1.05, 1.0, 1.25, 2.9], rowH: [0.55].concat(Array(8).fill(0.54)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "group overview" });
  legend(s, 6.4, false);
  source(s, "CAGR to 2026E from FY2022 (malls from FY2023, media from FY2024; REITs to FY2025). n.a.: REIT 9M cover less than 75% of group revenue. n.m.: profit turned to a loss (Media, Delivery). Margin: EBITDA excluding identified one-offs (REITs: FFO margin). Source: SEVEN priority companies workbook.");
}
// group tables (native, editable)
const GROUP_SLIDES = [
  { t: "Entertainment and media: gyms grow; Baan shrinks; MBC falls back in 2026", parts: [["Entertainment", true], ["Media", false]] },
  { t: "F&B and delivery: Americana recovers; smaller chains shrink or buy growth", parts: [["FnB", true], ["Platform", false]] },
  { t: "Mall operators: flat revenue; the two largest carry 8x to 10x net debt", parts: [["Malls", true]] },
  { t: "Retail REITs: revenue bought with debt; FFO and payouts under pressure", parts: [["REITs", true]], reit: true },
  { t: "Retailers (1 of 2): revenue still grows; 9M profit fell at five of these six", parts: [["Retailers", true, ["4001", "4161", "4190", "4003", "4164", "4163"]]], note: "Grocery, electronics, books and pharmacy; group total covers all 11 retailers." },
  { t: "Retailers (2 of 2): 9M losses at SACO and Nice One; debt highest at Lazurde", parts: [["Retailers", false, ["4240", "4008", "4192", "4193", "4011"]]], note: "Fashion, home, beauty and jewellery; group total on the previous slide." },
  { t: "Supporting (1 of 2): Almarai and Tanmiah grow; SADAFCO shrinks", parts: [["Supporting", true, ["2280", "2050", "2270", "6010", "6001", "2281"]]], note: "Food, dairy and poultry producers (Savola includes the Panda supermarkets); group total covers all 13." },
  { t: "Supporting (2 of 2): mills keep 31% to 41% margins; Entaj has 15x net debt", parts: [["Supporting", false, ["2282", "2287", "2283", "2284", "2285", "2286", "4165"]]], note: "Water, poultry, flour mills and fragrance; group total on the previous slide." },
];
function shortBasis(b) {
  if (!b) return "";
  return b.replace(/^Not measurable: (.*) not disclosed$/, "Not measurable ($1 not disclosed)").replace("No acquisitions, FX or accounting effects", "No acquisitions, FX or accounting effects found");
}
for (const G of GROUP_SLIDES) {
  const s = content(G.t, "Appendix");
  s.addText((G.note ? G.note + " " : "") + (G.reit ? "Rental revenue growth vs the year before (9M from unaudited fact sheets, where printed); revenue compared underneath (SAR m)." : "Growth vs the year before; revenue compared underneath (SAR m)."),
    { x: 0.45, y: 1.0, w: 12.4, h: 0.28, fontSize: 10.5, italic: true, color: K.muted, margin: 0, isTextBox: true });
  const list = [];
  for (const [k, withTotal, only] of G.parts) {
    const g = D.groups[k];
    if (withTotal && g.total) list.push(Object.assign({}, g.total, { __g: k }));
    for (const r of g.rows) if (!only || only.includes(r.ticker)) list.push(r);
  }
  const nameCell = (r) => ({ text: [{ text: r.name.replace(": group total", " total"), options: { bold: true, fontSize: 10, color: r.total ? K.white : K.navy, breakLine: true } },
                                    { text: r.total ? r.sub.replace(" · FY2025 revenue ", " · ") : r.sub, options: { fontSize: 7.5, color: r.total ? K.goldL : K.muted } }],
                             options: { fill: { color: r.total ? K.navy : K.zebra }, valign: "middle", margin: CM } });
  const mCell = (r) => { const m = r.margin || {}; return TD([{ text: pctP(m.FY2025), options: { bold: true, breakLine: true } }, { text: typeof m["9M2026"] === "number" ? `9M ${pctP(m["9M2026"])} vs ${pctP(m["9M2025"])}` : " ", options: { fontSize: 7.5, color: K.muted } }], { align: "center" }); };
  const means = (r) => TD(r.line, { fontSize: 8.5, bold: !!r.total, fill: { color: r.total ? K.total : K.white } });
  let rows, colW;
  if (!G.reit) {
    rows = [[TH("Company", "left"), TH("FY23 vs FY22"), TH("FY24 vs FY23"), TH("FY25 vs FY24"), TH("9M-26 vs 9M-25"), TH("Like-for-like, 9M-26 vs 9M-25"), TH("Like-for-like basis", "left"), TH("EBITDA margin FY25"), TH("Net debt / EBITDA FY25"), TH("What it means", "left")]];
    for (const r of list) {
      const L = r.lfl9 || {};
      let adj, basis;
      if (r.total) {
        const x = VG[r.__g].steps["9M"];
        adj = x.flag === "n.d." || x.lfl == null ? TD("n.d.", { align: "center", color: K.muted, fill: { color: K.adjF } })
            : TD(pct(x.lfl) + x.flag, { align: "center", bold: true, color: TONE[tone(x.lfl)][0], fill: { color: K.adjF } });
        basis = TD(x.flag === "n.d." ? "Unquantified deals over half of revenue" : "Group: quantified deals removed" + (x.flag ? " (‡ unquantified deals over a quarter)" : ""), { fontSize: 8 });
      } else {
        adj = typeof L.v === "number" ? TD([{ text: pct(L.v), options: { bold: true, color: TONE[tone(L.v)][0], breakLine: true } }, { text: L.same ? "= reported" : "reported " + pct(r.cells[3].v), options: { fontSize: 7.5, color: K.muted } }], { align: "center", fill: { color: K.adjF } })
            : r.cells[3].v === "n.m." ? TD("n.m.", { align: "center", color: K.muted, fill: { color: K.adjF } })
            : TD("n.d.", { align: "center", color: K.muted, fill: { color: K.adjF } });
        basis = TD(L.basis || (r.cells[3].v === "n.m." ? "Base under SAR 10m" : ""), { fontSize: 7.5 });
      }
      rows.push([nameCell(r)].concat(r.cells.map((c) => gCell(c.v, c.a, c.b, { sub: true })), [adj, basis, mCell(r), TD(mult(r.lev), { align: "center", bold: true }), means(r)]));
    }
    colW = [1.62, 0.86, 0.86, 0.86, 0.9, 1.0, 1.4, 1.08, 0.75, 3.07];
  } else {
    rows = [[TH("Fund", "left"), TH("FY23 vs FY22"), TH("FY24 vs FY23"), TH("FY25 vs FY24"), TH("9M-26 vs 9M-25"), TH("FFO margin FY25"), TH("Loan to value FY25"), TH("Payout FY25"), TH("Net profit FY25 (SAR m)"), TH("What it means", "left")]];
    for (const r of list) rows.push([nameCell(r)].concat(r.cells.map((c) => gCell(c.v, c.a, c.b, { sub: true })),
      [mCell(r), TD(pctP(r.lev), { align: "center", bold: true }), TD(pctP(r.payout), { align: "center", bold: true }), TD(r.total ? "" : sar(r.ni25), { align: "center", bold: true }), means(r)]));
    colW = [1.75, 0.86, 0.86, 0.86, 0.9, 1.1, 0.95, 0.85, 0.9, 3.37];
  }
  const n = rows.length - 1, rh = Math.min(0.64, 4.55 / n);
  s.addTable(zebra(rows), { x: 0.45, y: 1.38, w: 12.4, colW, rowH: [0.46].concat(Array(n).fill(rh)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "group table" });
  legend(s, 6.48, !G.reit);
  source(s, G.reit ? "9M from unaudited fact sheets, so 9M group figures are n.a. FFO = net income + depreciation and impairment of real estate − disposal gains (we calculate). Payout = distributions / FFO. Source: SEVEN priority companies workbook."
                   : "Group total: sums of companies, matched-sample growth. EBITDA margin excludes identified one-offs. Net debt includes leases, less cash and short-term deposits. n.m.: short year, base under SAR 10m or a loss. Source: SEVEN priority companies workbook.");
}
{
  const s = content("What distorts the totals: one-offs, cross-holdings and short years", "Appendix");
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
  const rows = [[TH("Company", "left"), TH("Period"), TH("Item", "left"), TH("SAR m")]];
  for (const o of D.oneoffs.slice(0, 9)) {
    const item = ITEM[`${o.ticker}|${o.period}`];
    if (!item) throw new Error("no short label for one-off " + o.ticker + " " + o.period);
    rows.push([TD(o.name.replace("Abdullah Al Othaim Markets", "Othaim Markets"), { bold: true, color: K.navy }), TD(o.period.replace("9M", "9M "), { align: "center" }), TD(item, { fontSize: 10 }),
      TD((o.amount >= 0 ? "+" : "−") + sar(Math.abs(o.amount)), { align: "right", bold: true, color: o.amount >= 0 ? K.steel : K.goldD })]);
  }
  s.addTable(zebra(rows), { x: 0.45, y: 1.4, w: 7.6, colW: [1.7, 0.9, 4.1, 0.9], rowH: [0.42].concat(Array(9).fill(0.5)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "one-offs" });
  card(s, 8.3, 1.4, 4.55, 2.3, "Cross-holdings (counted twice)", ["Savola held 34.5% of Almarai until Dec 2024: SAR 0.6bn to 0.8bn of profit a year sits in both.", "Savola consolidates Herfy (49%); Alandalus consolidates Alahli REIT 1 (68.7%).", "Othaim's joint venture owns 70% of Fourth Milling."], { fs: 11 });
  card(s, 8.3, 3.82, 4.55, 1.3, "Short years left out of totals", "SADAFCO FY2022 and FY2023; Cenomi Centers and Cenomi Retail FY2022; MBC FY2023.", { fs: 11 });
  card(s, 8.3, 5.24, 4.55, 1.2, "Treatments kept", "Nahdi bank charges in finance costs; Entaj fair-value gains in EBITDA (memos in the workbook).", { fs: 11 });
  source(s, "Largest identified one-offs inside operating income (pre-tax), removed in 'EBITDA excluding one-offs'. Tax and minority effects are not disclosed, so net profit is kept as reported. Full registers: workbook One_offs and Cross_holdings sheets.");
}
{
  const s = content("Sources, checks and limits", "Appendix");
  const SRC = [["Company filings, Saudi Exchange archive", "Audited annual and reviewed interim statements, FY2021 to 9M 2026 (PDF; XBRL corrected from the PDFs)."],
               ["REIT fund fact sheets", "Unaudited; used only for REIT nine-month figures."],
               ["SEVEN priority companies workbook (27 Nov 2026)", "Every figure with its file and page; registers of adjustments, one-offs, restatements and cross-holdings."],
               ["KSA Budget FY2027 Overview (Nov 2026)", "SAMA repo rate (balance-sheet slide), citing SAMA."],
               ["BinDawood results announcement (via Mubasher)", "9M 2026 attributable profit down 3.4% (SAR 155.5m vs 161.0m); confirms five of six retailers on the Retailers (1 of 2) slide lost profit."]];
  s.addText(SRC.flatMap(([h, t], i) => [{ text: h, options: { bold: true, color: K.navy, breakLine: true } }, { text: t, options: { color: K.muted, fontSize: 10.5, breakLine: i < SRC.length - 1 } }]),
    { x: 0.45, y: 1.4, w: 6.0, h: 5.1, fontSize: 12, valign: "top", margin: 0, paraSpaceAfter: 10, isTextBox: true });
  card(s, 6.75, 1.4, 2.95, 5.05, "Checks", ["Analyst's own checks: 5,791 core figures compared with the PDFs; a 94-figure sample (93 confirmed). We did not re-perform these.",
       "Our review of 27 Nov 2026: 17,798 formulas recalculated without error; 65 of 65 FY2025 inputs found in the PDFs for five companies, plus targeted checks.", "Not a full re-verification of every figure, and not an audit."], { fs: 10.5 });
  card(s, 9.9, 1.4, 2.95, 5.05, "Limits", ["9M 2026 is a partial year, compared only with 9M 2025.", "REIT 9M figures are n.a. (fact sheets cover too few funds).",
       "No same-store sales or currency effects disclosed.", "Deposit restrictions and pledges not checked.", "2026E is our estimate, not a company forecast."], { fs: 10.5 });
  source(s, "Figures in SAR unless stated; Americana converted from USD at 3.75.");
}

await pres.writeFile({ fileName: OUT });
await applyTheme(OUT, THEME);
console.log("deck ->", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
