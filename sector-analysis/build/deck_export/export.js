// Export the Slides deck (project/deck.json + slides) to an editable PPTX and a faithful PDF.
// Usage: node export.js <deck root> <fonts dir> <out dir>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const [root, fontsDir, outDir] = process.argv.slice(2);
const deck = JSON.parse(fs.readFileSync(path.join(root, 'project/deck.json'), 'utf8'));
const css = fs.readFileSync(path.join(root, 'project/deck.css'), 'utf8');
const DECK_URL = 'https://claude.ai/artifact/UBQR6WJDgHtK2MRQ9xFPky';
const slidesHtml = deck.order.map(id => fs.readFileSync(path.join(root, 'project/slides', id + '.html'), 'utf8'));

const fontFiles = {
  'Archivo': [['500', 'fontsource-archivo-5.3.0/files/archivo-latin-500-normal.woff2'], ['700', 'fontsource-archivo-5.3.0/files/archivo-latin-700-normal.woff2'], ['800', 'fontsource-archivo-5.3.0/files/archivo-latin-800-normal.woff2']],
  'Public Sans': [['400', 'fontsource-public-sans-5.3.0/files/public-sans-latin-400-normal.woff2'], ['600', 'fontsource-public-sans-5.3.0/files/public-sans-latin-600-normal.woff2'], ['700', 'fontsource-public-sans-5.3.0/files/public-sans-latin-700-normal.woff2']],
};
const faceCss = Object.entries(fontFiles).flatMap(([fam, list]) => list.map(([w, f]) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(/fonts/${encodeURIComponent(f)}) format('woff2')}`)).join('\n');

const baseCss = `
@page { size: 1920px 1080px; margin: 0 }
* { margin: 0 } html, body { background: #10262E }
body { font: 32px/1.2 sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact }
body > section { width: 1920px !important; height: 1080px !important; overflow: hidden !important; box-sizing: border-box !important; position: relative; isolation: isolate; page-break-after: always; break-after: page }
aside { display: none !important }
h1 { font-size: 96px; font-weight: 600 } h2 { font-size: 64px; font-weight: 600 } h3 { font-size: 44px; font-weight: 600 }
table { width: 100%; border-collapse: collapse }
th, td { padding: .35em .6em; text-align: left; border-bottom: 1px solid #CBD5D2 }
th { font-weight: 700; border-bottom: 2px solid #4B5D63 }
`;
const armOverride = `* { font-family: 'Liberation Sans', Arial, sans-serif !important; }`;

function pageHtml(forPptx) {
  // in the PDF, links between slides become links inside the document
  let body = slidesHtml.join('\n');
  if (!forPptx) body = body.replace(new RegExp(DECK_URL.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '#slide-(\\d+)', 'g'), (m, n) => '#' + deck.order[Number(n) - 1]);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${faceCss}\n${baseCss}</style><style>${css}</style>${forPptx ? `<style>${armOverride}</style>` : ''}</head><body>${body}</body></html>`;
}

async function openPage(browser, html) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const pg = await ctx.newPage();
  let first = true;
  await pg.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/' && first) { first = false; return r.fulfill({ contentType: 'text/html', body: html }); }
    if (u.pathname.startsWith('/fonts/')) {
      const rel = decodeURIComponent(u.pathname.slice(7));
      const p = path.resolve(fontsDir, rel);
      if (p.startsWith(path.resolve(fontsDir)) && fs.existsSync(p)) return r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(p) });
    }
    return r.abort('aborted');
  });
  await pg.goto('http://deck.invalid/');
  await pg.evaluate(() => document.fonts.ready);
  // align table columns as Slides does: a header cell's text-align applies to its column
  await pg.evaluate(() => {
    document.querySelectorAll('table').forEach(t => {
      const head = t.rows[0]; if (!head) return;
      [...head.cells].forEach((th, i) => { const a = th.style.textAlign; if (!a) return; [...t.rows].forEach(r => { if (r.cells[i]) r.cells[i].style.textAlign = a; }); });
    });
  });
  return pg;
}

// ------------------------------------------------------------ extraction (runs in the page)
function extract() {
  const out = [];
  const hex = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(s => parseFloat(s)); if (p.length === 4 && p[3] === 0) return null; return p.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const isHead = ff => /Archivo/i.test(ff);
  [...document.querySelectorAll('body > section')].forEach((sec, si) => {
    const o = sec.getBoundingClientRect();
    const R = el => { const r = el.getBoundingClientRect(); return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }; };
    const items = [];
    const runsOf = (el) => {
      const runs = [];
      const walk = (n) => {
        if (n.nodeType === 3) {
          let t = n.nodeValue.replace(/\s+/g, ' ');
          if (!t) return;
          const p = n.parentElement, cs = getComputedStyle(p);
          if (cs.textTransform === 'uppercase') t = t.toUpperCase();
          const a = p.closest('a');
          runs.push({ text: t, bold: parseInt(cs.fontWeight) >= 600, color: hex(cs.color), size: parseFloat(cs.fontSize), head: isHead(cs.fontFamily), href: a ? a.getAttribute('href') : null, underline: !!a, spacing: parseFloat(cs.letterSpacing) || 0 });
        } else if (n.nodeName === 'BR') runs.push({ br: true });
        else if (n.nodeType === 1 && n.nodeName !== 'ASIDE') [...n.childNodes].forEach(walk);
      };
      [...el.childNodes].forEach(walk);
      // trim leading/trailing spaces
      if (runs.length && runs[0].text) runs[0].text = runs[0].text.replace(/^ /, '');
      const last = [...runs].reverse().find(r => r.text !== undefined); if (last) last.text = last.text.replace(/ $/, '');
      return runs.filter(r => r.br || r.text);
    };
    const textItem = (el, extra) => {
      const cs = getComputedStyle(el);
      const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
      const pad = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs['padding' + s]) || 0);
      let runs = runsOf(el);
      if (el.classList.contains('pn')) runs = [{ text: String(si + 1), color: hex(cs.color), size: parseFloat(cs.fontSize), bold: false }];
      if (!runs.length) return;
      // the text box may grow a little for safety, but never past the box it sits in
      let box = el, maxRight = 1792;
      while (box && box !== sec) { const bs = getComputedStyle(box); if (hex(bs.backgroundColor) || (parseFloat(bs.borderLeftWidth) > 0 && parseFloat(bs.borderRightWidth) > 0)) { maxRight = box.getBoundingClientRect().right - o.left - (box === el ? 0 : parseFloat(bs.paddingRight) || 0); break; } box = box.parentElement; }
      const own = !!hex(cs.backgroundColor);
      items.push(Object.assign({ type: 'text', ...R(el), pad, maxRight, valign: own ? 'middle' : 'top', align: cs.textAlign === 'right' ? 'right' : cs.textAlign === 'center' ? 'center' : 'left', lh, paras: [runs] }, extra || {}));
    };
    const painted = (el, cs) => {
      const bg = hex(cs.backgroundColor);
      const bw = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs['border' + s + 'Width']) || 0);
      const bc = hex(cs.borderTopColor) || hex(cs.borderBottomColor) || hex(cs.borderLeftColor);
      return { bg, bw, bc, radius: parseFloat(cs.borderTopLeftRadius) || 0 };
    };
    const visit = (el) => {
      if (el.nodeName === 'ASIDE') return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      if (el.classList.contains('chart')) {
        const ttl = el.querySelector('.ttl'); if (ttl) textItem(ttl);
        const track = el.querySelector('.track'), labs = el.querySelector('.labs');
        const a = R(track), b = R(labs);
        const vals = [...el.querySelectorAll('.val')].map(p => parseFloat(p.textContent.replace(/,/g, '')));
        const labels = [...labs.querySelectorAll('p')].map(p => p.textContent.trim());
        const colors = [...el.querySelectorAll('.bar')].map(b => hex(getComputedStyle(b).backgroundColor));
        items.push({ type: 'chart', kind: 'col', x: a.x, y: a.y, w: a.w, h: b.y + b.h - a.y, labels, values: vals, colors });
        return;
      }
      if (el.classList.contains('cbars')) {
        const rows = [...el.querySelectorAll('.cb')];
        const labels = rows.map(r => r.querySelector('.n').textContent.trim());
        const values = rows.map(r => parseFloat(r.querySelector('.x').textContent.replace('+', '')));
        const color = hex(getComputedStyle(el.querySelector('.b')).backgroundColor);
        items.push({ type: 'chart', kind: 'bar', ...R(el), labels, values, colors: [color] });
        return;
      }
      if (el.nodeName === 'TABLE') {
        const t = R(el);
        const rows = [...el.rows].map(tr => ({ fill: hex(getComputedStyle(tr).backgroundColor), h: tr.getBoundingClientRect().height, cells: [...tr.cells].map(c => { const s = getComputedStyle(c); return { text: c.textContent.replace(/\s+/g, ' ').trim(), bold: parseInt(s.fontWeight) >= 600, color: hex(s.color), align: s.textAlign === 'right' ? 'right' : 'left', size: parseFloat(s.fontSize) }; }) }));
        const colW = [...el.rows[0].cells].map(c => c.getBoundingClientRect().width);
        items.push({ type: 'table', ...t, rows, colW });
        return;
      }
      if (el !== sec && (el.nodeName === 'DIV' || el.nodeName === 'P')) {
        const p = painted(el, cs);
        const uniform = p.bw.every(v => v === p.bw[0]);
        if (p.bg || (p.bc && uniform && p.bw[0] > 0)) items.push({ type: 'rect', ...R(el), fill: p.bg, line: uniform && p.bw[0] > 0 ? p.bc : null, lineW: p.bw[0], radius: p.radius });
        else if (p.bc && p.bw[0] > 0 && !p.bw[2]) { const r = R(el); items.push({ type: 'line', x: r.x, y: r.y, w: r.w, color: p.bc, width: p.bw[0] }); }
      }
      if (['P', 'H1', 'H2', 'H3'].includes(el.nodeName)) {
        textItem(el);
        if (el.nodeName === 'H3') { const p = painted(el, cs); if (p.bw[2] > 0) { const r = R(el); items.push({ type: 'line', x: r.x, y: r.y + r.h - p.bw[2] / 2, w: r.w, color: hex(cs.borderBottomColor), width: p.bw[2] }); } }
        return;
      }
      if (el.nodeName === 'UL') {
        const lis = [...el.children].filter(c => c.nodeName === 'LI');
        const lcs = getComputedStyle(lis[0] || el);
        const lh = lcs.lineHeight === 'normal' ? parseFloat(lcs.fontSize) * 1.2 : parseFloat(lcs.lineHeight);
        let box = el.parentElement, maxRight = 1792;
        while (box && box !== sec) { const bs = getComputedStyle(box); if (hex(bs.backgroundColor)) { maxRight = box.getBoundingClientRect().right - o.left - (parseFloat(bs.paddingRight) || 0); break; } box = box.parentElement; }
        items.push({ type: 'text', ...R(el), pad: [0, 0, 0, 0], maxRight, valign: 'top', align: 'left', lh, bullet: { indent: parseFloat(cs.paddingLeft) || 32 }, gap: parseFloat(cs.rowGap) || 0, paras: lis.map(li => runsOf(li)) });
        return;
      }
      [...el.children].forEach(visit);
    };
    visit(sec);
    const notes = sec.querySelector(':scope > aside');
    out.push({ id: sec.id, bg: hex(getComputedStyle(sec).backgroundColor), items, notes: notes ? notes.textContent.trim() : '' });
  });
  return out;
}

// ------------------------------------------------------------ PPTX build
const K = 13.3333 / 1920; // inches per px
const PT = 0.5;           // points per px (1920 px = 960 pt)
function buildPptx(slides, file) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = deck.title;
  pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
  const slideNoFor = href => { const m = href && href.match(/#slide-(\d+)$/); return m && href.startsWith(DECK_URL) ? Number(m[1]) : null; };
  slides.forEach((s, i) => {
    if (i === 0) pres.addSection({ title: 'Executive summary' });
    if (s.id === 'appendix') pres.addSection({ title: 'Analyst appendix' });
    const sectionTitle = i < deck.order.indexOf('appendix') ? 'Executive summary' : 'Analyst appendix';
    const slide = pres.addSlide({ sectionTitle });
    slide.background = { color: s.bg || 'F5F6F3' };
    for (const it of s.items) {
      if (it.type === 'rect') {
        const opt = { x: it.x * K, y: it.y * K, w: it.w * K, h: it.h * K, objectName: 'box' };
        if (it.fill) opt.fill = { color: it.fill }; else opt.fill = { type: 'none' };
        opt.line = it.line ? { color: it.line, width: Math.max(0.5, it.lineW * PT) } : { type: 'none' };
        if (it.radius > 0) { opt.rectRadius = Math.min(it.radius, it.h / 2) * K; slide.addShape(pres.shapes.ROUNDED_RECTANGLE, opt); }
        else slide.addShape(pres.shapes.RECTANGLE, opt);
      } else if (it.type === 'line') {
        slide.addShape(pres.shapes.LINE, { x: it.x * K, y: it.y * K, w: it.w * K, h: 0, line: { color: it.color, width: Math.max(0.75, it.width * PT) } });
      } else if (it.type === 'text') {
        const paras = [];
        it.paras.forEach((runs, pi) => {
          runs.forEach((r, ri) => {
            if (r.br) { if (paras.length) paras[paras.length - 1].options.breakLine = true; return; }
            const o = { fontSize: r.size * PT, bold: r.bold, color: r.color || '10262E', fontFace: 'Arial' };
            if (r.spacing) o.charSpacing = r.spacing * PT;
            if (r.href) { const n = slideNoFor(r.href); o.hyperlink = n ? { slide: n, tooltip: 'Go to slide ' + n } : { url: r.href }; o.underline = { style: 'sng' }; }
            if (it.bullet && ri === 0) { o.bullet = { indent: it.bullet.indent * PT }; if (it.gap) o.paraSpaceAfter = it.gap * PT; }
            if (ri === runs.length - 1 && pi < it.paras.length - 1) o.breakLine = true;
            paras.push({ text: r.text, options: o });
          });
        });
        if (!paras.length) continue;
        const wpx = Math.max(it.w, Math.min(it.w * 1.03, (it.maxRight || 1792) - it.x));
        slide.addText(paras, {
          x: it.x * K, y: it.y * K, w: wpx * K, h: it.h * K + 0.02,
          margin: it.pad.map(p => p * PT), align: it.align, valign: it.valign || 'top', lineSpacing: it.lh * PT,
          isTextBox: true, fit: 'none', wrap: true, objectName: 'text',
        });
      } else if (it.type === 'table') {
        const rows = it.rows.map(row => row.cells.map(c => ({ text: c.text, options: { bold: c.bold, color: c.color || '10262E', align: c.align, fill: row.fill ? { color: row.fill } : undefined, fontSize: c.size * PT, fontFace: 'Arial' } })));
        slide.addTable(rows, {
          x: it.x * K, y: it.y * K, w: it.w * K, colW: it.colW.map(w => w * K), rowH: it.rows.map(r => r.h * K),
          border: { type: 'solid', pt: 0.5, color: 'CBD5D2' }, margin: [4.2, 7.2, 4.2, 7.2], valign: 'middle', autoPage: false,
        });
      } else if (it.type === 'chart') {
        const data = [{ name: 'Value', labels: it.labels, values: it.values }];
        const common = { x: it.x * K, y: it.y * K, w: it.w * K, h: it.h * K, showLegend: false, showValue: true, dataLabelFontSize: 12, dataLabelColor: '10262E', dataLabelFontFace: 'Arial', catAxisLabelFontSize: 12, catAxisLabelColor: '4B5D63', catAxisLabelFontFace: 'Arial', valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, catAxisLineShow: true, objectName: 'chart' };
        if (it.kind === 'col') {
          slide.addChart(pres.charts.BAR, data, Object.assign(common, { barDir: 'col', chartColors: it.colors, barGapWidthPct: 70, dataLabelPosition: 'outEnd', dataLabelFormatCode: it.values.every(v => Number.isInteger(v)) ? '0' : '0.0', valAxisMinVal: 0 }));
        } else {
          slide.addChart(pres.charts.BAR, data, Object.assign(common, { barDir: 'bar', chartColors: it.colors, barGapWidthPct: 45, dataLabelPosition: 'outEnd', dataLabelFormatCode: '+0.00;-0.00', catAxisOrientation: 'maxMin', valAxisMinVal: 0, catAxisLabelColor: '10262E' }));
        }
      }
    }
    if (s.notes) slide.addNotes(s.notes);
  });
  return pres.writeFile({ fileName: file });
}

(async () => {
  const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ^NOTFOUND'] });
  // PDF with the deck's own typefaces
  const pdfPage = await openPage(browser, pageHtml(false));
  await pdfPage.pdf({ path: path.join(outDir, 'Energy_Banks_Pilot_Review.pdf'), width: '1920px', height: '1080px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  // PPTX laid out with Arial metrics (the face written into the file)
  const pp = await openPage(browser, pageHtml(true));
  const slides = await pp.evaluate(extract);
  fs.writeFileSync(path.join(outDir, 'extract.json'), JSON.stringify(slides));
  await buildPptx(slides, path.join(outDir, 'Energy_Banks_Pilot_Review.pptx'));
  await browser.close();
  console.log('slides', slides.length, 'items', slides.map(s => s.items.length).join(','));
})();
