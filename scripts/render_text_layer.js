#!/usr/bin/env node
/*
 * render_text_layer.js — render templates/text_layer.html to video files.
 *
 * Usage:
 *   node render_text_layer.js --config text_config.json --out ./text_layer \
 *        [--audio vo.m4a] [--words audio_analysis/words.json] [--from 0] [--to <end>]
 *        [--fps 30] [--bg "#F4F2ED"] [--alpha auto|prores|animation] [--fallback]
 *
 * --captions [karaoke|pop|blur-rise]  CAPTIONS MODE: builds every caption from --words
 *          (3-4 words per caption, split at pauses and punctuation), styled by
 *          cfg.captions (see references/captions.md). Also writes Captions.srt.
 * --words  fills any word without a "t" from the voiceover word timestamps
 *          (analyze_audio.sh output): each word appears when it is spoken.
 *          Use "say" on a word when the on-screen form differs from what is
 *          said, e.g. { "w": "72%", "say": "seventy-two" }.
 *
 * Writes to --out:
 *   TextLayer_transparent.mov        video with alpha for Premiere, DaVinci, After Effects, Final Cut.
 *                                    --alpha auto (default): ProRes 4444 up to 60 s; QuickTime
 *                                    Animation (qtrle) for longer spans, which stores only what
 *                                    changes, so a long, mostly empty text layer stays small and fast.
 *   TextLayer_greenscreen.mp4        H.264 on pure green 0x00FF00 (CapCut: Cutout > Chroma key)
 *   TextLayer_preview_with_audio.mp4 text over a plain background + the VO, to check sync
 *   stills/still_N.png               preview frames to check spelling, clipping and position
 *   render_report.json               timing span, shrunk items, fonts used, method
 *
 * Timing: frames cover [--from, --to] on the VO timeline (default 0 to the last
 * item's end). Place the file on the timeline at --from (0.00 s for a full render).
 *
 * Needs ffmpeg. Uses Playwright or Puppeteer with any Chromium it can find.
 * If no headless browser works (or --fallback is passed), falls back to
 * ffmpeg drawtext with the same timing (simpler animation, same words).
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execSync, spawnSync } = require('child_process');

// ---------------------------------------------------------------- args
const args = {}; const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; args[k] = v; } }
if (!args.config) { console.error('usage: node render_text_layer.js --config text_config.json --out DIR [--audio VO] [--from S] [--to E] [--fps 30] [--bg "#hex"]'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8'));
// ---------------------------------------------------------------- captions mode
if (args.captions) {
  if (!args.words || !fs.existsSync(args.words)) { console.error('--captions needs --words audio_analysis/words.json'); process.exit(1); }
  const C = Object.assign({ maxWords: 4, maxChars: 24, gap: 0.35, x: 0.5, y: null, anim: typeof args.captions === 'string' ? args.captions : 'karaoke',
    style: { family: 'Montserrat', weight: 800, size: 88, color: '#FFFFFF', highlight: '#FFD84A', highlightScale: 1, stroke: '8px #111111', case: 'upper', tracking: 0 } }, cfg.captions || {});
  const vertical = (cfg.height || 1080) > (cfg.width || 1920);
  const y = C.y != null ? C.y : (vertical ? 0.70 : 0.84);
  cfg.styles = Object.assign({}, cfg.styles || {}, { caption: C.style });
  const ws = (JSON.parse(fs.readFileSync(args.words, 'utf8')).words || []).filter(w => w.start != null);
  const groups = []; let g = [];
  ws.forEach((w, i) => {
    const prev = ws[i - 1];
    const chars = g.map(x => x.token).join(' ').length + w.token.length;
    if (g.length && (g.length >= C.maxWords || chars > C.maxChars || w.start - prev.end > C.gap || /[.?!,;:\u2014]$/.test(prev.token))) { groups.push(g); g = []; }
    g.push(w);
  });
  if (g.length) groups.push(g);
  // merge one-word flashes ("though,") into a neighbour so nothing blinks by
  for (let k = 0; k < groups.length; k++) {
    const grp = groups[k];
    if (grp.length === 1 && grp[0].end - grp[0].start < 0.6 && groups.length > 1) {
      const nx = groups[k + 1], pv = groups[k - 1];
      if (nx && nx.length < C.maxWords + 1 && nx[0].start - grp[0].end < 0.6) { groups[k + 1] = [...grp, ...nx]; groups.splice(k, 1); k--; }
      else if (pv && pv.length < C.maxWords + 1) { pv.push(...grp); groups.splice(k, 1); k--; }
    }
  }
  const clean = (t) => t.replace(/^["\u201c\u2018(]+|["\u201d\u2019),;:]+$/g, '').replace(/[\u2014\u2013]$/, '');
  cfg.items = [...(cfg.items || []), ...groups.map((grp, k) => {
    const next = groups[k + 1];
    const end = Math.min(grp[grp.length - 1].end + 0.6, next ? next[0].start - 0.1 : Infinity);
    return { id: `cap${k + 1}`, start: Math.max(0, grp[0].start - 0.05), end: Math.max(end, grp[0].start + 0.4), x: C.x, y, align: 'center', valign: 'middle',
      anim: C.anim, exitDur: 0.12, unitDur: 0.2, style: 'caption', words: grp.map(w => ({ w: clean(w.token), t: w.start })) };
  })];
  // SRT export for YouTube / CapCut / Premiere
  const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`; };
  const outDir = path.resolve(args.out || './text_layer'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'Captions.srt'), cfg.items.filter(i => i.style === 'caption').map((it, k) => `${k + 1}\n${ts(it.start)} --> ${ts(it.end)}\n${it.words.map(w => w.w).join(' ')}\n`).join('\n'));
}
const norm = (x) => String(x || '').toLowerCase().replace(/[\u2019']/g, "'").replace(/[^a-z0-9%']+/g, '');
// Fill missing word times from the VO word timestamps (spoken-word sync)
(function fillTimes() {
  const missing = (cfg.items || []).some(it => (it.words || []).some(w => w.t == null));
  if (!missing) return;
  let spoken = [];
  if (args.words && fs.existsSync(args.words)) spoken = (JSON.parse(fs.readFileSync(args.words, 'utf8')).words || []);
  for (const it of cfg.items || []) {
    let cursor = it.start - 0.6;
    const ws = it.words || [];
    ws.forEach((w, k) => {
      if (w.t != null) { cursor = w.t; return; }
      const key = norm(w.say || w.w.split(/\s+/)[0]);
      const hit = spoken.find(s => s.start >= cursor - 0.05 && s.start <= it.end && norm(s.token).startsWith(key) && key);
      if (hit) { w.t = Math.max(it.start, hit.start); cursor = hit.start + 0.01; }
      else { w.t = it.start + (it.end - it.start) * 0.6 * k / Math.max(1, ws.length); w.timing = 'estimated'; }
    });
    ws.sort((a, b) => a.t - b.t);
  }
})();
const OUT = path.resolve(args.out || './text_layer'); fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
const FPS = Number(args.fps || cfg.fps || 30);
const W = cfg.width || 1920, H = cfg.height || 1080;
const lastEnd = Math.max(...(cfg.items || []).map(i => i.end), 0);
const FROM = Number(args.from != null ? args.from : (cfg.from != null ? cfg.from : 0));
const TO = Number(args.to != null ? args.to : (cfg.to != null ? cfg.to : lastEnd + 0.2));
const BG = args.bg || cfg.previewBackground || '#F4F2ED';
const TEMPLATE = path.resolve(__dirname, '..', 'templates', 'text_layer.html');
const report = { from: FROM, to: TO, fps: FPS, size: `${W}x${H}`, fonts: [], warnings: [] };
const sh = (c) => execSync(c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
function hexToFfmpeg(h) { return '0x' + h.replace('#', '').slice(0, 6); }

// ---------------------------------------------------------------- fonts (@fontsource)
const FONT_CACHE = path.join(os.homedir(), '.cache', 'voiceframe-by-meno-fonts');
function fontFile(family, weight, style) {
  const slug = family.toLowerCase().trim().replace(/\s+/g, '-');
  const pkgDir = path.join(FONT_CACHE, 'node_modules', '@fontsource', slug);
  if (!fs.existsSync(pkgDir)) {
    fs.mkdirSync(FONT_CACHE, { recursive: true });
    const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--silent', '--prefix', FONT_CACHE, `@fontsource/${slug}`], { stdio: 'ignore', timeout: 120000 });
    if (r.status !== 0 || !fs.existsSync(pkgDir)) return null;
  }
  const dir = path.join(pkgDir, 'files'); if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.startsWith(`${slug}-latin-`) && f.endsWith('.woff2'));
  const st = style === 'italic' ? 'italic' : 'normal';
  const cands = files.map(f => { const m = f.match(/-latin-(\d+|variable)(?:-wght)?-(normal|italic)\.woff2$/); return m ? { f, w: m[1] === 'variable' ? Number(weight) : Number(m[1]), s: m[2] } : null; })
    .filter(Boolean).filter(c => c.s === st);
  if (!cands.length) return null;
  cands.sort((a, b) => Math.abs(a.w - weight) - Math.abs(b.w - weight));
  return path.join(dir, cands[0].f);
}
function resolveFonts() {
  const need = new Map();
  for (const s of Object.values(cfg.styles || {})) {
    const fam = String(s.family || '').split(',')[0].replace(/["']/g, '').trim(); if (!fam) continue;
    const key = `${fam}|${s.weight || 400}|${s.italic ? 'italic' : 'normal'}`; need.set(key, { family: fam, weight: s.weight || 400, style: s.italic ? 'italic' : 'normal' });
  }
  const fonts = [];
  for (const f of need.values()) {
    const file = fontFile(f.family, f.weight, f.style);
    if (!file) { report.warnings.push(`Font "${f.family}" ${f.weight} ${f.style} not found on npm @fontsource; the browser fallback font was used.`); continue; }
    fonts.push({ ...f, file, src: 'data:font/woff2;base64,' + fs.readFileSync(file).toString('base64') });
    report.fonts.push(`${f.family} ${f.weight} ${f.style} (${path.basename(file)})`);
  }
  return fonts;
}

// ---------------------------------------------------------------- browser
function findChromium() {
  const c = [];
  for (const base of ['/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright')]) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
        const p = path.join(base, d, rel); if (fs.existsSync(p)) c.push(p);
      }
    }
  }
  for (const b of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) { try { const p = sh(`command -v ${b}`).trim(); if (p) c.push(p); } catch (e) {} }
  return c;
}
function tryRequire(name) {
  const roots = [process.cwd(), __dirname];
  try { roots.push(sh('npm root -g').trim()); } catch (e) {}
  for (const r of roots) { try { return require(require.resolve(name, { paths: [r] })); } catch (e) {} }
  return null;
}
async function launch() {
  const pw = tryRequire('playwright') || tryRequire('playwright-core');
  if (pw) {
    try { return { kind: 'playwright', b: await pw.chromium.launch() }; } catch (e) {}
    for (const exe of findChromium()) { try { return { kind: 'playwright', b: await pw.chromium.launch({ executablePath: exe }) }; } catch (e) {} }
  }
  const pp = tryRequire('puppeteer') || tryRequire('puppeteer-core');
  if (pp) {
    try { return { kind: 'puppeteer', b: await pp.launch({ headless: 'new', args: ['--no-sandbox'] }) }; } catch (e) {}
    for (const exe of findChromium()) { try { return { kind: 'puppeteer', b: await pp.launch({ headless: 'new', executablePath: exe, args: ['--no-sandbox'] }) }; } catch (e) {} }
  }
  // last try: install playwright-core from npm and use a Chromium already on disk
  if (findChromium().length) {
    const dir = path.join(os.homedir(), '.cache', 'voiceframe-by-meno-pw');
    spawnSync('npm', ['install', '--silent', '--no-audit', '--no-fund', '--prefix', dir, 'playwright-core'], { stdio: 'ignore', timeout: 180000 });
    try { const core = require(path.join(dir, 'node_modules', 'playwright-core'));
      for (const exe of findChromium()) { try { return { kind: 'playwright', b: await core.chromium.launch({ executablePath: exe }) }; } catch (e) {} } } catch (e) {}
  }
  return null;
}

// ---------------------------------------------------------------- encode helpers
let REGION = null;   // {x,y,w,h}: area actually captured; padded back to the full canvas here
function encode(listFile) {
  const padF = REGION ? `,format=rgba,pad=${W}:${H}:${REGION.x}:${REGION.y}:color=0x00000000` : '';
  const dur = (TO - FROM).toFixed(3);
  const src = `-f concat -safe 0 -i ${q(listFile)}`;
  const alpha = args.alpha && args.alpha !== 'auto' ? args.alpha : ((TO - FROM) <= 60 ? 'prores' : 'animation');
  report.alphaCodec = alpha === 'prores' ? 'ProRes 4444' : 'QuickTime Animation (qtrle, RGBA)';
  const venc = alpha === 'prores' ? `-vf "fps=${FPS}${padF},format=yuva444p10le" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0`
                                  : `-vf "fps=${FPS}${padF},format=argb" -c:v qtrle -pix_fmt argb`;
  sh(`ffmpeg -v error -y ${src} ${venc} -t ${dur} ${q(path.join(OUT, 'TextLayer_transparent.mov'))}`);
  sh(`ffmpeg -v error -y -f lavfi -i color=c=0x00FF00:s=${W}x${H}:r=${FPS} ${src} -filter_complex "[1:v]fps=${FPS}${padF}[t];[0:v][t]overlay=shortest=1:format=auto,format=yuv420p" -t ${dur} -c:v libx264 -crf 16 -pix_fmt yuv420p ${q(path.join(OUT, 'TextLayer_greenscreen.mp4'))}`);
  const aud = args.audio ? `-ss ${FROM} -t ${dur} -i ${q(args.audio)}` : `-f lavfi -t ${dur} -i anullsrc=r=48000:cl=stereo`;
  sh(`ffmpeg -v error -y -f lavfi -i color=c=${hexToFfmpeg(BG)}:s=${W}x${H}:r=${FPS} ${src} ${aud} -filter_complex "[1:v]fps=${FPS}${padF}[t];[0:v][t]overlay=shortest=1:format=auto,format=yuv420p[v]" -map "[v]" -map 2:a -t ${dur} -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k ${q(path.join(OUT, 'TextLayer_preview_with_audio.mp4'))}`);
}
function stills() {
  // Landed state of up to 3 items (plus the last one); topped up to 3 stills with
  // mid-reveal and exit frames when there are fewer items.
  const items = (cfg.items || []).filter(i => i.end > FROM && i.start < TO);
  const pick = items.length <= 4 ? items : [...items.slice(0, 3), items[items.length - 1]];
  const times = [];
  const tw = (it) => (it.anim || (cfg.defaults || {}).anim) === 'typewriter';
  pick.forEach(it => {
    const lastT = Math.max(...(it.words || []).map(w => w.t + (tw(it) ? 0.06 * w.w.length : 0)), it.start);
    times.push({ id: it.id, t: Math.min(it.end - 0.35, lastT + 0.5), what: 'landed' });
  });
  if (times.length < 3 && pick.length) {
    const a = pick[0], z = pick[pick.length - 1];
    times.push({ id: a.id, t: Math.min(a.end - 0.4, (a.words && a.words[0] ? a.words[0].t : a.start) + 0.15), what: 'revealing' });
    if (times.length < 3) times.push({ id: z.id, t: z.end - 0.12, what: 'exiting' });
  }
  const out = [];
  times.sort((x, y) => x.t - y.t).forEach((s, n) => {
    const t = Math.max(0, Math.min(TO - FROM - 0.04, s.t - FROM));
    const f = path.join(OUT, 'stills', `still_${n + 1}_${s.id}_${s.what}_at_${(t + FROM).toFixed(2)}s.png`);
    try { sh(`ffmpeg -v error -y -ss ${t.toFixed(3)} -i ${q(path.join(OUT, 'TextLayer_preview_with_audio.mp4'))} -frames:v 1 ${q(f)}`); out.push(f); } catch (e) {}
  });
  report.stills = out;
}

// ---------------------------------------------------------------- browser render
async function renderBrowser(fonts) {
  const L = await launch(); if (!L) return false;
  report.method = `${L.kind} + Chromium`;
  const page = await L.b.newPage(L.kind === 'playwright' ? { viewport: { width: W, height: H }, deviceScaleFactor: 1 } : undefined);
  if (L.kind === 'puppeteer') await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const injected = JSON.stringify({ ...cfg, fonts: fonts.map(({ file, ...f }) => f) });
  const init = `window.TEXT_CONFIG = ${injected}; window.__NO_AUTOPLAY__ = true;`;
  if (L.kind === 'playwright') await page.addInitScript(init); else await page.evaluateOnNewDocument(init);
  await page.goto('file://' + TEMPLATE);
  report.layout = await page.evaluate(() => window.textLayerReady);
  // Capture only the band the text can occupy (union of all items + margin for blur and pop)
  const box = await page.evaluate(() => { let a = [Infinity, Infinity, -Infinity, -Infinity];
    document.querySelectorAll('.item').forEach(e => { const r = e.getBoundingClientRect(); a = [Math.min(a[0], r.left), Math.min(a[1], r.top), Math.max(a[2], r.right), Math.max(a[3], r.bottom)]; }); return a; });
  if (isFinite(box[0])) {
    const m = 60, x = Math.max(0, Math.floor(box[0] - m)) & ~1, y = Math.max(0, Math.floor(box[1] - m)) & ~1;
    const w = (Math.min(W, Math.ceil(box[2] + m)) - x) & ~1, h = (Math.min(H, Math.ceil(box[3] + m)) - y) & ~1;
    if (w * h < W * H * 0.8) { REGION = { x, y, w, h }; report.captureRegion = REGION; }
  }
  const shrunk = (report.layout || []).filter(x => x.shrunk < 1);
  if (shrunk.length) report.warnings.push('Auto-shrunk to fit the safe area: ' + shrunk.map(x => `${x.id} (x${x.shrunk})`).join(', '));
  const frames = path.join(OUT, '.frames'); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames);
  const n = Math.round((TO - FROM) * FPS); let prevSig = null, prevFile = null, runStart = 0; const list = [];
  const flush = (end) => { if (prevFile) list.push(`file ${q(prevFile)}\nduration ${((end - runStart) / FPS).toFixed(5)}`); };
  let shots = 0;
  for (let i = 0; i < n; i++) {
    const sig = await page.evaluate(t => window.render(t), FROM + i / FPS);
    if (sig !== prevSig) {
      flush(i);
      const f = path.join(frames, `f${String(i).padStart(6, '0')}.png`);
      await page.screenshot({ path: f, omitBackground: true, clip: REGION ? { x: REGION.x, y: REGION.y, width: REGION.w, height: REGION.h } : { x: 0, y: 0, width: W, height: H } }); shots++;
      prevSig = sig; prevFile = f; runStart = i;
    }
  }
  flush(n); list.push(`file ${q(prevFile)}`);
  const listFile = path.join(frames, 'list.txt'); fs.writeFileSync(listFile, list.join('\n') + '\n');
  await L.b.close();
  report.uniqueFrames = shots; report.totalFrames = n;
  encode(listFile);
  return true;
}

// ---------------------------------------------------------------- ffmpeg drawtext fallback
function systemFont(fam, bold, italic) {
  try { return sh(`fc-match -f '%{file}' ${q(`${fam}:weight=${bold ? 200 : 80}${italic ? ':slant=100' : ''}`)}`).trim(); } catch (e) { return '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; }
}
function renderFallback(fonts) {
  report.method = 'ffmpeg drawtext fallback (word-by-word reveal, fade in and out)';
  const esc = (s) => s.replace(/'/g, '\u2019');   // inside '...' filter values everything else is literal
  const filters = [];
  for (const it of cfg.items || []) {
    const words = it.words || []; if (!words.length) continue;
    // split into lines at "br"; each line keeps the style of its first word
    const lines = []; words.forEach(w => { if (!lines.length || w.br) lines.push([]); lines[lines.length - 1].push(w); });
    const lineStyle = (ln) => (cfg.styles || {})[ln[0].style || it.style] || {};
    const heights = lines.map(ln => Math.round((lineStyle(ln).size || 96) * 1.1));
    const total = heights.reduce((x, y) => x + y, 0);
    const y0 = it.valign === 'middle' ? it.y * H - total / 2 : it.valign === 'bottom' ? it.y * H - total : it.y * H;
    const align = it.align || 'left';
    const xExpr = align === 'center' ? `${it.x * W}-text_w/2` : align === 'right' ? `${it.x * W}-text_w` : `${it.x * W}`;
    const fadeOut = `if(gt(t,${(it.end - FROM - 0.3).toFixed(3)}),max(0,(${(it.end - FROM).toFixed(3)}-t)/0.3),1)`;
    let yAcc = y0;
    lines.forEach((ln, li) => {
      const st = lineStyle(ln);
      const fam = String(st.family || 'DejaVu Sans').split(',')[0].replace(/["']/g, '').trim();
      const fontfile = systemFont(fam, (st.weight || 400) >= 600, !!st.italic);
      const size = Math.round(st.size || 96), color = st.color || '#111111';
      ln.forEach((w, k) => {
        const text = ln.slice(0, k + 1).map(x => x.w).join(' ');
        const next = ln[k + 1] ? ln[k + 1].t : it.end;
        const a = Math.max(w.t, it.start) - FROM, b = next - FROM;
        const fadeIn = k === 0 ? `min(1,(t-${a.toFixed(3)})/0.25)` : '1';
        filters.push(`drawtext=expansion=none:fontfile='${fontfile}':text='${esc(text)}':fontsize=${size}:fontcolor=${color}:x='${xExpr}':y=${Math.round(yAcc)}:alpha='${fadeIn}*${fadeOut}':enable='between(t,${a.toFixed(3)},${b.toFixed(3)})'`);
      });
      yAcc += heights[li];
    });
  }
  const dur = (TO - FROM).toFixed(3); const vf = filters.join(',') || 'null';
  const fr = path.join(OUT, '.frames'); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
  sh(`ffmpeg -v error -y -f lavfi -i color=c=black@0.0:s=${W}x${H}:r=${FPS},format=rgba -vf ${q(vf)} -t ${dur} ${q(path.join(fr, 'f%06d.png'))}`);
  const list = fs.readdirSync(fr).filter(f => f.endsWith('.png')).sort().map(f => `file ${q(path.join(fr, f))}\nduration ${(1 / FPS).toFixed(5)}`);
  const listFile = path.join(fr, 'list.txt'); fs.writeFileSync(listFile, list.join('\n') + '\n');
  encode(listFile);
  report.warnings.push('Rendered with the ffmpeg fallback: words appear in order but without blur, rise or pop.');
}

// ---------------------------------------------------------------- main
(async () => {
  try { sh('ffmpeg -version'); } catch (e) { console.error('ffmpeg is required'); process.exit(1); }
  const fonts = resolveFonts();
  const est = (cfg.items || []).flatMap(it => (it.words || []).filter(w => w.timing === 'estimated').map(w => `${it.id}:${w.w}`));
  if (est.length) report.warnings.push('No spoken match, time estimated (add "say" or "t"): ' + est.join(', '));
  report.itemTimes = (cfg.items || []).map(it => ({ id: it.id, start: it.start, end: it.end, words: (it.words || []).map(w => `${w.w}@${Number(w.t).toFixed(2)}`) }));
  let ok = false;
  if (!args.fallback) { try { ok = await renderBrowser(fonts); } catch (e) { report.warnings.push('Browser render failed: ' + e.message); } }
  if (!ok) renderFallback(fonts);
  stills();
  fs.rmSync(path.join(OUT, '.frames'), { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT, 'render_report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})();
