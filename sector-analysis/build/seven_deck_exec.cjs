// SEVEN priority companies: executive deck (v2), in the house style of the "KSA Budget FY2027 Overview" deck:
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
  const items = [["Above +2%", K.posF, K.steel], ["−2% to +2%", K.white, K.steelL], ["Below −2%", K.negF, K.goldD]].concat(withAdj ? [["Adjusted growth", K.adjF, K.navy]] : []);
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
  s.addText("How 47 Saudi-listed competitors, partners, tenants and comparators performed from FY2022 to 9M 2026, and what it means for SEVEN", { placeholder: "body" });
  s.addText("November 2026  |  Company filings to 9M 2026 and fund fact sheets  |  Figures as of 27 November 2026", { x: 0.6, y: 4.95, w: 8.5, h: 0.3, fontSize: 10, color: K.pale, margin: 0, isTextBox: true });
  s.addText("Entertainment and leisure · media · F&B · delivery · malls · retail REITs · retailers · supporting consumer goods", { x: 0.6, y: 6.55, w: 9, h: 0.3, fontSize: 10, color: K.foot, margin: 0, isTextBox: true });
  s.addNotes("Built from the reviewed workbook SEVEN_Priority_Companies.xlsx (27 November 2026). Every company figure in this deck is in that workbook with its filing and page.");
}

// ================================================================== 2. executive summary (one page: exercise | sectors | outcomes)
{
  const s = content("Executive summary: we benchmarked 47 listed companies in eight groups; revenue keeps growing, but profit is not following everywhere", "Summary");
  const y0 = 1.42, h0 = 4.78;
  const P = [[0.45, 3.55], [4.15, 4.2], [8.5, 4.35]];
  P.forEach(([x, w]) => box(s, x, y0, w, h0));
  // panel 1: the exercise
  iconHead(s, P[0][0] + 0.2, y0 + 0.18, ICON.exercise, "The exercise", P[0][1] - 0.4);
  const ex = [["Why. ", "Benchmark the listed companies that are SEVEN's competitors, potential partners and tenants, or comparators."],
              ["What. ", "47 Saudi-listed companies in eight groups. Revenue growth (reported and adjusted), attributable profit, EBITDA margin excluding one-offs, and net debt (REITs: FFO and loan to value)."],
              ["When. ", "FY2022 to FY2025, each year against the year before; 9M 2026 against 9M 2025."],
              ["How. ", "Audited and reviewed filings from the Saudi Exchange archive (REIT 9M from fact sheets). Every figure is traced to its filing page in a reviewed workbook."]];
  s.addText(ex.flatMap(([h, t], i) => [{ text: h, options: { bold: true, color: K.navy } }, { text: t, options: { breakLine: i < ex.length - 1 } }]),
    { x: P[0][0] + 0.22, y: y0 + 0.82, w: P[0][1] - 0.44, h: h0 - 0.95, fontSize: 12, color: K.ink, valign: "top", margin: 0, paraSpaceAfter: 10, isTextBox: true });
  // panel 2: benchmarked groups with example companies
  iconHead(s, P[1][0] + 0.2, y0 + 0.18, ICON.groups, "What we benchmarked", P[1][1] - 0.4);
  const EX = { Entertainment: "Leejam Sports, Sport Clubs, Armah, Baan", Media: "MBC Group", FnB: "Americana, Herfy, Alamar, Burgerizzr",
               Platform: "Jahez", Malls: "Cenomi Centers, Alandalus, ARDCO", REITs: "Bonyan, SEDCO Capital, Alahli REIT 1",
               Retailers: "Jarir, Othaim, Nahdi, eXtra, BinDawood", Supporting: "Savola, Almarai, NADEC, SADAFCO, four flour mills" };
  s.addText(D.overview.flatMap((o, i) => [{ text: `${o.label} `, options: { bold: true, color: K.navy } }, { text: `(${o.n}; SAR ${(o.rev25 / 1000).toFixed(1)}bn): `, options: { color: K.muted } },
                                          { text: EX[o.group], options: { color: K.ink, breakLine: i < D.overview.length - 1 } }]),
    { x: P[1][0] + 0.22, y: y0 + 0.82, w: P[1][1] - 0.44, h: h0 - 0.95, fontSize: 12, valign: "top", margin: 0, paraSpaceAfter: 9, isTextBox: true });
  // panel 3: key outcomes
  iconHead(s, P[2][0] + 0.2, y0 + 0.18, ICON.outcomes, "Key outcomes", P[2][1] - 0.4);
  const OUT = [["Growth since 2022. ", "Revenue grew in all six groups with a full 2022 base; fastest: delivery +13.2% and leisure +11.4% a year."],
               ["Still growing in 2026. ", `9M revenue rose at ${C.rev_up} of ${C.rev_n} companies; only Media fell (MBC −22.8%).`],
               ["Profit is not following. ", `Profit rose at only ${C.ni_up} of ${C.ni_n}, and only 16 of 38 grew both revenue and profit; retailers −19.6%, malls −18.5%, while leisure and F&B gained.`],
               ["Margins slip ", "in five of seven groups in 9M 2026."],
               ["Some growth is bought. ", "Jahez FY2025 +4.7% is −5.5% without Snoonu; BinDawood +11.8% is +3.9% without acquisitions."],
               ["Debt is high in places. ", `Malls ${mult(OV.Malls.lev25)} net debt/EBITDA; retailers ${mult(OV.Retailers.lev22)} to ${mult(OV.Retailers.lev25)}; REIT loan to value ${pctP(OV.REITs.lev25, 0)}.`]];
  s.addText(OUT.flatMap(([h, t], i) => [{ text: `${i + 1}  `, options: { bold: true, color: K.gold } }, { text: h, options: { bold: true, color: K.navy } },
                                        { text: t, options: { color: K.ink, breakLine: i < OUT.length - 1 } }]),
    { x: P[2][0] + 0.22, y: y0 + 0.82, w: P[2][1] - 0.44, h: h0 - 0.95, fontSize: 12, valign: "top", margin: 0, paraSpaceAfter: 8, isTextBox: true });
  navyBar(s, 6.3, "So what for SEVEN (our judgment): favour partners and tenants that turn growth into profit with modest debt; stress-test the leveraged ones.", 0.42);
  s.addText("Growth on a matched sample; 9M counts cover companies with both 9M periods. Source: SEVEN priority companies workbook (reviewed 27 Nov 2026).", { x: 0.45, y: 6.78, w: 12.4, h: 0.2, fontSize: 8.5, color: K.muted, margin: 0, isTextBox: true });
}

// ================================================================== 3. six numbers
{
  const s = content("Key outcomes in six numbers", "Summary");
  const rev = D.overview.reduce((a, o) => a + o.rev25, 0) / 1000;
  const W = 4.0, H = 2.25, X = [0.45, 4.65, 8.85], Y = [1.35, 3.8];
  kpi(s, X[0], Y[0], W, H, `SAR ${Math.round(rev)}bn`, "Combined revenue, FY2025", "47 companies in eight groups; a sum, not consolidated. Herfy and Alahli REIT 1 (about SAR 1.3bn) also sit inside Savola and Alandalus.");
  kpi(s, X[1], Y[0], W, H, `${C.rev_up} of ${C.rev_n}`, "Grew revenue in 9M 2026", "vs 9M 2025; six of seven groups with a comparable 9M grew. Fastest: delivery +37.5% (with Snoonu), F&B +11.6%.");
  kpi(s, X[2], Y[0], W, H, `${C.ni_up} of ${C.ni_n}`, "Grew attributable profit", "in 9M 2026. MBC and Jahez moved from profit to loss; retailers' profit fell 19.6% on 5.1% more revenue.", K.gold);
  kpi(s, X[0], Y[1], W, H, "5 of 7", "Groups lost EBITDA margin", `in 9M 2026 (excluding one-offs). Margins rose at ${C.m_up} of ${C.m_n} companies.`, K.gold);
  kpi(s, X[1], Y[1], W, H, mult(OV.Retailers.lev25), "Retailers' net debt / EBITDA", `FY2025, up from ${mult(OV.Retailers.lev22)} in FY2022. Malls ${mult(OV.Malls.lev25)}; supporting goods down to ${mult(OV.Supporting.lev25)}.`);
  kpi(s, X[2], Y[1], W, H, pctP(OV.REITs.lev25, 0), "Retail REIT loan to value", `FY2025, up from ${pctP(OV.REITs.lev22, 0)} in FY2022, as funds bought property with debt.`);
  source(s, "Source: SEVEN priority companies workbook (27 Nov 2026). Group totals are sums of companies; growth on a matched sample. Net debt = borrowings + leases − cash − short-term bank deposits.");
}

// ================================================================== 4. the 47 companies
{
  const s = content("The 47 companies benchmarked: eight groups, from SAR 1.2bn of revenue (REITs) to SAR 65bn (supporting goods)", "Summary");
  s.addText("Companies in eight groups that are SEVEN's competitors, potential partners and tenants, or comparators; FY2025 revenue in SAR bn", { x: 0.45, y: 1.22, w: 12.4, h: 0.28, fontSize: 11.5, italic: true, color: K.muted, margin: 0, isTextBox: true });
  const fmt = (v) => (v < 100 ? "<0.1" : (v / 1000).toFixed(1));
  const rows = [[TH("Group", "left"), TH("Companies"), TH("Revenue FY2025 (SAR bn)"), TH("Companies, by FY2025 revenue (SAR bn)", "left")]];
  for (const o of D.overview) {
    const list = D.groups[o.group].rows.slice().sort((a, b) => (b.rev25 || 0) - (a.rev25 || 0));
    rows.push([TD(o.label, { bold: true, color: K.navy }), TD(String(o.n), { align: "center", bold: true }), TD((o.rev25 / 1000).toFixed(1), { align: "center", bold: true, color: K.steel }),
      TD(list.flatMap((r, i) => [{ text: SHORT_NAME(r.name), options: { color: K.ink } }, { text: ` ${fmt(r.rev25)}` + (i < list.length - 1 ? "  ·  " : ""), options: { color: K.muted } }]), { fontSize: 10.5 })]);
  }
  rows.push([TD("Total", { bold: true, fill: { color: K.total } }), TD("47", { align: "center", bold: true, fill: { color: K.total } }),
    TD((D.overview.reduce((a, o) => a + o.rev25, 0) / 1000).toFixed(0), { align: "center", bold: true, fill: { color: K.total } }),
    TD("A sum, not consolidated: Herfy and Alahli REIT 1 (about SAR 1.3bn) are also inside Savola and Alandalus.", { fill: { color: K.total }, color: K.muted, fontSize: 10 })]);
  s.addTable(zebra(rows), { x: 0.45, y: 1.6, w: 12.4, colW: [2.35, 1.0, 1.25, 7.8], rowH: [0.45].concat(Array(9).fill(0.5)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "company list" });
  source(s, "Short company names. Source: SEVEN priority companies workbook (27 Nov 2026); company filings from the Saudi Exchange archive. Full legal names are in the workbook's company sheets.");
}

// ================================================================== 5. backdrop
{
  const s = content("The backdrop: GDP contracts in 2026, but consumer spending still grows, and is moving online", "Summary");
  const cats = [["Clothing & footwear", 21], ["Food & beverages", 15], ["Hotels", 9], ["Restaurants & cafés", 9], ["Jewellery", 5], ["Electronics", 2], ["Culture & recreation", -3], ["Furniture", -13]];
  chartTitle(s, 0.45, 1.35, 5.6, "Card (POS) spending by category, Sep 2026, % y/y (approx.)");
  s.addChart(pres.charts.BAR, [{ name: "POS spending, % y/y", labels: cats.map((c) => c[0]), values: cats.map((c) => c[1]) }],
    barOpts({ x: 0.45, y: 1.7, w: 5.6, h: 4.6, chartColors: [K.steel], invertedColors: [K.gold], showLegend: false, dataLabelFormatCode: '+0;−0', valAxisLabelFormatCode: "0",
              valAxisMinVal: -15, valAxisMaxVal: 25, valAxisHidden: true, valGridLine: { style: "none" }, objectName: "POS by category chart" }));
  const k = [["−2.1%", "Real GDP, 2026 (MoF est.)", "+10.9% budgeted for 2027, oil-led", K.gold],
             ["+1.9%", "Real non-oil GDP, Q3 2026", "y/y; non-oil is a record 57.7% of GDP", K.navy],
             ["SAR 138bn", "Consumer spending, Sep 2026", "+7% y/y; e-commerce +28%, POS +4%", K.navy],
             ["+2.7%", "Real private consumption, H1", "y/y; MoF projects +4.2% in 2027", K.navy],
             ["+34%", "Delivery orders", "to Q3 2026, y/y (Jadwa)", K.navy],
             ["4.5%", "SAMA repo rate", "raised in Sep 2026; dearer debt", K.gold]];
  k.forEach(([b, l, sub, col], i) => {
    const x = 6.35 + (i % 2) * 3.27, y = 1.35 + Math.floor(i / 2) * 1.32, w = 3.12, h = 1.2;
    box(s, x, y, w, h);
    s.addText(b, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.45, fontSize: 21, bold: true, color: col, margin: 0, isTextBox: true });
    s.addText(l, { x: x + 0.2, y: y + 0.55, w: w - 0.4, h: 0.27, fontSize: 11, bold: true, color: K.ink, margin: 0, isTextBox: true });
    s.addText(sub, { x: x + 0.2, y: y + 0.82, w: w - 0.4, h: 0.3, fontSize: 9.5, color: K.muted, margin: 0, isTextBox: true });
  });
  s.addText([{ text: "Read-across (our reading): ", options: { bold: true, color: K.navy } },
             { text: "dining and apparel spending grows while recreation and furniture fall; market delivery orders rose 34% while Jahez's Saudi delivery revenue fell 10% in 9M (different measures); higher rates weigh most on the leveraged names in section 03.", options: { color: K.ink } }],
    { x: 6.35, y: 5.35, w: 6.5, h: 1.05, fontSize: 11, valign: "top", margin: 0, isTextBox: true });
  source(s, "Source: KSA Budget FY2027 Overview (Nov 2026), pp. 2, 13, 17, 18, 21, 22, citing MoF Budget Statement FY2027, SAMA, GASTAT and Jadwa Investment (Saudi Chartbook, Nov 2026). POS category growth is approximate (±1 pp), read from Jadwa's chart. Jahez: company filings.");
}

// ================================================================== section 01
divider("01", "Growth since 2022", "How did revenue move from 2022 to 2025? It grew in all six groups with a full 2022 base, at very different speeds.", "01 Growth since 2022");
{
  const s = content("Revenue grew from 2022 to 2025 in all six groups with a full base, at very different speeds", "01 Growth since 2022");
  const SER = [["Delivery (Jahez)", "Platform", K.navy], ["Entertainment and leisure", "Entertainment", K.steel], ["Retailers", "Retailers", K.gold],
               ["Retail REITs", "REITs", "6F8FB8"], ["Supporting goods", "Supporting", K.steelL], ["F&B operators", "FnB", "8C5A1E"]];
  const idx = SER.map(([n, g]) => { const r = D.groups[g].total || D.groups[g].rows[0]; let v = 100; const out = [100]; for (let i = 0; i < 3; i++) { v *= 1 + r.cells[i].v; out.push(+v.toFixed(1)); } return out; });
  chartTitle(s, 0.45, 1.35, 7.7, "Revenue index, FY2022 = 100 (yearly matched growth, chained)");
  s.addChart(pres.charts.LINE, SER.map(([n], i) => ({ name: n, labels: ["FY2022", "FY2023", "FY2024", "FY2025"], values: idx[i] })), {
    x: 0.45, y: 1.7, w: 7.7, h: 4.75, chartColors: SER.map((x) => x[2]), lineSize: 2.25, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    catAxisLabelFontSize: 10.5, catAxisLabelFontFace: "+mn-lt", catAxisLabelColor: K.ink, valAxisLabelFontSize: 9.5, valAxisLabelFontFace: "+mn-lt", valAxisLabelColor: K.muted,
    valAxisMinVal: 80, valAxisMaxVal: 150, valAxisMajorUnit: 10, valGridLine: { color: "E5E7EB", size: 0.5 }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", legendFontSize: 10, legendFontFace: "+mn-lt", legendColor: K.ink, objectName: "revenue index chart" });
  // right panel: end points and CAGR
  const rows = [[TH("Group", "left"), TH("FY2025 index"), TH("CAGR 2022–25")]];
  SER.forEach(([n, g, col], i) => rows.push([
    { text: [{ text: "■ ", options: { color: col, fontSize: 12 } }, { text: n, options: { color: K.ink } }], options: { fontSize: 10.5, valign: "middle", margin: CM } },
    TD(idx[i][3].toFixed(1), { align: "center", bold: true }), gCell(OV[g].cagr, null, null)]));
  s.addTable(zebra(rows), { x: 8.45, y: 1.4, w: 4.4, colW: [2.2, 1.05, 1.15], rowH: 0.36, border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "index end points" });
  card(s, 8.45, 4.15, 4.4, 2.3, "What the filings show", [
    "Delivery +45%, helped by Snoonu in FY2025.",
    "Leisure +38%, led by gyms; yearly growth slows from +16.8% to +6.6%.",
    "Retailers +6% to +8% every year.",
    "REITs mostly in FY2025 (+10.0%), bought with debt.",
    "F&B fell 8.3% in FY2024, then recovered.",
  ], { fs: 11 });
  source(s, "Constructed index, not a fixed cohort: each year's matched-sample group growth, chained from 100; end points agree with the 2022–25 CAGRs within rounding. Malls (FY2022 nine-month year at Cenomi Centers) and Media (short year) have no clean 2022 base. Source: SEVEN priority companies workbook.");
}
{
  const s = content("Growth by group: yearly revenue growth 2022 to 2025, and the matched 9M 2026", "01 Growth since 2022");
  const READ = { Entertainment: "Growth slowing each year; gyms keep adding", Media: "FY2025 jump, then 9M 2026 falls back", FnB: "Flat 2022 to 2025; 2025 and 2026 recovery",
                 Platform: "Strongest since 2022; 2026 helped by Snoonu", Malls: "Flat: +3.3% then +0.3%; FY2022 n.a.", REITs: "Revenue accelerating, bought with debt",
                 Retailers: "Steady growth, slowing in 2026", Supporting: "FY2023 dip, then recovery" };
  const rows = [[TH("Group", "left"), TH("FY2023 vs FY2022"), TH("FY2024 vs FY2023"), TH("FY2025 vs FY2024"), TH("CAGR 2022–25"), TH("9M 2026 vs 9M 2025"), TH("Read across 2022 to 2026", "left")]];
  for (const o of D.overview) {
    const r = D.groups[o.group].total || D.groups[o.group].rows[0];
    rows.push([TD([{ text: o.label, options: { bold: true, color: K.navy } }, { text: `  (${o.n})`, options: { color: K.muted } }]),
      gCell(r.cells[0].v), gCell(r.cells[1].v), gCell(r.cells[2].v), gCell(o.cagr), gCell(r.cells[3].v), TD(READ[o.group])]);
  }
  s.addTable(zebra(rows), { x: 0.45, y: 1.45, w: 12.4, colW: [2.75, 1.25, 1.25, 1.25, 1.15, 1.35, 3.4], rowH: [0.55].concat(Array(8).fill(0.5)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "growth by group table" });
  legend(s, 6.15, false);
  source(s, "Growth vs the year before; 9M 2026 vs 9M 2025 only. Totals are sums of companies on a matched sample. n.a.: under 75% of group revenue covered (malls FY2022, REIT 9M). n.m.: short year or base under SAR 10m (MBC FY2023). Source: SEVEN priority companies workbook.");
}

// ================================================================== section 02
divider("02", "2026 so far", "Is growth continuing in 2026, and is it turning into profit? Revenue rose in six of seven groups; profit and margins split.", "02 2026 so far");
{
  const s = content("Matched 9M 2026: revenue rose in every group with a comparable profit figure; profit fell in three of five", "02 2026 so far");
  const ov = D.overview.filter((o) => typeof o.g9 === "number" && typeof o.ni9 === "number");
  chartTitle(s, 0.45, 1.35, 7.9, "Revenue and attributable profit, 9M 2026 vs 9M 2025, %");
  s.addChart(pres.charts.BAR, [
    { name: "Revenue", labels: ov.map((o) => o.label), values: ov.map((o) => +(o.g9 * 100).toFixed(1)) },
    { name: "Attributable profit", labels: ov.map((o) => o.label), values: ov.map((o) => +(o.ni9 * 100).toFixed(1)) },
  ], barOpts({ x: 0.45, y: 1.7, w: 7.9, h: 4.75, chartColors: [K.steel, K.gold], dataLabelFormatCode: '+0.0"%";−0.0"%"', valAxisLabelFormatCode: '0"%"', valAxisMinVal: -40, valAxisMaxVal: 100, objectName: "revenue vs profit chart" }));
  card(s, 8.65, 1.4, 4.2, 1.6, "Growth is broad", [`9M revenue rose at ${C.rev_up} of ${C.rev_n} companies; fastest: delivery +37.5% (with Snoonu), F&B +11.6%; malls flat (+0.9%).`], { fs: 11.5 });
  card(s, 8.65, 3.12, 4.2, 1.6, "Profit is not", [`Attributable profit rose at ${C.ni_up} of ${C.ni_n}. Retailers −19.6% and supporting goods −8.8% despite higher revenue.`], { fs: 11.5 });
  card(s, 8.65, 4.84, 4.2, 1.6, "Two groups turned to losses", ["MBC (SAR 575m fair-value loss on ACSC and Anghami) and Jahez moved from profit to loss, so their profit growth is n.m."], { fs: 11.5 });
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

// ================================================================== section 03
divider("03", "Quality of growth and balance sheets", "How much growth is bought, one-off or price-driven, and which balance sheets are thin?", "03 Quality and balance sheets");
{
  const s = content("For several companies, headline growth is bought, one-off, price-driven or a change of basis", "03 Quality and balance sheets");
  const SHORT = { "6017": "Jahez FY25: excl. Snoonu", "4161": "BinDawood FY25: excl. acquisitions", "6016": "Burgerizzr 9M: excl. SHOVEL", "6014": "Alamar 9M: excl. Five Guys",
                  "4150": "ARDCO 9M: excl. land sales", "4190": "Jarir FY24: same basis", "2287": "Entaj FY24: same basis" };
  const ORDER = ["6017", "4161", "6016", "6014", "4150", "4190", "2287"];
  const P = ORDER.map((t) => D.pairs.find((p) => p.ticker === t));
  chartTitle(s, 0.45, 1.35, 7.2, "Reported vs adjusted revenue growth, same period, %");
  s.addChart(pres.charts.BAR, [
    { name: "Reported", labels: P.map((p) => SHORT[p.ticker]), values: P.map((p) => +(p.reported * 100).toFixed(1)) },
    { name: "Adjusted", labels: P.map((p) => SHORT[p.ticker]), values: P.map((p) => +(p.adjusted * 100).toFixed(1)) },
  ], barOpts({ x: 0.45, y: 1.7, w: 7.2, h: 4.75, chartColors: [K.steelL, K.steel], dataLabelFormatCode: '+0.0;−0.0', valAxisLabelFormatCode: "0", valAxisMinVal: -30, valAxisMaxVal: 40, objectName: "reported vs adjusted chart" }));
  const rowsT = [["Bought", "Snoonu (Jahez), acquisitions (BinDawood), SHOVEL (Burgerizzr), Five Guys (Alamar)."],
                 ["One-off or price", "ARDCO's land sales swing the headline; Lazurde 9M +29.3% rides the gold price (volumes not disclosed)."],
                 ["Basis change", "Jarir and Entaj changed revenue bases; on one basis Jarir FY2024 is +2.2%."],
                 ["Cannot be separated", "None of the 47 reports same-store sales, so growth from new stores cannot be isolated."],
                 ["Real conversion", "Sport Clubs 9M revenue +17.2%, profit +54% at a steady 42% margin; Americana revenue +12.9%, profit +60%."]];
  box(s, 7.95, 1.4, 4.9, 5.05);
  s.addText(rowsT.flatMap(([h, t], i) => [{ text: h + ". ", options: { bold: true, color: i === 4 ? K.steel : K.navy } }, { text: t, options: { color: K.ink, breakLine: i < rowsT.length - 1 } }]),
    { x: 8.17, y: 1.62, w: 4.46, h: 4.7, fontSize: 13, valign: "top", margin: 0, paraSpaceAfter: 12, isTextBox: true });
  source(s, "Adjustments are disclosed amounts (acquired revenue, land sales) or calculated from restated comparatives (Jarir net agent sales, Entaj reclassification). Alamar's adjusted figure still includes the Makkah and Taif branches it bought (not split). Source: SEVEN priority companies workbook, Adjustments sheet.");
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

// ================================================================== section 04
divider("04", "What it means for SEVEN", "Which companies turn growth into profit, our judgments for SEVEN, and what to watch through 2027.", "04 What it means for SEVEN");
{
  const s = content("Only 16 of 38 companies grew both revenue and profit in 9M 2026; 12 grew revenue but earned less", "04 What it means for SEVEN");
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
{
  const s = content("Our judgment: favour partners that convert growth into profit; test leveraged ones against stress", "04 What it means for SEVEN");
  s.addText("Strategic judgments for discussion. The data supports the facts on earlier slides, not these conclusions on its own.", { x: 0.45, y: 1.22, w: 12.4, h: 0.3, fontSize: 12, italic: true, color: K.muted, margin: 0, isTextBox: true });
  const J = [
    ["Partners and tenants", "Prefer operators with growing profit and modest debt (gyms such as Sport Clubs; scaled F&B such as Americana). Treat leveraged, acquisition-led or loss-making names (Jahez, MBC, Entaj, Cenomi Retail) as higher risk.",
     "9M 2026: Sport Clubs revenue +17.2%, profit +54%, net debt 3.1x EBITDA; Americana revenue +12.9%, profit +60%, 0.6x. Jahez and MBC turned to losses; Entaj 15.1x; Cenomi Retail has negative equity."],
    ["Competitors' capacity to expand", "Leejam is slowing and Baan is shrinking, while Sport Clubs and Armah grow. Mall developers at 8x to 10x net debt/EBITDA and REITs at 43% loan to value (both FY2025) may have less room to fund new space.",
     "9M revenue: Leejam +4.0%, Baan −9.9%, Sport Clubs +17.2%, Armah +10.6%. FY2025 net debt/EBITDA: Cenomi Centers 9.9x, Alandalus 8.0x; REIT loan to value 43%."],
    ["Landlord and retail exposure", "Mall revenue is flat (+0.9%) and retailers' profit fell 19.6% on 5.1% more revenue. Test tenant covenants and rents for margin pressure.",
     "9M 2026: malls' profit −18.5%; profit fell at 8 of 11 retailers; retailers' EBITDA margin 11.2% to 10.3%."],
  ];
  J.forEach(([h, t, e], i) => card(s, 0.45 + i * 4.2, 1.7, 4.0, 4.05, h, [
    { text: t, options: { breakLine: true } }, { text: " ", options: { fontSize: 8, breakLine: true } },
    { text: "Evidence  ", options: { bold: true, color: K.steel, fontSize: 11 } }, { text: e, options: { color: K.muted, fontSize: 11 } }], { num: i + 1, fs: 13 }));
  navyBar(s, 5.97, "Proposed next step: test the partner and tenant view against SEVEN's own pipeline.", 0.5);
  source(s, "Judgments are ours. Facts: 9M 2026 vs 9M 2025 and FY2025 balance sheets, SEVEN priority companies workbook.");
}
{
  const s = content("What to watch through 2027: whether growth turns into profit, and what debt costs", "04 What it means for SEVEN");
  const rows = [[TH("Indicator", "left"), TH("When", "left"), TH("Why it matters for SEVEN", "left")],
    [TD("FY2026 results of the 47 companies", { bold: true, color: K.navy }), TD("February to April 2027"), TD("First full-year test of 2026: did Q4 convert revenue into profit?")],
    [TD("Q4 profit conversion in retail and malls", { bold: true, color: K.navy }), TD("With FY2026 results"), TD("Retailers' 9M profit fell 19.6% on 5.1% more revenue; malls' profit fell 18.5%.")],
    [TD("REIT leverage and payouts", { bold: true, color: K.navy }), TD("FY2026 statements; fund fact sheets"), TD("Loan to value is 43%; four funds paid out more than their FFO in FY2025.")],
    [TD("Gyms and F&B: profit conversion", { bold: true, color: K.navy }), TD("Quarterly results"), TD("Sport Clubs and Americana converted in 9M; Leejam's and Armah's profit fell.")],
    [TD("Consumer card spending by category", { bold: true, color: K.navy }), TD("Weekly and monthly (SAMA)"), TD("Demand signal for dining, leisure and retail tenants; recreation spending fell 3% in September.")],
    [TD("Policy rates and borrowing costs", { bold: true, color: K.navy }), TD("SAMA decisions"), TD("Repo at 4.5%: matters most for malls (7.9x), Lazurde, Entaj, Cenomi Retail and Baan.")]];
  s.addTable(zebra(rows), { x: 0.45, y: 1.45, w: 12.4, colW: [3.6, 2.9, 5.9], rowH: [0.5].concat(Array(6).fill(0.74)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "watch list" });
  source(s, "Payout above FFO in FY2025: Alahli REIT 1, Mulkia, Musharaka and Derayah. Sources: SEVEN priority companies workbook; KSA Budget FY2027 Overview (Nov 2026), pp. 18, 22, 31 for SAMA rates and card spending.");
}

// ================================================================== appendix
divider("A", "Evidence: group tables and registers", "Every company and period behind the story, with key terms, one-offs and sources. Every figure and its filing page is in the workbook.", "Appendix");
{
  const s = content("Reading the analysis: key terms", "Appendix");
  const T = [["Matched sample", "Group growth uses only companies with figures in both periods; group totals are sums, not consolidated."],
             ["Adjusted growth", "The same comparison after removing what the basis names (acquisitions, land sales, a change of revenue basis); '= reported' where the filings show no such effect."],
             ["EBITDA excluding one-offs", "Operating income + depreciation, amortisation and impairments − investment-property fair-value gains, with identified one-off gains and losses taken out."],
             ["Net debt / EBITDA", "Borrowings + lease liabilities − cash − short-term bank deposits, over EBITDA. Negative = net cash."],
             ["FFO and payout (REITs)", "FFO = net income + depreciation and impairment of real estate − gains on property disposals. Payout = distributions declared / FFO."],
             ["Loan to value (REITs)", "Borrowings over total assets at book value; used for REITs instead of net debt / EBITDA."],
             ["n.m. and n.a.", "n.m.: not meaningful (short year, base under SAR 10m, or a loss). n.a.: the companies reporting cover under 75% of group revenue."],
             ["Short year", "A financial year under 12 months after a year-end change (SADAFCO, Cenomi Centers, Cenomi Retail, MBC), or SADAFCO's non-calendar FY2022; left out of group totals."]];
  T.forEach(([h, t], i) => {
    const x = 0.45 + (i % 2) * 6.28, y = 1.4 + Math.floor(i / 2) * 1.3, w = 6.12, h2 = 1.17;
    box(s, x, y, w, h2);
    s.addText([{ text: h, options: { bold: true, color: K.navy, breakLine: true } }, { text: t, options: { color: K.ink } }],
      { x: x + 0.22, y: y + 0.12, w: w - 0.44, h: h2 - 0.2, fontSize: 11.5, valign: "top", margin: 0, isTextBox: true });
  });
  source(s, "Full definitions: workbook How_to_read and Definitions sheets.");
}
{
  const s = content("Eight groups at a glance: retail and food carry the revenue; malls and leisure the margins", "Appendix");
  const rows = [[TH("Group", "left"), TH("Revenue FY2025 (SAR bn)"), TH("CAGR 2022–25"), TH("FY25 vs FY24"), TH("9M-26 vs 9M-25"), TH("Profit 9M y/y"), TH("Margin FY2025"), TH("Leverage FY2025"), TH("Largest (share)"), TH("What it means", "left")]];
  for (const o of D.overview) {
    rows.push([TD([{ text: o.label, options: { bold: true, color: K.navy, breakLine: true } }, { text: `${o.n} ${o.n > 1 ? "companies" : "company"}`, options: { fontSize: 8.5, color: K.muted } }]),
      TD((o.rev25 / 1000).toFixed(1), { align: "center", bold: true }), gCell(o.cagr), gCell(o.g25), gCell(o.g9), gCell(o.ni9),
      TD([{ text: pctP(o.margin25), options: { bold: true, breakLine: true } }, { text: o.margin_kind === "FFO" ? "FFO" : "EBITDA", options: { fontSize: 8, color: K.muted } }], { align: "center" }),
      TD([{ text: o.lev_kind === "LTV" ? pctP(o.lev25) : mult(o.lev25), options: { bold: true, breakLine: true } }, { text: o.lev_kind === "LTV" ? "LTV" : "ND / EBITDA", options: { fontSize: 8, color: K.muted } }], { align: "center" }),
      TD([{ text: o.largest, options: { bold: true, breakLine: true } }, { text: `${pctP(o.share, 0)} of revenue`, options: { fontSize: 8, color: K.muted } }], { align: "center", fontSize: 10 }),
      TD(o.line, { fontSize: 9.5 })]);
  }
  s.addTable(zebra(rows), { x: 0.45, y: 1.4, w: 12.4, colW: [1.85, 0.9, 0.85, 0.85, 0.9, 0.85, 1.05, 1.0, 1.25, 2.9], rowH: [0.55].concat(Array(8).fill(0.54)), border: { type: "solid", pt: 0.5, color: K.line }, fontFace: "Calibri", objectName: "group overview" });
  legend(s, 6.4, false);
  source(s, "n.a.: Malls FY2022 and REIT 9M cover less than 75% of group revenue. n.m.: profit turned to a loss (Media, Delivery). Margin: EBITDA excluding identified one-offs (REITs: FFO margin). Source: SEVEN priority companies workbook.");
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
    if (withTotal && g.total) list.push(g.total);
    for (const r of g.rows) if (!only || only.includes(r.ticker)) list.push(r);
  }
  const nameCell = (r) => ({ text: [{ text: r.name.replace(": group total", " total"), options: { bold: true, fontSize: 10, color: r.total ? K.white : K.navy, breakLine: true } },
                                    { text: r.total ? r.sub.replace(" · FY2025 revenue ", " · ") : r.sub, options: { fontSize: 7.5, color: r.total ? K.goldL : K.muted } }],
                             options: { fill: { color: r.total ? K.navy : K.zebra }, valign: "middle", margin: CM } });
  const mCell = (r) => { const m = r.margin || {}; return TD([{ text: pctP(m.FY2025), options: { bold: true, breakLine: true } }, { text: typeof m["9M2026"] === "number" ? `9M ${pctP(m["9M2026"])} vs ${pctP(m["9M2025"])}` : " ", options: { fontSize: 7.5, color: K.muted } }], { align: "center" }); };
  const means = (r) => TD(r.line, { fontSize: 8.5, bold: !!r.total, fill: { color: r.total ? K.total : K.white } });
  let rows, colW;
  if (!G.reit) {
    rows = [[TH("Company", "left"), TH("FY23 vs FY22"), TH("FY24 vs FY23"), TH("FY25 vs FY24"), TH("9M-26 vs 9M-25"), TH("Adjusted growth"), TH("Adjusted basis", "left"), TH("EBITDA margin FY25"), TH("Net debt / EBITDA FY25"), TH("What it means", "left")]];
    for (const r of list) {
      const a = r.adj || {};
      let adj, basis;
      if (r.total) { adj = TD("", { fill: { color: K.adjF } }); basis = TD(""); }
      else {
        adj = typeof a.v === "number" ? TD([{ text: pct(a.v), options: { bold: true, color: TONE[tone(a.v)][0], breakLine: true } }, { text: `${a.label}; reported ${pct(a.rep)}`, options: { fontSize: 7.5, color: K.muted } }], { align: "center", fill: { color: K.adjF } })
            : a.v === "= reported" ? TD([{ text: "= reported", options: { bold: true, color: K.navy, breakLine: true } }, { text: "9M 2026", options: { fontSize: 7.5, color: K.muted } }], { align: "center", fontSize: 9.5, fill: { color: K.adjF } })
            : TD("–", { align: "center", color: K.muted, fill: { color: K.adjF } });
        basis = TD(shortBasis(a.basis), { fontSize: 8 });
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
               ["KSA Budget FY2027 Overview (Nov 2026)", "Macro and consumer backdrop, citing the MoF Budget Statement FY2027 (24 Nov 2026), SAMA, GASTAT and Jadwa Investment."],
               ["BinDawood results announcement (via Mubasher)", "9M 2026 attributable profit down 3.4% (SAR 155.5m vs 161.0m); confirms five of six retailers on the Retailers (1 of 2) slide lost profit."]];
  s.addText(SRC.flatMap(([h, t], i) => [{ text: h, options: { bold: true, color: K.navy, breakLine: true } }, { text: t, options: { color: K.muted, fontSize: 10.5, breakLine: i < SRC.length - 1 } }]),
    { x: 0.45, y: 1.4, w: 6.0, h: 5.1, fontSize: 12, valign: "top", margin: 0, paraSpaceAfter: 10, isTextBox: true });
  card(s, 6.75, 1.4, 2.95, 5.05, "Checks", ["Analyst's own checks: 5,791 core figures compared with the PDFs; a 94-figure sample (93 confirmed). We did not re-perform these.",
       "Our review of 27 Nov 2026: 17,798 formulas recalculated without error; 65 of 65 FY2025 inputs found in the PDFs for five companies, plus targeted checks.", "Not a full audit of all 47 companies."], { fs: 10.5 });
  card(s, 9.9, 1.4, 2.95, 5.05, "Limits", ["9M 2026 is a partial year, compared only with 9M 2025.", "REIT 9M figures are n.a. (fact sheets cover too few funds).",
       "No same-store sales or currency effects disclosed.", "Deposit restrictions and pledges not checked.", "Links between groups and SEVEN's results are our judgment."], { fs: 10.5 });
  source(s, "Figures in SAR unless stated; Americana converted from USD at 3.75.");
}

await pres.writeFile({ fileName: OUT });
await applyTheme(OUT, THEME);
console.log("deck ->", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
