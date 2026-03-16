#!/usr/bin/env node
/**
 * Audit imported notes: compare .enex source vs Supabase DB records.
 * Usage: node scripts/audit-import.mjs <file.enex>
 */

import { readFileSync, existsSync, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_FILE = `${__dirname}/.import-manifest.json`;

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const enexFile = process.argv[2];
if (!enexFile) {
  console.error('Usage: node audit-import.mjs <file.enex>');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadManifest() {
  if (!existsSync(MANIFEST_FILE)) return {};
  try { return JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')); } catch { return {}; }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseEnDate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).toISOString();
}

async function streamNoteBlocks(filePath) {
  return new Promise((resolve, reject) => {
    const blocks = [];
    let buf = '';
    let inNote = false;
    const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 256 * 1024 });
    stream.on('data', chunk => {
      buf += chunk;
      while (true) {
        if (!inNote) {
          const s = buf.indexOf('<note>');
          if (s === -1) { buf = buf.slice(-10); break; }
          inNote = true;
          buf = buf.slice(s);
        }
        const e = buf.indexOf('</note>');
        if (e === -1) break;
        blocks.push(buf.slice(0, e + 7));
        buf = buf.slice(e + 7);
        inNote = false;
      }
    });
    stream.on('end', () => resolve(blocks));
    stream.on('error', reject);
  });
}

function extractMeta(block) {
  const titleMatch  = block.match(/<title>([\s\S]*?)<\/title>/);
  const createdMatch = block.match(/<created>(.*?)<\/created>/);
  const updatedMatch = block.match(/<updated>(.*?)<\/updated>/);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '(untitled)';
  const created = createdMatch ? createdMatch[1].trim() : '';
  const updated = updatedMatch ? updatedMatch[1].trim() : '';
  const key = `${title}::${created}`;
  return { title, created, updated, key };
}

function countImages(block) {
  return (block.match(/<en-media/g) || []).length;
}

function countTables(block) {
  return (block.match(/<table[\s>]/gi) || []).length;
}

function countTiptapTables(tiptap) {
  let count = 0;
  const walk = (nodes) => { for (const n of (nodes || [])) { if (n.type === 'table') count++; if (n.content) walk(n.content); } };
  walk(tiptap?.content);
  return count;
}

function extractPlainText(block) {
  // Strip everything except en-note content, remove all tags, decode entities
  const enmlMatch = block.match(/<content>([\s\S]*?)<\/content>/);
  if (!enmlMatch) return '';
  // Remove CDATA wrappers
  let content = enmlMatch[1].replace(/<!\[CDATA\[/, '').replace(/\]\]>/, '');
  // Remove all HTML tags
  content = content.replace(/<[^>]+>/g, ' ');
  // Decode entities
  content = decodeHtmlEntities(content);
  // Normalize whitespace
  return content.replace(/\s+/g, ' ').trim();
}

function extractResourceSizes(block) {
  const sizes = [];
  for (const res of block.matchAll(/<resource>([\s\S]*?)<\/resource>/g)) {
    const dataMatch = res[1].match(/<data[^>]*>([\s\S]*?)<\/data>/);
    const mimeMatch = res[1].match(/<mime>(.*?)<\/mime>/);
    if (dataMatch) {
      const bytes = Math.round(dataMatch[1].replace(/\s/g, '').length * 0.75);
      sizes.push({ mime: mimeMatch?.[1].trim() || 'unknown', bytes });
    }
  }
  return sizes;
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

function fmtBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function countTiptapImages(tiptap) {
  if (!tiptap) return 0;
  let count = 0;
  const walk = (nodes) => {
    for (const n of (nodes || [])) {
      if (n.type === 'image') count++;
      if (n.content) walk(n.content);
    }
  };
  walk(tiptap.content);
  return count;
}

function countTiptapBlocks(tiptap) {
  return (tiptap?.content || []).length;
}

function tiptapPlainText(tiptap) {
  const parts = [];
  const walk = (nodes) => {
    for (const n of (nodes || [])) {
      if (n.type === 'text') parts.push(n.text || '');
      if (n.content) walk(n.content);
    }
  };
  walk(tiptap?.content || []);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const manifest = loadManifest();
  const manifestKeys = Object.keys(manifest);
  console.log(`\n📋 Manifest: ${manifestKeys.length} imported notes\n`);

  console.log('⏳ Streaming .enex blocks...');
  const blocks = await streamNoteBlocks(enexFile);
  console.log(`   Found ${blocks.length} notes in .enex\n`);

  // Build enex lookup by key
  const enexByKey = {};
  for (const block of blocks) {
    const meta = extractMeta(block);
    enexByKey[meta.key] = { ...meta, block };
  }

  // Fetch all imported DB records in batches
  console.log('⏳ Fetching DB records...');
  const dbIds = manifestKeys.map(k => manifest[k].id).filter(Boolean);

  // Fetch in chunks of 100
  const dbNotes = [];
  for (let i = 0; i < dbIds.length; i += 100) {
    const chunk = dbIds.slice(i, i + 100);
    const rows = await sbFetch(`/notes?id=in.(${chunk.join(',')})&select=id,title,content,folder_name,folder_color,created_at,updated_at`);
    dbNotes.push(...rows);
  }
  const dbById = {};
  for (const row of dbNotes) dbById[row.id] = row;
  console.log(`   Fetched ${dbNotes.length} DB records\n`);

  // ── Compare ────────────────────────────────────────────────────────────────
  const issues = [];
  const stats = {
    total: manifestKeys.length,
    titleMismatch: 0,
    missingInEnex: 0,
    imagesStripped: 0,
    sizeDiff: 0,
    textLengthDiff: 0,
    timestampMismatch: 0,
    ok: 0,
  };

  console.log('═'.repeat(80));
  console.log('AUDIT RESULTS');
  console.log('═'.repeat(80));

  for (const key of manifestKeys) {
    const entry = manifest[key];
    const dbRow  = dbById[entry.id];
    const enex   = enexByKey[key];

    const noteIssues = [];

    if (!dbRow) {
      issues.push({ key, issue: '❌ DB record MISSING', entry });
      stats.missingInEnex++;
      continue;
    }

    if (!enex) {
      noteIssues.push('⚠️  Key not found in .enex (title may have changed?)');
      stats.missingInEnex++;
    }

    // Parse DB tiptap
    let tiptap = null;
    try { tiptap = JSON.parse(dbRow.content); } catch {}

    // Title check
    if (enex && dbRow.title !== enex.title) {
      noteIssues.push(`  TITLE: enex="${enex.title}" db="${dbRow.title}"`);
      stats.titleMismatch++;
    }

    // Image count
    const enexImages = enex ? countImages(enex.block) : 0;
    const dbImages   = countTiptapImages(tiptap);
    const stripped   = entry.imagesStripped;

    if (enexImages > 0 && dbImages === 0 && stripped) {
      noteIssues.push(`  IMAGES STRIPPED: had ${enexImages} image(s) — too large for tsvector`);
      stats.imagesStripped++;
    } else if (enexImages !== dbImages && !stripped) {
      noteIssues.push(`  IMAGE COUNT: enex=${enexImages} db=${dbImages}`);
      stats.imagesStripped++;
    }

    // Table count
    const enexTables = enex ? countTables(enex.block) : 0;
    const dbTables   = countTiptapTables(tiptap);
    if (enexTables !== dbTables) {
      noteIssues.push(`  TABLES: enex=${enexTables} db=${dbTables}`);
      stats.tableMismatch = (stats.tableMismatch || 0) + 1;
    }

    // Block count
    const dbBlocks = countTiptapBlocks(tiptap);

    // Text content comparison
    if (enex) {
      const enexText = extractPlainText(enex.block);
      const dbText   = tiptapPlainText(tiptap);
      const enexLen  = enexText.length;
      const dbLen    = dbText.length;
      const diff     = Math.abs(enexLen - dbLen);
      const pct      = enexLen > 0 ? Math.round((diff / enexLen) * 100) : 0;

      // Flag if text length differs by more than 20% (and at least 50 chars)
      if (pct > 20 && diff > 50) {
        noteIssues.push(`  TEXT LENGTH: enex=${enexLen} chars, db=${dbLen} chars (${pct}% diff)`);
        stats.textLengthDiff++;
      }

      // Resource sizes (original)
      const resources = extractResourceSizes(enex.block);
      const totalResourceBytes = resources.reduce((s, r) => s + r.bytes, 0);

      // DB content size
      const dbContentBytes = new TextEncoder().encode(dbRow.content).length;

      // Report sizes
      const resourceStr = totalResourceBytes > 0 ? ` | enex-resources=${fmtBytes(totalResourceBytes)}` : '';
      const sizeInfo = `  SIZE: db-content=${fmtBytes(dbContentBytes)}${resourceStr} | blocks=${dbBlocks}`;

      // Timestamp check
      const enexCreated = parseEnDate(enex.created);
      const enexUpdated = parseEnDate(enex.updated);
      const dbCreated   = dbRow.created_at ? new Date(dbRow.created_at).toISOString() : null;
      const dbUpdated   = dbRow.updated_at ? new Date(dbRow.updated_at).toISOString() : null;

      const createdMatch = enexCreated && dbCreated && enexCreated.slice(0, 10) === dbCreated.slice(0, 10);
      const updatedMatch = enexUpdated && dbUpdated && enexUpdated.slice(0, 10) === dbUpdated.slice(0, 10);

      if (!createdMatch || !updatedMatch) {
        noteIssues.push(`  TIMESTAMPS: enex-created=${enexCreated?.slice(0,10)} db=${dbCreated?.slice(0,10)} | enex-updated=${enexUpdated?.slice(0,10)} db=${dbUpdated?.slice(0,10)}`);
        stats.timestampMismatch++;
      }

      if (noteIssues.length === 0) {
        stats.ok++;
        // Only print OK notes briefly
        console.log(`✅ ${dbRow.title.padEnd(45).slice(0, 45)} | ${fmtBytes(dbContentBytes).padStart(8)} | ${String(dbBlocks).padStart(3)} blocks | ${enexImages > 0 ? `${enexImages} img` : '      '} | ${dbRow.updated_at?.slice(0, 10) || '?'}`);
      } else {
        console.log(`\n⚠️  ${dbRow.title}`);
        noteIssues.forEach(i => console.log(i));
        console.log(sizeInfo);
        console.log('');
        issues.push({ key, issues: noteIssues, dbRow, enex });
      }
    } else {
      if (noteIssues.length === 0) {
        stats.ok++;
        console.log(`✅ ${dbRow.title.padEnd(45).slice(0, 45)} | ${fmtBytes(new TextEncoder().encode(dbRow.content).length).padStart(8)} | ${String(dbBlocks).padStart(3)} blocks`);
      } else {
        console.log(`\n⚠️  ${dbRow.title}`);
        noteIssues.forEach(i => console.log(i));
        issues.push({ key, issues: noteIssues, dbRow });
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total imported  : ${stats.total}`);
  console.log(`✅ Clean        : ${stats.ok}`);
  console.log(`⚠️  Issues total : ${stats.total - stats.ok}`);
  console.log('');
  if (stats.tableMismatch > 0)    console.log(`  📊 Table count mismatches           : ${stats.tableMismatch}`);
  if (stats.imagesStripped > 0)   console.log(`  🖼  Images stripped (tsvector limit) : ${stats.imagesStripped}`);
  if (stats.titleMismatch > 0)    console.log(`  📝 Title mismatches                 : ${stats.titleMismatch}`);
  if (stats.textLengthDiff > 0)   console.log(`  📏 Text length diffs >20%           : ${stats.textLengthDiff}`);
  if (stats.timestampMismatch > 0) console.log(`  🕐 Timestamp mismatches             : ${stats.timestampMismatch}`);
  if (stats.missingInEnex > 0)    console.log(`  ❓ Key not in .enex                 : ${stats.missingInEnex}`);
  console.log('');
  console.log(`Peace of mind score: ${Math.round((stats.ok / stats.total) * 100)}% clean`);
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
