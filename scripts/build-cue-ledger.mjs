// Builds the BSR photoreal implementation ledger from docs/Clue+Prompt/*.md
// Usage: node scripts/build-cue-ledger.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs', 'Clue+Prompt');
const OUT = path.join(ROOT, 'docs', 'styleframes', 'hero', 'photoreal-reconstruction');
fs.mkdirSync(OUT, { recursive: true });
const STATUS_JSON = path.join(OUT, 'ledger-status.json');

const FILES = {
  ctrl: 'BSR_CLAUDE_AUTONOMOUS_PHOTOREAL_IMPLEMENTATION_PROMPT.md',
  master: 'BSR_CLAUDE_MASTER_PHOTOREAL_RECONSTRUCTION_PROMPT.md',
  atlas: 'BSR_PER_IMAGE_PER_ASSET_PHOTOREAL_CUE_ATLAS.md',
  forensics: 'BSR_REAL_WORLD_ASSET_FORENSICS_CUE_PACK.md',
  untitled: 'Untitled.md',
};
const STATUSES = ['TODO', 'IN_PROGRESS', 'IMPLEMENTED', 'VALIDATED', 'BLOCKED', 'N/A'];
const SCENES = ['Continuity', 'Industrial', 'Service', 'Open Road', 'Preparation (dock blue hour)', 'Loading', 'Ready', 'Departure', 'Reach'];

const read = (n) => {
  const p = path.join(SRC, n);
  const raw = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
  return { name: n, bytes: fs.statSync(p).size, lines: raw.split(/\r?\n/), };
};
const src = Object.fromEntries(Object.entries(FILES).map(([k, n]) => [k, read(n)]));
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const clip = (s, n) => { s = esc(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const cueIndex = [];

// ---------- status json ----------
const SKELETON = {
  _doc: 'Status overrides for implementation-ledger.md (hand-edited; build-cue-ledger.mjs never overwrites this file). ' +
    'Each value: {"status": "TODO|IN_PROGRESS|IMPLEMENTED|VALIDATED|BLOCKED|N/A", "evidence": "", "files": "", "notes": ""}. ' +
    'Key grammar: family:R07 | asset:04-A03 | scene:04 | cat:<ref>-<catnum> (e.g. cat:04-01) | ref:<ref> (e.g. ref:04) | for:<forensics section number> | ut:S<shot>-<n> | decision:<n> | cue:<master cue id e.g. 04-C012>. ' +
    'Sections in this file: "family", "asset", "scene", "cat", "ref", "for", "ut", "decision", "cue" hold the keys after the colon (i.e. family:R07 is stored as {"family":{"R07":{...}}}); flat "family:R07" keys are also accepted. ' +
    '"defaults" may hold {"family":"TODO","asset":"TODO","cue":"TODO",...} fallback statuses. Cue status resolution: cue > cat > ref > defaults.cue > TODO. ' +
    'Asset status: asset > scene > defaults.asset > TODO. Forensics: for > defaults.for > TODO.',
  defaults: {}, family: {}, asset: {}, scene: {}, cat: {}, ref: {}, for: {}, ut: {}, decision: {}, cue: {},
};
let createdStatus = false;
if (!fs.existsSync(STATUS_JSON)) { fs.writeFileSync(STATUS_JSON, JSON.stringify(SKELETON, null, 2) + '\n'); createdStatus = true; }
let J = {};
try { J = JSON.parse(fs.readFileSync(STATUS_JSON, 'utf8')); } catch (e) { console.error('WARN: ledger-status.json unreadable:', e.message); }
function entry(kind, key) {
  const v = J[kind]?.[key] ?? J[`${kind}:${key}`];
  if (v == null) return null;
  return typeof v === 'string' ? { status: v } : v;
}
const dflt = (kind) => J.defaults?.[kind] || 'TODO';
const norm = (s) => { s = String(s || '').toUpperCase().replace(/[ -]/g, '_'); return s === 'NA' ? 'N/A' : (STATUSES.includes(s) ? s : 'TODO'); };
function firstStatus(list, kind) {
  for (const [k, key] of list) { const e = entry(k, key); if (e?.status) return { status: norm(e.status), e, from: `${k}:${key}` }; }
  return { status: norm(dflt(kind)), e: null, from: 'default' };
}
const cueStatus = (id, ref, cat) => firstStatus([['cue', id], ['cat', `${ref}-${cat}`], ['ref', ref]], 'cue').status;

// ---------- master ----------
const M = src.master.lines;
const masterCues = []; let ref = null, refTitle = {}, cat = null, catName = {};
const catRows = new Map(); let looseMaster = 0;
const CUE_M = /^\s*- \*\*\[(\d\d)-C(\d+)\]\s*\[(P\d)\]\s*\[([^\]]+)\]\*\*\s*(.*)$/;
for (const l of M) {
  let m;
  if ((m = /^## Reference (\d\d)\s*[—-]\s*(.*)$/.exec(l))) { ref = m[1]; refTitle[ref] = m[2].trim(); cat = null; continue; }
  if (ref && (m = /^### (\d+)\s+(.*)$/.exec(l))) { cat = m[1].padStart(2, '0'); catName[`${ref}-${cat}`] = m[2].trim(); continue; }
  if (/\[\d\d-C\d+\]/.test(l) && /^\s*- \*\*\[/.test(l) && !CUE_M.test(l)) looseMaster++;
  if ((m = CUE_M.exec(l))) {
    const c = { id: `${m[1]}-C${m[2]}`, ref: m[1], cat: cat || '00', pri: m[3], tag: m[4], text: m[5] };
    masterCues.push(c);
    const k = `${c.ref}-${c.cat}`;
    if (!catRows.has(k)) catRows.set(k, { ref: c.ref, cat: c.cat, name: catName[k] || '?', n: 0, P0: 0, P1: 0, P2: 0, P3: 0, first: c.id, last: c.id });
    const r = catRows.get(k); r.n++; r[c.pri] = (r[c.pri] || 0) + 1; r.last = c.id;
    cueIndex.push({ id: c.id, src: 'master', ref: c.ref, pri: c.pri, tag: c.tag, cat: `${c.cat} ${catName[k] || ''}`.trim(), text: c.text.slice(0, 140) });
  }
}
const masterPerRef = {};
for (const c of masterCues) masterPerRef[c.ref] = (masterPerRef[c.ref] || 0) + 1;
const tagCounts = {}; for (const c of masterCues) tagCounts[c.tag] = (tagCounts[c.tag] || 0) + 1;

// ---------- atlas ----------
const A = src.atlas.lines;
const assets = []; let curImg = null, cur = null; const imgTitle = {};
const famNames = {}, famText = {};
const RID = /^R(\d+)$/;
for (let i = 0; i < A.length; i++) {
  const l = A[i]; let m;
  if ((m = /^# IMAGE (\d\d)\s*[—-]\s*(.*)$/.exec(l))) { curImg = m[1]; imgTitle[curImg] = m[2].trim(); cur = null; continue; }
  if ((m = /^## (\d\d-A\d+)\s*[—-]\s*(.*)$/.exec(l))) {
    cur = { id: m[1], img: m[1].slice(0, 2), name: m[2].trim(), status: null, basis: '', stance: '', r: new Set(), bespoke: [] };
    assets.push(cur); continue;
  }
  if (!cur) continue;
  if ((m = /^- \*\*Status:\*\*\s*(.*)$/.exec(l))) { cur.status = m[1].trim(); continue; }
  if ((m = /^- \*\*Observed \/ inferred basis:\*\*\s*(.*)$/.exec(l))) { cur.basis = m[1].trim(); continue; }
  if ((m = /^- \*\*\[(\d\d-A\d+)-([A-Za-z0-9]+)\]\s*(.*?):\*\*\s*(.*)$/.exec(l))) {
    const suf = m[2]; const rm = RID.exec(suf); const n = rm ? +rm[1] : 0;
    const isR = rm && n >= 1 && n <= 55;
    if (isR) {
      cur.r.add(n);
      famNames[n] ??= {}; famNames[n][m[3]] = (famNames[n][m[3]] || 0) + 1;
      famText[n] ??= {}; famText[n][m[4].slice(0, 90)] = (famText[n][m[4].slice(0, 90)] || 0) + 1;
    } else cur.bespoke.push(`${suf}: ${m[3]}`);
    cueIndex.push({ id: `${m[1]}-${suf}`, src: 'atlas', asset: m[1], family: isR ? `R${String(n).padStart(2, '0')}` : 'bespoke', cat: m[3], text: m[4].slice(0, 140) });
  }
}
const mode = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
const rLines = assets.reduce((s, a) => s + a.r.size, 0);
const bespokeTotal = assets.reduce((s, a) => s + a.bespoke.length, 0);

// ---------- family table ----------
const P0F = new Set([3, 4, 5, 26, 29, 45]);
function famMeta(n, name, text) {
  const s = (name + ' ' + text).toLowerCase();
  const has = (...w) => w.some((x) => s.includes(x));
  let pri = 'P1';
  if (P0F.has(n)) pri = 'P0';
  else if (has('wear', 'weather', 'maintenance', 'dirt', 'grime', 'stain', 'aging', 'patina', 'dust', 'scuff', 'fingerprint', 'smudge')) pri = 'P2';
  else if (has('temporal', 'audio', 'compress', 'qa ', 'quality', 'flicker', 'motion', 'noise', 'banding', 'codec', 'sound', 'vibration')) pri = 'P3';
  let method = 'realtime';
  if (has('hdri', 'probe', 'reflection capture', 'sky')) method = 'HDRI-probe';
  else if (has('lens', 'grain', 'bloom', 'halation', 'chromatic', 'vignette', 'depth of field', 'flare', 'compress', 'exposure', 'grade', 'atmos', 'haze', 'fog')) method = 'post';
  else if (has('bake', 'baked', 'lightmap', 'ambient occlusion', 'occlusion', 'bounce', 'shadow hierarchy')) method = 'blender-bake';
  else if (has('decal', 'wear', 'dirt', 'stain', 'grime', 'edge realism', 'microgeometry', 'roughness', 'specular')) method = 'PBR-decal';
  else if (has('projection', 'projected')) method = 'projection';
  else if (has('parallax', 'billboard', '2.5d', 'card', 'impostor')) method = '2.5D';
  const cond = /^N\/A/i.test(text.trim());
  return { pri, method, cond };
}
const fams = [];
for (let n = 1; n <= 55; n++) {
  const name = mode(famNames[n]) || '(not found)'; const text = mode(famText[n]);
  const meta = famMeta(n, name, text);
  const id = `R${String(n).padStart(2, '0')}`;
  const st = firstStatus([['family', id]], 'family');
  const present = assets.filter((a) => a.r.has(n)).length;
  fams.push({ id, n, name, text, ...meta, present, st });
}

// ---------- asset heuristics ----------
function assetPri(a) {
  const s = `${a.name} ${a.basis}`.toLowerCase();
  const w = (re) => re.test(s);
  if (w(/camera|silhouette|geometry|horizon|sky|sun|truck|tractor|trailer|road surface|asphalt|carriageway|motorway|warehouse (building|facade|shell)|facade|building|canopy|overpass|bridge|light progression|key light|sunlight|street ?lamp|lamp ?post|luminaire|floodlight|wall ?pack|dock (door|leveller|leveler|bay)|loading bay|bay door/)) return 'P0';
  if (w(/dirt|grime|stain|wear|clutter|litter|debris|scuff|puddle|crack|patch|weed|rust|graffiti|sticker|label|sign(age)?\b|bolt|rivet|cable|hardware|marking|paint|tyre mark|skid/)) return 'P2';
  if (w(/guardrail|fence|fixture|glass|window|glazing|vegetation|tree|poplar|cypress|hedge|grass|field|crop|maize|verge|kerb|curb|pallet|forklift|container|silo|pole|mast|barrier|door|shutter|gate|roof|pipe|vent|mirror|wheel|tyre|curtain/)) return 'P1';
  return 'P1';
}
function assetMethod(a) {
  const s = `${a.name} ${a.basis}`.toLowerCase(); const w = (re) => re.test(s);
  if (w(/sky|hdri|cloud|sun\b|light progression|horizon/)) return 'HDRI-probe';
  if (w(/haze|fog|mist|atmos|lens|grade|grain|flare|bloom/)) return 'post';
  if (w(/field|farmland|hill|distant|far |skyline|backdrop|town|billboard|treeline|tree line/)) return '2.5D';
  if (w(/stain|dirt|grime|wear|marking|paint|decal|sticker|label|sign|crack|patch|puddle|tyre mark|skid|graffiti|clutter/)) return 'PBR-decal';
  if (w(/asphalt|concrete|road|apron|tarmac|surface|gravel|soil/)) return 'blender-bake';
  if (w(/light|lamp|luminaire|fixture|glass|window|glazing|reflection|mirror/)) return 'realtime';
  if (w(/projection|projected/)) return 'projection';
  return 'realtime';
}

// ---------- forensics ----------
const F = src.forensics.lines; const forRows = []; let fSec = null, fTitle = '', fIdx = 0; let inHeader = false;
const STAT = /^(OBSERVED(?:\s*\/\s*(?:LIKELY|INFERRED))?|INFERRED|LIKELY|RECOMMENDED|LOCKED|OBSERVED target)$/i;
for (const l of F) {
  let m;
  if ((m = /^# (\d+)\.\s*(.*)$/.exec(l))) { fSec = +m[1]; fTitle = m[2].trim(); fIdx = 0; continue; }
  if (fSec != null && (m = /^\s*[-*]\s+(.*\S)\s*$/.exec(l)) && !l.startsWith('|')) {
    // Bullet-list cue (sections 4-34 are bullet lists, not tables).
    fIdx++;
    const text = m[1].replace(/\*\*/g, '');
    const tag = /(OBSERVED\s*\/\s*LIKELY|OBSERVED|INFERRED|RECOMMENDED|LOCKED|REQUIRED)/.exec(text);
    const id = `FOR-${fSec}-${fIdx}`;
    const ev = tag ? tag[1] : 'RECOMMENDED';
    forRows.push({ id, sec: fSec, title: fTitle, asset: text, ev, impl: 'see section', all: [text] });
    cueIndex.push({ id, src: 'forensics', section: fSec, cat: fTitle, ev, text: text.slice(0, 140) });
    continue;
  }
  if (fSec == null || !l.startsWith('|')) continue;
  const cells = l.replace(/^\||\|\s*$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
  if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
  if (cells.some((c) => /^(status)$/i.test(c))) continue; // header
  fIdx++;
  const si = cells.findIndex((c, i) => i > 0 && STAT.test(c));
  const status = si >= 0 ? cells[si] : (cells[1] || '');
  const rest = cells.filter((_, i) => i !== 0 && i !== si);
  const id = `FOR-${fSec}-${fIdx}`;
  forRows.push({ id, sec: fSec, title: fTitle, asset: cells[0], ev: status, impl: rest[rest.length - 1] || '', all: cells });
  cueIndex.push({ id, src: 'forensics', section: fSec, cat: fTitle, ev: status, text: cells.join(' | ').slice(0, 140) });
}

// ---------- Untitled ----------
const U = src.untitled.lines; const utShots = {}; let uShot = null; const utRows = [];
let uMode = null, ddSec = 0, ddName = '', ddIdx = 0; const ddRows = []; const decisions = [];
for (let i = 0; i < U.length; i++) {
  const l = U[i]; let m;
  if ((m = /^## Shot (\d\d)\b/.exec(l))) { uShot = m[1]; uMode = 'shot'; utShots[uShot] ??= { title: l.replace(/^## /, ''), Observed: 0, Inferred: 0, Dont: 0, other: 0, n: 0 }; continue; }
  if (/^# Asset deep-dive/.test(l)) { uMode = 'dd'; uShot = null; continue; }
  if (/^## /.test(l)) { if (uMode === 'dd') { ddSec++; ddName = l.replace(/^## /, '').trim(); ddIdx = 0; } else uMode = null; continue; }
  if ((m = /^\d+\.\s+(.*)$/.exec(l)) && /Decisions needed/.test(U.slice(Math.max(0, i - 4), i).join('\n') + (decisions.length ? 'Decisions needed' : ''))) { decisions.push(m[1].trim()); continue; }
  if (!l.startsWith('|')) continue;
  const cells = l.replace(/^\||\|\s*$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
  if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
  if (uMode === 'shot' && uShot) {
    if (!/^\d+$/.test(cells[0]) || cells.length < 4) continue;
    const n = +cells[0]; const tag = cells[cells.length - 1]; const s = utShots[uShot]; s.n++;
    if (/do not copy/i.test(tag)) s.Dont++; else if (/^observed/i.test(tag)) s.Observed++; else if (/^inferred/i.test(tag)) s.Inferred++; else s.other++;
    const row = { id: `UT-S${uShot}-${n}`, key: `S${uShot}-${n}`, shot: uShot, n, group: cells[1], cue: cells.slice(2, -1).join(' | '), tag };
    utRows.push(row);
    cueIndex.push({ id: row.id, src: 'untitled', shot: uShot, cat: row.group, tag, text: row.cue.slice(0, 140) });
  } else if (uMode === 'dd' && ddSec) {
    if (/^(asset|item|element|cue|category|#|check)\b/i.test(cells[0]) && ddIdx === 0 && !ddRows.some((r) => r.sec === ddSec && r.idx === 0)) { ddRows.push({ sec: ddSec, idx: 0 }); continue; }
    ddIdx++;
    const id = `UT-DD-${ddSec}-${ddIdx}`;
    ddRows.push({ sec: ddSec, idx: ddIdx, id, section: ddName, cells });
    cueIndex.push({ id, src: 'untitled-deepdive', section: ddName, tag: cells[cells.length - 1], text: cells.join(' | ').slice(0, 140) });
  }
}
// decisions list (robust)
{ decisions.length = 0; let on = false; for (const l of U) { if (/Decisions needed/i.test(l)) { on = true; continue; } if (on) { const m = /^(\d+)\.\s+(.*)$/.exec(l); if (m) decisions.push(m[2].trim()); else if (/^#/.test(l)) break; } } }
const ddReal = ddRows.filter((r) => r.id);

// ---------- write cue index ----------
fs.writeFileSync(path.join(OUT, 'ledger-cue-index.json'), '[\n' + cueIndex.map((c) => JSON.stringify(c)).join(',\n') + '\n]\n');

// ---------- markdown ----------
const out = [];
const P = (s = '') => out.push(s);
P('# BSR Photoreal Reconstruction — Implementation Ledger');
P();
P('> GENERATED by `scripts/build-cue-ledger.mjs`. Do not edit by hand. Edit `ledger-status.json` (status/evidence/files/notes) and re-run `node scripts/build-cue-ledger.mjs`.');
P('> Every parsed cue is traceable through `ledger-cue-index.json` (id, source, ref/asset, priority, category, first 140 chars).');
P('> Status values: TODO | IN_PROGRESS | IMPLEMENTED | VALIDATED | BLOCKED | N/A.');
P();
// A
P('## A. Source inventory');
P();
P('| File | Bytes | Lines | What it is | Parsed |');
P('|---|---:|---:|---|---|');
P(`| ${src.ctrl.name} | ${src.ctrl.bytes} | ${src.ctrl.lines.length} | Controller prompt (rules; not per-cue) | not parsed |`);
P(`| ${src.master.name} | ${src.master.bytes} | ${src.master.lines.length} | Master reconstruction prompt, refs 00..08 | ${masterCues.length} cues in ${Object.keys(masterPerRef).length} refs, ${catRows.size} categories |`);
P(`| ${src.atlas.name} | ${src.atlas.bytes} | ${src.atlas.lines.length} | Per-image per-asset atlas | ${assets.length} assets, ${rLines} R-family lines, ${bespokeTotal} bespoke lines |`);
P(`| ${src.forensics.name} | ${src.forensics.bytes} | ${src.forensics.lines.length} | Real-world forensics pack | ${forRows.length} table rows in ${new Set(forRows.map((r) => r.sec)).size} sections |`);
P(`| ${src.untitled.name} | ${src.untitled.bytes} | ${src.untitled.lines.length} | Reference Cue Spec Sheet | ${utRows.length} shot cues, ${ddReal.length} deep-dive rows, ${decisions.length} decisions |`);
P();
P('Files named "(1)" are byte-identical duplicates and are ignored.');
P();
P(`- Master cues per reference: ${Object.entries(masterPerRef).map(([r, n]) => `${r}=${n}`).join(', ')}. Total ${masterCues.length} (expected 2880: ${masterCues.length === 2880 ? 'OK' : 'MISMATCH'}). Cue-looking lines that failed the regex: ${looseMaster}.`);
const off = Object.entries(masterPerRef).filter(([, n]) => n !== 320);
P(`- Master refs with count != 320: ${off.length ? off.map(([r, n]) => `${r}(${n})`).join(', ') : 'none'}.`);
P(`- Master implementation tags: ${Object.entries(tagCounts).map(([t, n]) => `[${t}] ${n}`).join(', ')}.`);
P(`- Atlas: ${assets.length} assets; expected R-lines ${assets.length * 55}, found ${rLines}; assets without Status line: ${assets.filter((a) => !a.status).map((a) => a.id).join(', ') || 'none'}; assets with incomplete R01..R55: ${assets.filter((a) => a.r.size !== 55).map((a) => `${a.id}(${a.r.size})`).join(', ') || 'none'}.`);
P(`- Atlas images: ${Object.entries(imgTitle).map(([k, v]) => `${k} ${clip(v, 40)}`).join('; ')}.`);
P();
// B
P('## B. R-family table (R01..R55, apply to every atlas asset)');
P();
P('Priority guess: P0 = R03/R04/R05/R26/R29/R45; P2 = wear/weathering/maintenance wording; P3 = temporal/audio/compression/QA wording; otherwise P1. Kind: conditional if the cue text starts with "N/A". Default applicability: universal = applies to every asset; conditional = N/A unless the asset has the named trait (keep N/A with reason in notes).');
P();
P('| ID | Name | Pri | Kind | Default applicability | Method | Status | Assets w/ line | Evidence | Notes |');
P('|---|---|---|---|---|---|---|---:|---|---|');
for (const f of fams) {
  const rule = f.cond ? clip(f.text, 70) : 'applies to every asset';
  P(`| ${f.id} | ${clip(f.name, 40)} | ${f.pri} | ${f.cond ? 'conditional' : 'universal'} | ${rule} | ${f.method} | ${f.st.status} | ${f.present} | ${clip(f.st.e?.evidence, 60)} | ${clip(f.st.e?.notes, 60)} |`);
}
P();
// C
P('## C. Per-asset table');
P();
P('Priority heuristic (keyword on asset name + basis): P0 = camera/silhouette/geometry/horizon/sky/sun/truck/trailer/road surface/asphalt/building/facade/canopy/overpass/street lamp/wall pack/dock door items; P2 = dirt/grime/stain/wear/clutter/litter/cracks/patches/markings/labels/hardware/cables; P1 = other secondary infrastructure, fixtures, glass, vegetation, fences, guardrails, wheels; default P1. Method heuristic: sky/horizon -> HDRI-probe; haze/lens -> post; far fields/hills/backdrops -> 2.5D; stains/markings/decals -> PBR-decal; asphalt/concrete/ground surfaces -> blender-bake; lights/glass -> realtime; default realtime. Status = asset:<id> else scene:<NN> else default TODO. Column "R" = R01..R55 lines present (55/55 is complete).');
P();
P('| ID | Scene | Asset | Evidence | Pri | Method | Repo files | Status | Validation evidence | R | Bespoke / notes |');
P('|---|---|---|---|---|---|---|---|---|---:|---|');
const assetStat = {};
for (const a of assets) {
  const st = firstStatus([['asset', a.id], ['scene', a.img]], 'asset');
  a.pri = assetPri(a); a.method = assetMethod(a); a.st = st.status; assetStat[a.id] = st.status;
  const e = entry('asset', a.id);
  const sc = `${a.img} ${SCENES[+a.img] ?? '?'}`;
  P(`| ${a.id} | ${sc} | ${clip(a.name, 50)} | ${clip(a.status || 'MISSING', 25)} | ${a.pri} | ${a.method} | ${clip(e?.files, 60)} | ${st.status} | ${clip(e?.evidence, 60)} | ${a.r.size} | ${clip([a.bespoke.length ? 'bespoke: ' + a.bespoke.join('; ') : '', e?.notes].filter(Boolean).join(' / '), 120)} |`);
}
P();
// D
P('## D. Master-cue matrix');
P();
P('Status per category = cat:<ref>-<cat> else ref:<ref> else default TODO.');
P();
const refPri = {};
P('| Ref | Cat | Category | Cues | P0 | P1 | P2 | P3 | First..Last | Status |');
P('|---|---|---|---:|---:|---:|---:|---:|---|---|');
for (const r of catRows.values()) {
  const st = firstStatus([['cat', `${r.ref}-${r.cat}`], ['ref', r.ref]], 'cue').status;
  P(`| ${r.ref} | ${r.cat} | ${clip(r.name, 50)} | ${r.n} | ${r.P0} | ${r.P1} | ${r.P2} | ${r.P3} | ${r.first}..${r.last} | ${st} |`);
  const t = (refPri[r.ref] ??= { n: 0, P0: 0, P1: 0, P2: 0, P3: 0 }); t.n += r.n; for (const p of ['P0', 'P1', 'P2', 'P3']) t[p] += r[p];
}
P();
P('Priority totals per reference:');
P();
P('| Ref | Title | Cues | P0 | P1 | P2 | P3 |');
P('|---|---|---:|---:|---:|---:|---:|');
const tot = { n: 0, P0: 0, P1: 0, P2: 0, P3: 0 };
for (const [r, t] of Object.entries(refPri)) { P(`| ${r} | ${clip(refTitle[r], 50)} | ${t.n} | ${t.P0} | ${t.P1} | ${t.P2} | ${t.P3} |`); for (const k in tot) tot[k] += t[k]; }
P(`| all | | ${tot.n} | ${tot.P0} | ${tot.P1} | ${tot.P2} | ${tot.P3} |`);
P();
// E
P('## E. Forensics pack');
P();
P('Status = for:<section> (also for:<id> checked first) else default TODO.');
P();
P('| ID | Sec | Asset / cue | Evidence | Implementation | Status |');
P('|---|---:|---|---|---|---|');
const forStat = {};
for (const r of forRows) {
  const st = firstStatus([['for', r.id], ['for', String(r.sec)]], 'for').status; forStat[r.id] = st;
  P(`| ${r.id} | ${r.sec} | ${clip(r.asset, 60)} | ${clip(r.ev, 22)} | ${clip(r.impl, 60)} | ${st} |`);
}
P();
P(`Sections: ${[...new Set(forRows.map((r) => `${r.sec} ${clip(r.title, 30)}`))].join('; ')}.`);
P();
// F
P('## F. Untitled.md reference cue spec sheet');
P();
P('| Shot | Title | Cues | Observed | Inferred | Do not copy | Other |');
P('|---|---|---:|---:|---:|---:|---:|');
for (const [s, v] of Object.entries(utShots)) P(`| ${s} | ${clip(v.title, 50)} | ${v.n} | ${v.Observed} | ${v.Inferred} | ${v.Dont} | ${v.other} |`);
P();
P('Do-not-copy cues (decisions; status from ut:S<shot>-<n>):');
P();
P('| ID | Group | Cue | Status |');
P('|---|---|---|---|');
const utStat = {};
for (const r of utRows) {
  const st = firstStatus([['ut', r.key]], 'ut').status; utStat[r.id] = st;
  if (/do not copy/i.test(r.tag)) P(`| ${r.id} | ${clip(r.group, 20)} | ${clip(r.cue, 110)} | ${st} |`);
}
P();
P('Decisions needed (status/decision from decision:<n>):');
P();
P('| # | Decision | Recorded decision | Status |');
P('|---|---|---|---|');
decisions.forEach((d, i) => { const e = entry('decision', String(i + 1)); P(`| ${i + 1} | ${clip(d, 130)} | ${clip(e?.notes || e?.evidence, 80)} | ${norm(e?.status || dflt('decision'))} |`); });
P();
P(`Asset deep-dive rows parsed: ${ddReal.length} (ids UT-DD-<section>-<row>; sections: ${[...new Set(ddReal.map((r) => `${r.sec} ${r.section}`))].join('; ')}). All in ledger-cue-index.json.`);
P();
// G
P('## G. Status roll-up');
P();
const count = (arr) => { const o = Object.fromEntries(STATUSES.map((s) => [s, 0])); arr.forEach((s) => o[s]++); return o; };
const rowFor = (label, o) => `| ${label} | ${STATUSES.map((s) => o[s]).join(' | ')} | ${Object.values(o).reduce((a, b) => a + b, 0)} |`;
const famC = count(fams.map((f) => f.st.status));
const assetC = count(assets.map((a) => a.st));
const cueSt = masterCues.map((c) => ({ ...c, st: cueStatus(c.id, c.ref, c.cat) }));
const cueC = count(cueSt.map((c) => c.st));
const forC = count(forRows.map((r) => forStat[r.id]));
const utC = count(utRows.filter((r) => true).map((r) => utStat[r.id]));
P(`| Kind | ${STATUSES.join(' | ')} | Total |`);
P(`|---|${STATUSES.map(() => '---:').join('|')}|---:|`);
P(rowFor('R-families', famC)); P(rowFor('Atlas assets', assetC)); P(rowFor('Master cues', cueC)); P(rowFor('Forensics rows', forC)); P(rowFor('Untitled shot cues', utC));
P();
P('Per-priority breakdown:');
P();
P(`| Kind | Pri | ${STATUSES.join(' | ')} | Total | Applicable (excl. N/A) |`);
P(`|---|---|${STATUSES.map(() => '---:').join('|')}|---:|---:|`);
const byPri = (label, items) => { for (const p of ['P0', 'P1', 'P2', 'P3']) { const o = count(items.filter((x) => x.pri === p).map((x) => x.st)); const t = Object.values(o).reduce((a, b) => a + b, 0); P(`| ${label} | ${p} | ${STATUSES.map((s) => o[s]).join(' | ')} | ${t} | ${t - o['N/A']} |`); } };
byPri('Master cues', cueSt); byPri('Atlas assets', assets); byPri('R-families', fams.map((f) => ({ pri: f.pri, st: f.st.status })));
P();
const applic = (o) => Object.values(o).reduce((a, b) => a + b, 0) - o['N/A'];
P('Headline numbers (master cues):');
P();
P(`- Applicable: ${applic(cueC)} | Implemented: ${cueC.IMPLEMENTED} | Validated: ${cueC.VALIDATED} | In progress: ${cueC.IN_PROGRESS} | N/A: ${cueC['N/A']} | Blocked: ${cueC.BLOCKED} | TODO: ${cueC.TODO}`);
P(`- Atlas assets: applicable ${applic(assetC)}, implemented ${assetC.IMPLEMENTED}, validated ${assetC.VALIDATED}, N/A ${assetC['N/A']}, blocked ${assetC.BLOCKED}`);
P(`- R-families: applicable ${applic(famC)}, implemented ${famC.IMPLEMENTED}, validated ${famC.VALIDATED}, N/A ${famC['N/A']}, blocked ${famC.BLOCKED}`);
P(`- Atlas R-cue lines are covered by family x asset (${rLines} lines): tracked through family:Rxx and asset:<id> statuses, not counted separately.`);
P();
fs.writeFileSync(path.join(OUT, 'implementation-ledger.md'), out.join('\n') + '\n');

console.log(JSON.stringify({
  master: { total: masterCues.length, perRef: masterPerRef, categories: catRows.size, tags: tagCounts, unparsedLooseLines: looseMaster },
  atlas: { assets: assets.length, rLines, bespoke: bespokeTotal, noStatus: assets.filter((a) => !a.status).length, incomplete: assets.filter((a) => a.r.size !== 55).length },
  forensics: { rows: forRows.length, sections: new Set(forRows.map((r) => r.sec)).size },
  untitled: { shotCues: utRows.length, perShot: Object.fromEntries(Object.entries(utShots).map(([k, v]) => [k, v.n])), deepDive: ddReal.length, decisions: decisions.length },
  index: cueIndex.length, mdLines: out.length, statusJsonCreated: createdStatus,
}, null, 1));
