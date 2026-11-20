const pptxgen = require('pptxgenjs');
const fs = require('fs');
const { applyTheme } = require('/root/.claude/skills/synced/d460f705-4699-4d5b-b495-db252a0657e2_c6ac2004-2be6-4e40-9791-76746721773d/pptx/scripts/apply_theme.js');

const NOTES = JSON.parse(fs.readFileSync(__dirname + '/notes.json', 'utf8'));
const IMG = '/tmp/claude-0/-home-user-Test/30a14f55-3e36-5852-b19a-c2e736989f76/scratchpad/deckimg/';
const OUT = process.argv[2] || 'SEVEN_Social_Media_Assessment_Nov2026.pptx';

const K = { ink: '1B1640', paper: 'F6F4FA', paper2: 'ECE8F5', body: '4A4668', soft: 'C9C3E6', pink: 'C42D68', gold: 'F2B33D',
  line: 'D6D1E8', white: 'FFFFFF', good: '1E7F55', bad: 'B23A3A', amber: '7A4E00', card2: '28214F', rose: 'FBE3EC', blush: 'FFE3EE' };
const THEME = { name: 'SEVEN Joy', headFontFace: 'Arial', bodyFontFace: 'Arial',
  colors: { dk1: K.ink, lt1: K.white, dk2: K.body, lt2: K.paper, accent1: K.pink, accent2: K.gold, accent3: K.good,
    accent4: K.bad, accent5: K.amber, accent6: K.soft, hlink: K.pink, folHlink: K.body } };

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
pres.title = 'SEVEN Social Media Assessment';
pres.subject = 'Social media assessment, 20 November 2026';
const C = pres.SchemeColor;

const X0 = 0.6, CW = 12.13;

function layout(name, bg, eyebrowColor, titleColor, sourceColor) {
  pres.defineSlideMaster({
    title: name, background: { color: bg },
    objects: [
      { placeholder: { options: { name: 'eyebrow', type: 'body', x: X0, y: 0.42, w: CW, h: 0.32, fontSize: 11, bold: true, color: eyebrowColor, charSpacing: 2, margin: 0, valign: 'top' }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', x: X0, y: 0.78, w: CW, h: 1.05, fontSize: 30, bold: true, color: titleColor, margin: 0, valign: 'top', align: 'left' }, text: '' } },
      { placeholder: { options: { name: 'source', type: 'body', x: X0, y: 6.82, w: 11.2, h: 0.42, fontSize: 10, color: sourceColor, margin: 0, valign: 'top' }, text: '' } },
    ],
    slideNumber: { x: 12.2, y: 6.86, w: 0.55, h: 0.3, fontSize: 9, color: sourceColor, align: 'right' },
  });
}
layout('LIGHT', K.paper, K.pink, K.ink, K.body);
layout('ALT', K.paper2, K.pink, K.ink, K.body);
layout('DARK', K.ink, K.gold, K.paper, K.soft);
layout('STATEMENT', K.pink, K.ink, 'FFF7FA', K.blush);
pres.defineSlideMaster({ title: 'COVER', background: { color: K.ink }, objects: [] });

let section = null;
function slide(id, master, sec, eyebrow, title, source) {
  if (sec && sec !== section) { pres.addSection({ title: sec }); section = sec; }
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  if (eyebrow) s.addText(eyebrow.toUpperCase(), { placeholder: 'eyebrow' });
  if (title) s.addText(title, { placeholder: 'title' });
  if (source) s.addText(source, { placeholder: 'source' });
  if (NOTES[id]) s.addNotes(NOTES[id]);
  return s;
}
const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, valign: 'top', fontSize: 14, color: K.ink }, o));
function box(s, x, y, w, h, fill, name) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0.5 }, rectRadius: 0.1, objectName: name || 'card' });
}
function kpi(s, x, y, w, h, num, label, o = {}) {
  box(s, x, y, w, h, o.fill || K.white, 'stat card');
  let yy = y + 0.2;
  if (o.top) { T(s, o.top, { x: x + 0.22, y: yy, w: w - 0.44, h: 0.45, fontSize: 12, color: o.labColor || K.body }); yy += 0.45; }
  T(s, num, { x: x + 0.22, y: yy, w: w - 0.44, h: 0.7, fontSize: o.numSize || 34, bold: true, color: o.numColor || K.ink });
  T(s, label, { x: x + 0.22, y: yy + (o.numSize ? o.numSize / 50 : 0.72), w: w - 0.44, h: h - (yy - y) - 0.85, fontSize: o.labSize || 12, color: o.labColor || K.body });
}
function card(s, x, y, w, h, head, body, o = {}) {
  box(s, x, y, w, h, o.fill || K.white);
  let yy = y + 0.2;
  if (o.pill) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.22, y: yy, w: o.pillW || 1.1, h: 0.32, fill: { color: o.pillFill }, line: { color: o.pillFill }, rectRadius: 0.16, objectName: 'status pill' });
    T(s, o.pill, { x: x + 0.22, y: yy, w: o.pillW || 1.1, h: 0.32, fontSize: 11, bold: true, color: o.pillColor, align: 'center', valign: 'middle' });
    yy += 0.45;
  }
  const H = () => { if (head) { T(s, head, { x: x + 0.22, y: yy, w: w - 0.44, h: 0.4, fontSize: 16, bold: true, color: o.headColor || K.ink }); yy += 0.45; } };
  const B = () => { if (o.big) { T(s, o.big, { x: x + 0.22, y: yy, w: w - 0.44, h: 0.8, fontSize: 40, bold: true, color: o.bigColor || K.ink }); yy += 0.85; } };
  if (o.bigFirst) { B(); H(); } else { H(); B(); }
  const paras = Array.isArray(body) ? body : [body];
  T(s, paras.map((p, i) => ({ text: p, options: { breakLine: i < paras.length - 1, paraSpaceAfter: 6 } })),
    { x: x + 0.22, y: yy, w: w - 0.44, h: y + h - yy - 0.15, fontSize: o.bodySize || 12.5, color: o.bodyColor || K.body });
}
function table(s, rows, o) {
  const hl = o.hl || [];
  const data = rows.map((r, i) => r.map((c, j) => {
    const cell = typeof c === 'object' ? c : { text: String(c) };
    const opt = Object.assign({ fontSize: o.fontSize || 12, color: K.ink, valign: 'middle',
      margin: [3, 6, 3, 6], border: [{ type: 'none' }, { type: 'none' }, { pt: 0.75, color: K.line }, { type: 'none' }] }, cell.options || {});
    if (i === 0) Object.assign(opt, { bold: true, color: K.body, fontSize: (o.fontSize || 12) - 1, border: [{ type: 'none' }, { type: 'none' }, { pt: 1.25, color: K.ink }, { type: 'none' }] });
    if (hl.includes(i)) opt.fill = { color: K.rose };
    return { text: cell.text, options: opt };
  }));
  s.addTable(data, { x: o.x, y: o.y, w: o.w, colW: o.colW, rowH: o.rowH || 0.36, autoPage: false });
}
function bar(s, labels, values, colors, o) {
  s.addChart(pres.charts.BAR, [{ name: o.name, labels, values }], Object.assign({
    x: o.x, y: o.y, w: o.w, h: o.h, barDir: o.dir || 'col', chartColors: colors,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelColor: K.ink, dataLabelFontFace: '+mn-lt',
    dataLabelFormatCode: o.fmt || '#,##0', catAxisLabelFontSize: 11, catAxisLabelColor: K.body, catAxisLabelFontFace: '+mn-lt',
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, valAxisMinVal: 0, valAxisMaxVal: o.max,
    showLegend: false, barGapWidthPct: o.gap || 45, catAxisLineShow: true, catAxisLineColor: K.ink,
    showTitle: false, altText: o.alt,
  }, o.extra || {}));
}

// 1 Cover
{
  const s = slide('cover', 'COVER', 'Introduction');
  T(s, 'SEVEN · SOCIAL MEDIA ASSESSMENT · 20 NOVEMBER 2026', { x: X0, y: 0.6, w: CW, h: 0.35, fontSize: 12, bold: true, color: K.gold, charSpacing: 2 });
  T(s, 'Joy is getting noticed.\nNow make it bookable.', { x: X0, y: 2.0, w: 10, h: 2.1, fontSize: 54, bold: true, color: K.paper });
  T(s, 'Nine weeks of public tracking, a fresh capture of 71 posts, and SEVEN against 11 peers and Qiddiya: audience, content, engagement, paid reach and the path to a booking.',
    { x: X0, y: 4.25, w: 9.2, h: 1.0, fontSize: 16, color: K.soft });
  T(s, 'Prepared for SEVEN management · Public, logged-out data only · Sources on every slide', { x: X0, y: 6.7, w: CW, h: 0.35, fontSize: 11, color: K.soft });
}
// 2 Summary
{
  const s = slide('summary', 'LIGHT', null, 'Executive summary', 'The audience is growing fast; the gap is turning attention into bookings',
    'Sources: SEVEN / Scene weekly social tracker (verified 20 Nov 2026); 6 Nov social media analysis; 20 Nov evidence archive; public capture of 71 SEVEN posts, 19–20 Nov 2026.');
  const k = [['+113%', 'TikTok followers since 24 Sep: 4,197 → 8,937. Video posting is now visible (10 videos, 7–19 Nov).'],
    ['+4.5K', 'Instagram followers since 1 Oct (79.8K → 84.3K), the largest absolute gain of all 27 tracked accounts.'],
    ['3 of 5', 'Newest X posts (12–19 Nov) link to seven.sa, up from 0 of 24 posts between 13 Oct and 5 Nov.'],
    ['41', 'Interactions on the 4 Oct X post’s 735.3K views. Big view counts here and on YouTube don’t produce engagement.']];
  const w = (CW - 0.6) / 4;
  k.forEach((v, i) => kpi(s, X0 + i * (w + 0.2), 2.05, w, 2.45, v[0], v[1], { labSize: 13 }));
  box(s, X0, 4.8, CW, 1.45, K.ink, 'verdict');
  T(s, [{ text: 'Verdict: ', options: { bold: true, color: K.gold } },
    { text: 'keep the cadence and the TikTok formula, put a tracked booking link on every post that asks guests to book, settle what paid spend buys, and fix identity and hashtag hygiene.', options: { color: K.paper } }],
    { x: X0 + 0.3, y: 5.0, w: CW - 0.6, h: 1.1, fontSize: 17, valign: 'middle' });
}
// 3 Basis
{
  const s = slide('basis', 'ALT', null, 'What this rests on', 'Four public sources, read together; no data from the accounts’ own analytics',
    'Sources: SEVEN / Scene weekly social tracker; 6 Nov analysis; 20 Nov evidence archive; seven-social-audit post register.');
  const c = [['Weekly tracker', '27 account-platform rows: SEVEN, Scene, 3 cinemas, 2 malls, 6 attractions and Qiddiya. Friday captures from 25 Sep to 20 Nov. Follower counts re-verified on native profiles on 20 Nov.'],
    ['6 Nov analysis', 'Seven weeks to 5 Nov: reach, engagement, content and booking path. It covers 436 logged posts, with screenshot evidence for the key numbers.'],
    ['20 Nov evidence', '27 native profile screenshots and the X feeds for the week to 19 Nov, with SEVEN’s newest posts and their links.'],
    ['Post register', '71 SEVEN posts with screenshots, captured 19–20 Nov: YouTube (45), Snapchat (16) and TikTok (10), including views, likes, comments and shares where shown.']];
  const w = (CW - 0.6) / 4;
  c.forEach((v, i) => card(s, X0 + i * (w + 0.2), 2.05, w, 3.0, v[0], v[1]));
  T(s, [{ text: 'Limits: ', options: { bold: true } }, { text: 'public views include paid and repeat views, so they aren’t reach. Follower counts round to the nearest 100. Logged-out X shows only about the 5 newest posts. Instagram and Facebook posts sit behind a login. Patterns here are associations in time, not cause.' }],
    { x: X0, y: 5.35, w: CW, h: 0.9, fontSize: 13, color: K.body });
}
// 4 Footprint
{
  const s = slide('footprint', 'LIGHT', 'Audience', 'Audience · footprint on 20 November', 'Instagram holds most of SEVEN’s audience; TikTok is small but the fastest growing',
    'Sources: tracker Followers sheet and 20 Nov verification (native profiles); YouTube and Snapchat public profiles, 19–20 Nov. Followers are never summed across platforms.');
  table(s, [['Platform', 'Handle', 'Followers', 'Change', 'Read'],
    ['Instagram', '@saudi_seven', '84.3K', '+4.5K since 1 Oct', 'Steady climb, about 800 a week lately'],
    ['X', '@saudi_SEVEN', '46.7K', '+200 since 24 Sep', 'Flat, within rounding'],
    ['TikTok', '@saudi_seven', '8,937', '+4,740 since 24 Sep', 'More than doubled; +1,096 last week'],
    ['YouTube', '@Saudi_SEVEN', '1.62K', 'not tracked', '45 videos; dormant 2024–25'],
    ['Snapchat', '@saudi_seven', 'not public', '—', '16 Spotlights, 8 Oct – 19 Nov'],
    ['Facebook, LinkedIn', 'EntertainKSA', 'not public', '—', 'Login wall or blocked']],
    { x: X0, y: 2.1, w: CW, colW: [2.0, 2.0, 1.6, 2.4, 4.13], fontSize: 14, rowH: 0.52, hl: [1, 3] });
}
// 5 TikTok growth
{
  const s = slide('tiktok-growth', 'LIGHT', null, 'Audience · TikTok followers, Friday capture', 'TikTok doubled in eight weeks and is on course for 10K in early December',
    'Sources: tracker Followers sheet (exact counts); 20 Nov verification; TikTok creator embed, 19 Nov. The 5 Nov profile didn’t load, so that week is left out.');
  bar(s, ['24 Sep', '1 Oct', '8 Oct', '15 Oct', '22 Oct', '29 Oct', '12 Nov', '19 Nov'], [4197, 4410, 4589, 4834, 5029, 5464, 7841, 8937],
    [K.ink, K.ink, K.ink, K.ink, K.ink, K.ink, K.pink, K.pink], { name: 'TikTok followers', x: X0, y: 1.95, w: CW, h: 3.6, max: 10000,
      alt: 'Column chart of SEVEN TikTok followers from 4,197 on 24 Sep to 8,937 on 19 Nov; the last two weeks, with visible video posting, are highlighted.' });
  T(s, [{ text: 'Pink bars: ', options: { bold: true, color: K.pink } }, { text: 'weeks with visible video posting. Weekly gain went from about +200 to +1,100. The 10K target for 31 Dec now needs about 180 a week, against roughly 1,100 last week. The jump coincides with 10 visible videos and a 25.1K-view breakout; the data doesn’t show which of them caused it.' }],
    { x: X0, y: 5.75, w: CW, h: 0.9, fontSize: 13, color: K.body });
}
// 6 IG and X
{
  const s = slide('ig-x', 'ALT', null, 'Audience · Instagram and X', 'Instagram gains have tripled since early October; X is flat but each post reaches more',
    'Sources: tracker Followers and Weekly Summary sheets; 6 Nov analysis; 20 Nov verification. ≥ = lower bound, because the logged-out feed shows only the newest posts.');
  T(s, 'Instagram: weekly follower gain', { x: X0, y: 2.0, w: 6.2, h: 0.35, fontSize: 15, bold: true });
  bar(s, ['8 Oct', '15 Oct', '22 Oct', '29 Oct', '5 Nov', '12–19 Nov avg'], [300, 400, 600, 700, 900, 800],
    [K.ink, K.ink, K.ink, K.ink, K.pink, K.pink], { name: 'Weekly Instagram gain', x: X0, y: 2.4, w: 6.2, h: 3.0, max: 1000, fmt: '+#,##0',
      alt: 'Column chart of weekly Instagram follower gains rising from +300 to +900, averaging +800 in the two weeks to 19 Nov.' });
  T(s, '79.8K on 1 Oct → 84.3K on 19 Nov. The rise coincides with the step-up to 5–9 posts a week (pink). Each week is ±100 because the display rounds.',
    { x: X0, y: 5.5, w: 6.2, h: 0.8, fontSize: 12, color: K.body });
  T(s, 'X: typical post views (46.7K followers)', { x: 7.25, y: 2.0, w: 5.48, h: 0.35, fontSize: 15, bold: true });
  table(s, [['Week to', 'Posts', 'Median', 'Reach'], ['8 Oct', '≥5', '1.1K', '2.4%'], ['15 Oct', '0', '—', 'silent'], ['22 Oct', '4', '6.3K', '13.6%'],
    ['29 Oct', '≥5', '1.6K', '3.4%'], ['5 Nov', '≥5', '1.9K', '4.0%'], ['12 Nov', '≥5', '1.4K', '3.0%'], ['19 Nov', '≥4', '1.6K', '3.3%']],
    { x: 7.25, y: 2.45, w: 5.48, colW: [1.7, 1.2, 1.3, 1.28], fontSize: 13, rowH: 0.36, hl: [7] });
  T(s, 'Reach = median views ÷ followers; the target is 3%. The 22 Oct week includes two blood-donation gift posts.', { x: 7.25, y: 5.5, w: 5.48, h: 0.8, fontSize: 12, color: K.body });
}
// 7 TikTok posts
{
  const s = slide('tiktok-posts', 'LIGHT', 'Content', 'Content · TikTok, latest 10 videos', 'A character loop drew 14× the typical views; questions drew the comments',
    'Sources: TikTok creator embed and embed player, 19–20 Nov 2026 (post register). Labels show views · engagement rate (likes + comments + shares ÷ views).');
  const lab = ['7 Nov · 2.2%', '8 Nov · Abha · 3.4%', '11 Nov · ask · 2.1%', '13 Nov · Abha · 3.6%', '15 Nov · people · 3.4%', '17 Nov · 4.6%', '18 Nov · 3.4%', '19 Nov · 2.3%', '19 Nov · loop · 1.0%', '19 Nov · #gta6 · 4.4%'];
  const val = [2083, 2447, 1580, 1944, 1442, 1981, 774, 426, 25100, 1178];
  bar(s, lab.slice().reverse(), val.slice().reverse(), val.slice().reverse().map(v => v > 10000 ? K.pink : K.ink),
    { name: 'Views per video', dir: 'bar', x: X0, y: 1.95, w: 8.9, h: 4.15, max: 29000, gap: 35,
      alt: 'Bar chart of views on SEVEN’s latest 10 TikTok videos; the 19 Nov dancing-character loop reached 25,100 views, the rest 426 to 2,447.' });
  T(s, 'Median 1,762 views, median engagement 3.4%. Videos from 19 Nov were under a day old.', { x: X0, y: 6.2, w: 8.9, h: 0.4, fontSize: 12, color: K.body });
  s.addImage({ path: IMG + 'tt_breakout.jpg', x: 9.95, y: 1.95, w: 2.6, h: 4.68, sizing: { type: 'cover', w: 2.6, h: 4.68 }, rounding: false,
    altText: 'TikTok embed of SEVEN’s 19 Nov dancing-character video with 178 likes, 28 comments and 53 shares' });
}
// 8 Content
{
  const s = slide('content', 'ALT', null, 'Content · what SEVEN posts about', 'Five content pillars, Tabuk-led; Abha is coming back into the calendar',
    'Sources: 6 Nov analysis (creatives 13 Oct – 5 Nov); post register captions (TikTok, Snapchat), 19–20 Nov 2026.');
  table(s, [['Pillar', 'Examples, Oct–Nov 2026', 'Where it works'],
    ['Destination promos', 'Hot Wheels e-Karting, Cyber Bowling, Golfi', 'Most posts; Tabuk Reels lead on likes'],
    ['Booking prompts', '“احجزوا من الرابط في البايو”, holiday plans', 'Links on X only from 12 Nov'],
    ['People stories', '“Behind the Joy”, “engineers of joy”', '3.4% engagement on TikTok'],
    ['National moments', 'National Day 96, blood-donation gifts', 'Gift post: 39 replies on X'],
    ['Trend and character', 'Dancing loop, #gta6 tease', 'TikTok breakout: 25.1K views']],
    { x: X0, y: 2.0, w: CW, colW: [2.8, 5.1, 4.23], fontSize: 13, rowH: 0.42 });
  const w = (CW - 0.4) / 3;
  [['5 of 16', 'X and Instagram creatives naming Abha, 13 Oct – 5 Nov'], ['4 of 10', 'TikTok videos naming Abha, 7–19 Nov'], ['2 of 16', 'Snapchat Spotlights naming Abha; 6 name Tabuk']]
    .forEach((v, i) => kpi(s, X0 + i * (w + 0.2), 4.75, w, 1.8, v[0], v[1], { labSize: 13 }));
}
// 9 Engagement
{
  const s = slide('engagement', 'LIGHT', null, 'Content · how people respond', 'TikTok is where people respond; X is a broadcast channel and Instagram reacts weakly',
    'Sources: post register (TikTok, YouTube RSS likes); 6 Nov analysis (X and Instagram engagement, 5–15 posts per account); 20 Nov evidence X feed.');
  const c = [['Strong', 'D9F0E4', K.good, 'TikTok', '3.4%', 'Median engagement rate on the latest 10 videos.'],
    ['Small base', 'FCEBC7', K.amber, 'YouTube, organic', '2.8%', 'Likes ÷ views on 2026 organic uploads; median 295 views.'],
    ['Thin', 'F6DCDC', K.bad, 'X', '1.9', 'Interactions per 1,000 views; 8th of 12 accounts.'],
    ['Thin', 'F6DCDC', K.bad, 'Instagram', '28', 'Median likes a post on 82.7K followers; half Scene’s rate.']];
  const w = (CW - 0.6) / 4;
  c.forEach((v, i) => card(s, X0 + i * (w + 0.2), 2.05, w, 3.05, v[3], v[5], { pill: v[0], pillFill: v[1], pillColor: v[2], pillW: 1.25, big: v[4] }));
  T(s, 'The measures differ by platform, so compare each with its own peers, not across platforms. One bright spot on X: the 17 Nov “One destination. Endless possibilities.” post drew 16K views and 176 interactions (11 per 1,000), the best ratio captured on a large SEVEN post.',
    { x: X0, y: 5.35, w: CW, h: 0.9, fontSize: 13, color: K.body });
}
// 10 Paid
{
  const s = slide('paid', 'STATEMENT', null, 'Content · the paid-views question', 'SEVEN’s biggest view counts come with almost no reactions, on X and on YouTube',
    'Sources: 6 Nov analysis (4 Oct screenshot); YouTube channel RSS feed, 19 Nov 2026 (post register). Six YouTube films account for 99% of the channel’s 8.06M lifetime views.');
  const k = [['X · 4 Oct · Hot Wheels e-Karting, seven.sa card', '735.3K', 'views, 41 interactions: 0.06 per 1,000 views, about 1/34 of a typical SEVEN post'],
    ['YouTube · 10 Aug · “Joy in Tabuk”', '831.8K', 'views, 76 likes: 0.009%, against 2.8% on organic uploads'],
    ['YouTube · 5 Aug and 30 Sep', '300.8K', 'views on “Doors of Joy in Abha” and Hot Wheels, with 40 likes between them']];
  const w = (CW - 0.4) / 3;
  k.forEach((v, i) => kpi(s, X0 + i * (w + 0.2), 2.05, w, 2.35, v[1], v[2], { top: v[0], fill: 'FFF7FA', labSize: 13 }));
  T(s, 'This is the pattern of paid in-stream and website-card ads. Paid status is still unconfirmed, the tracker has no paid flag, and the X Ads data agreed on 16 Oct hasn’t been shared. Until then, these views can’t be judged on bookings.',
    { x: X0, y: 4.7, w: CW, h: 1.2, fontSize: 17, color: 'FFF7FA' });
}
// 11 Booking
{
  const s = slide('booking', 'LIGHT', 'Market', 'Market · the booking path', 'Booking links appeared on X this week; elsewhere guests still have to search',
    'Sources: 6 Nov analysis (booking path, peer link counts); 20 Nov evidence archive (SEVEN X feed, 12–19 Nov); post register captions; Snapchat public profile.');
  kpi(s, X0, 2.0, 3.6, 2.4, '0 of 24', 'Captured SEVEN posts with a link, while 6 of 16 creatives asked guests to book.', { top: '13 Oct – 5 Nov', fill: K.paper2, numSize: 40, labSize: 13 });
  kpi(s, X0 + 3.8, 2.0, 3.6, 2.4, '3 of 5', 'Newest X posts with a seven.sa link or card, e.g. “احجزوا من الرابط 👇”.', { top: '12–19 Nov', fill: K.ink, numColor: K.gold, labColor: K.soft, numSize: 40, labSize: 13 });
  card(s, X0 + 7.6, 2.0, CW - 7.6, 2.4, 'Still open', ['TikTok captions say “link in bio”.', 'Instagram bio led with the App Store (6 Nov).', 'Snapchat links to the home page.', 'No per-post tracking (UTM).']);
  table(s, [['X posts captured (to 5 Nov)', 'Booking link', '“Link in bio”', 'Ask to book'], ['VOX', '8 of 8', '0', '8'],
    ['Six Flags QC · Aquarabia QC', '1 of 5 each', '1 each', '2 each, with 50%-off offers'], ['SEVEN', '0 of 9', '0', '3']],
    { x: X0, y: 4.7, w: CW, colW: [3.8, 2.4, 2.4, 3.53], fontSize: 13, rowH: 0.4, hl: [3] });
}
// 12 Peers
{
  const s = slide('peers', 'ALT', null, 'Market · SEVEN against peers, 20 November', 'SEVEN out-reaches cinemas on X, but its TikTok is an eighth of Six Flags QC’s',
    'Sources: tracker 20 Nov verification (native follower counts); 6 Nov analysis (X reach per post). Followers are rounded displays.');
  table(s, [['Account', 'Instagram', 'TikTok', 'X', 'X reach per post'], ['SEVEN', '84.3K', '8,937', '46.7K', '4.5% (3.2% before)'],
    ['Six Flags Qiddiya City', '80.3K', '68.6K', '18.2K', '8.7%'], ['Aquarabia Qiddiya City', '37.5K', '39.8K', '8,810', '10.8%'],
    ['Sparky’s', '130K', '70.5K', '56.9K', '1.3%'], ['Scene Cinemas', '93.3K', '6,615', '93.5K', '1.9% (3.0% before)'],
    ['VOX Cinemas', 'not tracked', '153.6K', '200.3K', '1.9%'], ['Muvi Cinemas', 'not tracked', '426.4K', '232.3K', '3.4%'], ['Qiddiya (corporate)', '—', '—', '303K', '3.7%']],
    { x: X0, y: 1.95, w: CW, colW: [3.4, 2.1, 2.1, 1.9, 2.63], fontSize: 13, rowH: 0.4, hl: [1] });
  T(s, 'X reach = median views per post ÷ followers, three weeks to 5 Nov; “before” = four weeks to 15 Oct. SEVEN and Qiddiya were the only X accounts to improve. Six Flags QC has a similar Instagram audience but nearly 8× SEVEN’s TikTok: that’s the headroom.',
    { x: X0, y: 5.75, w: CW, h: 0.85, fontSize: 13, color: K.body });
}
// 13 Scene
{
  const s = slide('scene', 'LIGHT', null, 'Market · Scene Cinemas', 'Scene is flat everywhere, and its posts ask questions instead of selling tickets',
    'Sources: tracker Followers sheet and 20 Nov verification; 6 Nov analysis (Scene content and links, 13 posts captured from 14 Oct).');
  const k = [['93.5K', 'X followers, down 300 since 24 Sep'], ['93.3K', 'Instagram followers, down 200 since 15 Oct'], ['6,615', 'TikTok followers, up 82 since 24 Sep'], ['1.9%', 'X reach per post, down from 3.0% before 15 Oct']];
  const w = (CW - 0.6) / 4;
  k.forEach((v, i) => kpi(s, X0 + i * (w + 0.2), 2.0, w, 1.6, v[0], v[1], { labSize: 13 }));
  const w3 = (CW - 0.4) / 3;
  card(s, X0, 3.85, w3, 2.6, 'What Scene posts', '6 of 13 captured X posts are questions or quizzes (“which helmet would you pick?”). 2 ask guests to book, and none links to booking. Instagram runs 12+ posts a week.');
  card(s, X0 + w3 + 0.2, 3.85, w3, 2.6, 'What VOX does', 'Every captured VOX post (8 of 8) says “book now” and links to the film’s booking page.');
  card(s, X0 + 2 * (w3 + 0.2), 3.85, w3, 2.6, 'Next step', 'Link every film post to its booking page, then test linked posts against question posts on views and clicks.', { fill: K.ink, headColor: K.gold, bodyColor: K.soft });
}
// 14 Hygiene
{
  const s = slide('hygiene', 'ALT', null, 'Market · brand hygiene', 'Small inconsistencies split SEVEN’s reach and blur who it is',
    'Sources: post register and public profiles (TikTok, Snapchat, YouTube About), 19–20 Nov 2026.');
  const c = [['Identity', 'TikTok and Snapchat bios say SEVEN is a Qiddiya company; YouTube still says PIF. There are two Facebook pages, and YouTube’s LinkedIn link goes to an admin-only page.'],
    ['Hashtags', 'Variants split each destination: #سڤن_أبها and #سڤن_ابها, tags with hidden right-to-left marks, and tags run into punctuation (#سڤن_تبوك!, #SEVEN_Tabuk,).'],
    ['YouTube', 'Uploads went 21 (2023), 4, 2, then 15 (2026). 1.62K subscribers; ad-served films carry the views. No playlists by destination.'],
    ['Snapchat', 'A steady 2.7 Spotlights a week, mostly Tabuk. No public view counts, and 13 of the 16 posts captured have no comments.']];
  const w = (CW - 0.2) / 2;
  c.forEach((v, i) => card(s, X0 + (i % 2) * (w + 0.2), 2.0 + Math.floor(i / 2) * 2.3, w, 2.1, v[0], v[1], { bodySize: 14 }));
}
// 15 Progress
{
  const s = slide('progress', 'LIGHT', 'Action', 'Action · progress since 16 October', 'Three actions moved and TikTok is ahead; paid and data actions are still open',
    'Sources: 6 Nov analysis (actions agreed 16 Oct and 6 Nov); tracker 20 Nov verification and Method sheet; 20 Nov evidence archive; post register.');
  const st = (t, c) => ({ text: t, options: { color: c, bold: true } });
  table(s, [['Action agreed (owner)', 'Status', 'Evidence to 20 Nov'],
    ['Restart X, booking-led (Marketing)', st('Moving', K.good), '4–5 posts a week; 3 of 5 newest link to seven.sa'],
    ['TikTok, ~475 followers a week (Marketing)', st('Ahead', K.good), '+2,377 to 12 Nov; +1,096 in the week to 19 Nov'],
    ['Abha slot in the calendar (Marketing)', st('Moving', K.good), '4 of 10 TikToks name Abha; 2 of 16 Snaps'],
    ['Fix the tracker (Strategy)', st('Partly', K.amber), 'Native counts verified on 20 Nov; no paid flag yet'],
    ['X Ads data, 30 Sep and 4 Oct (Performance)', st('Open', K.bad), 'Not shared; every post logged as organic'],
    ['Native exports: X, Meta, TikTok (Marketing)', st('Open', K.bad), 'None shared; reach, clicks and spend unknown'],
    ['Flash data to link posts to visits (PMU)', st('Open', K.bad), 'Not in the pack']],
    { x: X0, y: 2.0, w: CW, colW: [4.7, 1.5, 5.93], fontSize: 14, rowH: 0.5 });
}
// 16 Plan
{
  const s = slide('plan', 'ALT', null, 'Action · the next 90 days', 'Make every post bookable, settle paid spend, and scale what TikTok proved',
    'Owners and dates are proposed, for confirmation. Read each change against a comparison week or site: a rise that coincides with it isn’t proof it caused it.');
  table(s, [['#', 'Action', 'Owner · when', 'Read it by'],
    ['1', 'Tracked booking link on every booking post', 'Marketing · 23 Nov', 'Clicks, bookings per post'],
    ['2', 'Ads data for Aug–Oct; paid flag and spend in tracker', 'Performance · 27 Nov', 'Cost per booking'],
    ['3', 'TikTok: 4–5 videos a week, trend formats, questions', 'Marketing · weekly', 'Median views, engagement'],
    ['4', 'One dated, coded offer per site', 'Commercial · 2 weeks', 'Redemptions vs control'],
    ['5', 'At least 2 Abha creatives a week, every platform', 'Marketing · weekly', 'Posts and bookings by site'],
    ['6', 'One bio line, one Facebook page, hashtag style sheet', 'Marketing · 4 Dec', 'Zero conflicts in audit'],
    ['7', 'YouTube: Shorts from TikTok, playlists, end screens', 'Marketing · 31 Dec', 'Subscribers, organic views'],
    ['8', 'Scene: link every film post to booking', 'Scene · 23 Nov', 'Clicks by post type']],
    { x: X0, y: 2.0, w: CW, colW: [0.5, 5.6, 2.8, 3.23], fontSize: 13.5, rowH: 0.47 });
}
// 17 KPIs
{
  const s = slide('kpis', 'LIGHT', null, 'Action · proposed targets', 'Measure social on bookings and growth, not raw views',
    'Targets are proposals for discussion, extrapolated from the tracker’s current weekly pace. Followers are public displays, rounded to the nearest 100.');
  table(s, [['Measure', 'Now (20 Nov)', '31 Dec', '31 Mar'], ['Booking posts with a tracked link', '3 of 5 on X', '100%, all platforms', '100%'],
    ['Bookings attributed to social', 'not measured', 'baseline set', '+25% on baseline'], ['TikTok followers', '8,937', '10K (target kept)', '15K'],
    ['TikTok median views per video', '1,762', '3K', '5K'], ['Instagram followers', '84.3K', '88K', '95K'], ['X typical reach per post', '3.3%', '3% or more', '4%'],
    ['Abha share of creatives', '4 of 10 on TikTok', '40%, all platforms', 'in line with bookings'], ['Posts flagged paid or organic', 'none', 'every post', 'every post']],
    { x: X0, y: 2.0, w: CW, colW: [4.6, 2.5, 2.5, 2.53], fontSize: 14, rowH: 0.48 });
}
// 18 Gaps
{
  const s = slide('gaps', 'DARK', null, 'Decisions and data asks', 'Three handovers would turn this from a public-view audit into a booking view',
    'The full post register (71 posts with screenshots), the assessment and the source data are in the seven-social-audit repository folder.');
  const c = [['1', 'Ads data', 'X Ads and Google Ads spend, clicks and conversions for August to October. This settles the paid-views question.'],
    ['2', 'Native analytics', 'Monthly exports from Meta Business Suite, TikTok Studio, X Analytics and Snapchat Insights: reach, saves and link clicks.'],
    ['3', 'Visit data', 'PMU’s flash data, by site and week, so posts can be read against visits and bookings.']];
  const w = (CW - 0.4) / 3;
  c.forEach((v, i) => card(s, X0 + i * (w + 0.2), 2.05, w, 2.7, v[1], v[2], { fill: K.card2, bigFirst: true, big: v[0], bigColor: K.gold, headColor: K.paper, bodyColor: K.soft, bodySize: 13.5 }));
  T(s, 'Not visible publicly today: Instagram and Facebook post content, X before the newest ~5 posts, TikTok before the latest 10 videos, and any Snapchat views.',
    { x: X0, y: 5.1, w: CW, h: 0.9, fontSize: 16, color: K.soft });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
