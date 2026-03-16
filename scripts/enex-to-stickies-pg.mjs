#!/usr/bin/env node
/**
 * Evernote .enex → Stickies importer  (Linode pg variant)
 * Structure: INTEGRATIONS → EVERNOTE → $notebook → $note
 * Uses DATABASE_URL (Linode bheng_local) — no Supabase quota
 */
// Allow Pusher HTTPS on macOS where system certs aren't in Node's bundle
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs';
import { basename, dirname, join } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pg from 'pg';
import Pusher from 'pusher';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_FILE = `${__dirname}/.import-manifest.json`;

// Load .env.local
const envPath = join(__dirname, '../.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

// pg pool
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const db    = (sql, p) => pool.query(sql, p).then(r => r.rows);
const dbOne = (sql, p) => pool.query(sql, p).then(r => r.rows[0] ?? null);

function loadManifest() {
  if (!existsSync(MANIFEST_FILE)) return {};
  try { return JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')); } catch { return {}; }
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

const BRIGHT_COLORS = [
  '#FF3B30', '#FF6B4E', '#FF9500', '#FFCC00',
  '#D4E157', '#34C759', '#00C7BE', '#32ADE6',
  '#007AFF', '#5856D6', '#AF52DE', '#FF2D55',
];
const randomColor = () => BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];

const PUSHER = {
  appId:   process.env.PUSHER_APP_ID,
  key:     process.env.PUSHER_KEY,
  secret:  process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || 'us2',
};

if (!process.env.DATABASE_URL) { console.error('Missing DATABASE_URL env var'); process.exit(1); }

const enexFile = process.argv[2];
const notebook = process.argv[3];
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

if (!enexFile || !notebook) {
  console.error('Usage: node enex-to-stickies.mjs <file.enex> <NotebookName> [--limit=N]');
  process.exit(1);
}

// ── Stream-parse .enex → note blocks ─────────────────────────────────────────
async function streamNoteBlocks(filePath) {
  return new Promise((resolve, reject) => {
    const blocks = [];
    let buf = '';
    let inNote = false;
    let noteStart = '';
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

// ── Parse resources (images) — keyed by MD5 hex hash of binary data ──────────
function parseResources(xml) {
  const resources = {};
  for (const res of xml.matchAll(/<resource>([\s\S]*?)<\/resource>/g)) {
    const body = res[1];
    const dataMatch = body.match(/<data[^>]*>([\s\S]*?)<\/data>/);
    const mimeMatch = body.match(/<mime>(.*?)<\/mime>/);
    if (!dataMatch || !mimeMatch) continue;
    const b64 = dataMatch[1].replace(/\s/g, '');
    const mime = mimeMatch[1].trim();
    // Compute MD5 of the binary so we can match <en-media hash="...">
    const binary = Buffer.from(b64, 'base64');
    const md5 = createHash('md5').update(binary).digest('hex');
    const filenameMatch = body.match(/<file-name>(.*?)<\/file-name>/);
    const filename = filenameMatch ? filenameMatch[1].trim() : null;
    resources[md5] = { mime, b64, filename };
  }
  return resources;
}

// ── Pre-process: replace --en-codeblock divs (nested) with <pre> ─────────────
function flattenCodeBlocks(html) {
  let result = '';
  let i = 0;
  while (i < html.length) {
    const divStart = html.indexOf('<div', i);
    if (divStart === -1) { result += html.slice(i); break; }
    const tagEnd = html.indexOf('>', divStart);
    if (tagEnd === -1) { result += html.slice(i); break; }
    const openTag = html.slice(divStart, tagEnd + 1);
    if (openTag.includes('--en-codeblock') || openTag.includes('en-codeblock:true')) {
      // Walk forward to find the matching </div> accounting for nesting
      let depth = 1;
      let j = tagEnd + 1;
      while (j < html.length && depth > 0) {
        const nOpen = html.indexOf('<div', j);
        const nClose = html.indexOf('</div>', j);
        if (nClose === -1) break;
        if (nOpen !== -1 && nOpen < nClose) { depth++; j = nOpen + 4; }
        else {
          depth--;
          if (depth === 0) {
            const innerHtml = html.slice(tagEnd + 1, nClose);
            const codeText = innerHtml
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/div>/gi, '\n')
              .replace(/<div[^>]*>/gi, '')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
              .replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '');
            result += html.slice(i, divStart) + `<pre>${codeText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
            i = nClose + 6;
            break;
          }
          j = nClose + 6;
        }
      }
      if (depth !== 0) { result += html.slice(i, tagEnd + 1); i = tagEnd + 1; }
    } else {
      result += html.slice(i, tagEnd + 1); i = tagEnd + 1;
    }
  }
  return result;
}

// ── Convert ENML content to TipTap JSON ──────────────────────────────────────
async function enmlToTiptap(enml, resources) {
  const inner = flattenCodeBlocks(
    enml.replace(/^[\s\S]*?<en-note[^>]*>/, '').replace(/<\/en-note>[\s\S]*$/, '')
  );
  const content = [];
  await parseNodes(inner, content, resources);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

async function parseNodes(html, out, resources) {
  // Strip hidden Evernote metadata div
  html = html.replace(/<div[^>]*display:none[^>]*>[\s\S]*?<\/div>/gi, '');

  // Split on block-level tags
  const blockRe = /<(h[1-6]|ul|ol|div|p|br\s*\/?)([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>|<en-media([^>]*)\/>/gi;

  let lastIndex = 0;
  let match;

  const processedBlocks = [];

  // Collect all block matches with positions
  const allMatches = [...html.matchAll(/<(table|h[1-6]|ul|ol|div|p|pre)([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>|<hr\s*\/?>|<en-media([^>]*)\/>/gi)];

  if (allMatches.length === 0) {
    // Pure inline content
    const inlineNodes = parseInline(html);
    if (inlineNodes.length) out.push({ type: 'paragraph', content: inlineNodes });
    return;
  }

  for (const m of allMatches) {
    const before = html.slice(lastIndex, m.index).trim();
    if (before) {
      const nodes = parseInline(before);
      if (nodes.length) out.push({ type: 'paragraph', content: nodes });
    }

    const tag = m[1]?.toLowerCase();
    const attrs = m[2] || m[4] || '';
    const inner = m[3] || '';

    if (!tag && m[0].match(/^<br/i)) {
      out.push({ type: 'paragraph' });
    } else if (!tag && m[0].match(/^<hr/i)) {
      out.push({ type: 'horizontalRule' });
    } else if (!tag && m[0].match(/^<en-media/i)) {
      const node = await parseEnMedia(attrs, resources);
      if (node) out.push(node);
    } else if (tag?.match(/^h[1-6]$/)) {
      const level = parseInt(tag[1]);
      const text = stripTags(inner).trim();
      if (text) out.push({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
    } else if (tag === 'ul') {
      out.push(await parseList(inner, 'bulletList', resources));
    } else if (tag === 'ol') {
      out.push(await parseList(inner, 'orderedList', resources));
    } else if (tag === 'pre') {
      const code = decodeHtmlEntities(inner);
      if (code.trim()) out.push({ type: 'codeBlock', attrs: { language: detectLanguage(code) }, content: [{ type: 'text', text: code }] });
    } else if (tag === 'table') {
      const tableNode = await parseTable(m[0], resources);
      if (tableNode) out.push(tableNode);
    } else if (tag === 'div' || tag === 'p') {
      if (attrs.includes('en-codeblock:true') || attrs.includes('--en-codeblock') || attrs.includes('font-family:') && attrs.includes('monospace')) {
        const code = decodeHtmlEntities(stripTags(inner));
        if (code.trim()) out.push({ type: 'codeBlock', attrs: { language: detectLanguage(code) }, content: [{ type: 'text', text: code }] });
      } else {
        const sub = [];
        await parseNodes(inner, sub, resources);
        out.push(...sub);
      }
    }

    lastIndex = m.index + m[0].length;
  }

  // Trailing text
  const trailing = html.slice(lastIndex).trim();
  if (trailing) {
    const nodes = parseInline(trailing);
    if (nodes.length) out.push({ type: 'paragraph', content: nodes });
  }
}

async function parseTable(tableHtml, resources) {
  const rows = [];
  let isFirstRow = true;

  for (const rowMatch of tableHtml.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[2];
    const cells = [];
    const cellRe = /<(td|th)([^>]*?)>([\s\S]*?)<\/\1>/gi;

    for (const cellMatch of rowHtml.matchAll(cellRe)) {
      const cellTag  = cellMatch[1].toLowerCase();
      const cellAttrs = cellMatch[2];
      const cellHtml  = cellMatch[3];

      const colspanMatch = cellAttrs.match(/colspan="?(\d+)"?/i);
      const rowspanMatch = cellAttrs.match(/rowspan="?(\d+)"?/i);
      const colspan = colspanMatch ? parseInt(colspanMatch[1]) : 1;
      const rowspan = rowspanMatch ? parseInt(rowspanMatch[1]) : 1;

      // Parse cell content — unwrap divs/p, preserve links/bold via parseInline
      // Split on block boundaries inside cell, parse each line as inline
      const cellLines = cellHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n')
        .split('\n');
      const cellContent = [];
      for (const line of cellLines) {
        // strip outer <div> or <p> open tags, keep inner content
        const inner = line.replace(/^<(div|p)[^>]*>/i, '').trim();
        if (!inner) continue;
        const inlineNodes = parseInline(inner);
        if (inlineNodes.length) cellContent.push({ type: 'paragraph', content: inlineNodes });
      }
      // Handle en-media inside cells (images)
      for (const mediaMatch of cellHtml.matchAll(/<en-media([^>]*)\/>/gi)) {
        const mediaNode = await parseEnMedia(mediaMatch[1], resources);
        if (mediaNode) cellContent.push(mediaNode);
      }
      if (cellContent.length === 0) cellContent.push({ type: 'paragraph' });

      const isHeader = cellTag === 'th' || isFirstRow;
      cells.push({
        type: isHeader ? 'tableHeader' : 'tableCell',
        attrs: { colspan, rowspan, colwidth: null },
        content: cellContent,
      });
    }

    if (cells.length > 0) {
      rows.push({ type: 'tableRow', content: cells });
      isFirstRow = false;
    }
  }

  if (rows.length === 0) return null;
  return { type: 'table', content: rows };
}

async function parseList(html, listType, resources) {
  const items = [];
  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripTags(m[1]).trim();
    if (text) items.push({
      type: 'listItem',
      content: [{ type: 'paragraph', content: parseInline(m[1]) }]
    });
  }
  return { type: listType, content: items };
}

// ── Read image dimensions from binary buffer ──────────────────────────────────
function getImageDimensions(buf, mime) {
  try {
    if (mime === 'image/png') {
      // PNG: width at bytes 16-19, height at 20-23
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      // JPEG: scan for SOF0/SOF2 markers (FF C0 / FF C2)
      let i = 2;
      while (i < buf.length - 8) {
        if (buf[i] !== 0xFF) break;
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker === 0xC0 || marker === 0xC2) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {}
  return null;
}

// ── Compress image buffer via sharp (max 1200px, JPEG 82%) ───────────────────
async function compressImage(buf, mime) {
  try {
    const img = sharp(buf).rotate(); // auto-rotate from EXIF
    const meta = await img.metadata();
    const MAX = 1200;
    if (meta.width > MAX || meta.height > MAX) {
      img.resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true });
    }
    const out = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    // Only use compressed if it's actually smaller
    if (out.length < buf.length) return { buf: out, mime: 'image/jpeg' };
  } catch (e) {
    // fall through — return original
  }
  return { buf, mime };
}

async function parseEnMedia(attrs, resources) {
  const typeMatch = attrs.match(/type="([^"]+)"/);
  const hashMatch = attrs.match(/hash="([^"]+)"/);
  if (!typeMatch) return null;

  const mime = typeMatch[1];

  const resource = hashMatch
    ? resources[hashMatch[1]]
    : Object.values(resources).find(r => r.mime === mime);

  if (!resource) return null;

  // ── Text/plain attachment → code block ────────────────────────────────────
  if (mime === 'text/plain' || mime === 'text/x-web-markdown') {
    const text = Buffer.from(resource.b64, 'base64').toString('utf8');
    const lang = detectLanguage(text);
    const header = resource.filename ? `// ${resource.filename}\n` : '';
    return {
      type: 'codeBlock',
      attrs: { language: lang },
      content: [{ type: 'text', text: header + text }],
    };
  }

  // ── Unsupported attachment → filename placeholder paragraph ─────────────────
  if (!mime.startsWith('image/')) {
    const name = resource.filename || mime;
    const bytes = Math.round(Buffer.from(resource.b64, 'base64').length);
    const kb = bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: `📎 ${name} (${kb})` }],
    };
  }

  const rawBuf = Buffer.from(resource.b64, 'base64');
  const { buf, mime: finalMime } = await compressImage(rawBuf, resource.mime);
  const finalB64 = buf.toString('base64');
  const dims = getImageDimensions(buf, finalMime);
  const attrs2 = {
    src: `data:${finalMime};base64,${finalB64}`,
    style: 'display:block;',
    ...(dims ? { width: dims.width, height: dims.height } : { style: 'max-width:100%;height:auto;display:block;' }),
  };
  return { type: 'image', attrs: attrs2 };
}

// ── Language detection ────────────────────────────────────────────────────────
function detectLanguage(code) {
  const c = code.trim();
  if (/^\s*\{[\s\S]*\}$/.test(c) || /^\s*\[/.test(c)) return 'json';
  if (/^#!.*\/(bash|sh)\b/.test(c) || /\bbash\s+-c\b/.test(c) || /^\s*(export |source |chmod |sudo |cd |echo |grep |awk |sed |curl |npm |node |git )/m.test(c)) return 'bash';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|FROM|WHERE|JOIN)\b/i.test(c)) return 'sql';
  if (/\b(def |import |print\(|from \w+ import|elif |lambda )/m.test(c)) return 'python';
  if (/\b(const |let |var |function |=>|require\(|module\.exports|console\.log)/m.test(c)) return 'javascript';
  if (/\b(interface |type |enum |readonly |as const|: string|: number|: boolean)/m.test(c)) return 'typescript';
  if (/^\s*[.#][\w-]+\s*\{/m.test(c) || /\b(margin|padding|color|font-size|display)\s*:/m.test(c)) return 'css';
  if (/^<[a-z]/im.test(c)) return 'html';
  return 'bash'; // default for shell-like content
}

function parseInline(html) {
  const nodes = [];
  // Handle bold, italic, underline, links
  const parts = html.split(/(<b[^>]*>[\s\S]*?<\/b>|<strong[^>]*>[\s\S]*?<\/strong>|<i[^>]*>[\s\S]*?<\/i>|<em[^>]*>[\s\S]*?<\/em>|<u[^>]*>[\s\S]*?<\/u>|<a[^>]*>[\s\S]*?<\/a>|<span[^>]*>[\s\S]*?<\/span>)/gi);

  for (const part of parts) {
    if (!part) continue;
    const text = decodeHtmlEntities(stripTags(part));
    if (!text) continue;

    const marks = [];
    if (part.match(/^<(b|strong)/i)) marks.push({ type: 'bold' });
    if (part.match(/^<(i|em)/i)) marks.push({ type: 'italic' });
    if (part.match(/^<u/i)) marks.push({ type: 'underline' });

    const linkMatch = part.match(/^<a[^>]*href="([^"]+)"/i);
    if (linkMatch) marks.push({ type: 'link', attrs: { href: linkMatch[1] } });

    const node = { type: 'text', text };
    if (marks.length) node.marks = marks;
    nodes.push(node);
  }

  return nodes.filter(n => n.text);
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

// ── Parse notes from .enex ────────────────────────────────────────────────────
// Parse Evernote date format: 20230615T003140Z → ISO string
function parseEnDate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).toISOString();
}

function parseNoteBlock(block) {
  const body = block.replace(/^<note>/, '').replace(/<\/note>$/, '');
  const rawTitle = body.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'Untitled';
  const title = decodeHtmlEntities(rawTitle);
  const created = body.match(/<created>([\s\S]*?)<\/created>/)?.[1]?.trim() || '';
  const updated = body.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() || '';
  const contentMatch = body.match(/<content>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/content>/);
  const enml = contentMatch?.[1] || '';
  const resources = parseResources(body);
  const key = `${title}::${created}`;
  const createdAt = parseEnDate(created) || new Date().toISOString();
  const updatedAt = parseEnDate(updated) || parseEnDate(created) || new Date().toISOString();
  return { title, created, enml, resources, key, createdAt, updatedAt };
}

// ── pg helpers ────────────────────────────────────────────────────────────────
async function sbInsert(table, data) {
  const cols = Object.keys(data).map(k => `"${k}"`).join(', ');
  const vals = Object.values(data);
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  return dbOne(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`, vals);
}

// Strip base64 image data from TipTap JSON (replace with placeholder paragraph)
function stripImagesFromTiptap(tiptap) {
  function stripNode(node) {
    if (node.type === 'image') {
      return { type: 'paragraph', content: [{ type: 'text', text: '[Image — too large to import]', marks: [{ type: 'italic' }] }] };
    }
    if (node.content) return { ...node, content: node.content.map(stripNode) };
    return node;
  }
  return { ...tiptap, content: (tiptap.content || []).map(stripNode) };
}

// Look up folder UUID by name + parent_folder_name
async function getFolderId(folderName, parentName) {
  const row = await dbOne(
    `SELECT id FROM notes WHERE is_folder = true AND lower(folder_name) = lower($1) AND lower(parent_folder_name) = lower($2) LIMIT 1`,
    [folderName, parentName]
  );
  return row?.id ? String(row.id) : null;
}

// Load existing note titles from DB to skip duplicates
async function loadExistingTitles(folderName) {
  const rows = await db(`SELECT lower(title) AS t FROM notes WHERE is_folder = false AND folder_name = $1`, [folderName]);
  return new Set(rows.map(r => r.t));
}

// ── Pusher trigger ────────────────────────────────────────────────────────────
const pusherClient = new Pusher({
  appId: PUSHER.appId, key: PUSHER.key, secret: PUSHER.secret, cluster: PUSHER.cluster, useTLS: true,
});

async function pusherTrigger(event, data) {
  await pusherClient.trigger('stickies', event, data).catch(() => {});
}

// Post to Stickies API (for folder creation)
async function post(payload) {
  const res = await fetch(STICKIES_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${STICKIES_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const manifest = loadManifest();
  console.log('Streaming note blocks from file...');
  const blocks = await streamNoteBlocks(enexFile);
  console.log(`Found ${blocks.length} notes total`);

  // Quick metadata extraction (no base64 decode)
  const meta = blocks.map((block, idx) => {
    const title   = decodeHtmlEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'Untitled');
    const created = block.match(/<created>([\s\S]*?)<\/created>/)?.[1]?.trim() || '';
    const updated = block.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim() || created;
    return { idx, title, created, updated, key: `${title}::${created}` };
  });

  // Sort by updated desc (most recently edited first) if --sort=recent
  const sortRecent = process.argv.includes('--sort=recent');
  if (sortRecent) meta.sort((a, b) => b.updated.localeCompare(a.updated));

  const skippedCount = meta.filter(m => manifest[m.key]).length;
  const pendingMeta  = meta.filter(m => !manifest[m.key]);
  const toImport     = limit ? Math.min(limit, pendingMeta.length) : pendingMeta.length;
  console.log(`${skippedCount} already imported, ${pendingMeta.length} pending — importing ${toImport}${sortRecent ? ' (sorted: most recent first)' : ''}`);

  // Build ordered block list from sorted/filtered metadata
  const orderedBlocks = pendingMeta.map(m => blocks[m.idx]);

  // Ensure EVERNOTE folder exists under Integrations
  let evernoteId = await getFolderId('EVERNOTE', 'Integrations');
  if (!evernoteId) {
    console.log('Creating EVERNOTE folder...');
    const maxOrd = await dbOne(`SELECT MAX("order") AS m FROM notes WHERE is_folder = true`);
    const intRow = await dbOne(`SELECT id FROM notes WHERE is_folder = true AND lower(folder_name) = 'integrations' LIMIT 1`);
    const now = new Date().toISOString();
    const f = await sbInsert('notes', {
      is_folder: true, folder_name: 'EVERNOTE', title: 'EVERNOTE', content: '',
      folder_color: '#B0B0B8', parent_folder_name: 'Integrations',
      folder_id: intRow?.id ?? null, order: (maxOrd?.m ?? 2000) + 1, created_at: now, updated_at: now,
    });
    evernoteId = f?.id ? String(f.id) : null;
  }
  console.log(`EVERNOTE folder id: ${evernoteId}`);

  // Ensure notebook folder exists under EVERNOTE
  let notebookId = await getFolderId(notebook, 'EVERNOTE');
  if (!notebookId) {
    console.log(`Creating ${notebook} folder...`);
    const maxOrd = await dbOne(`SELECT MAX("order") AS m FROM notes WHERE is_folder = true`);
    const now = new Date().toISOString();
    const f = await sbInsert('notes', {
      is_folder: true, folder_name: notebook, title: notebook, content: '',
      folder_color: randomColor(), parent_folder_name: 'EVERNOTE',
      folder_id: evernoteId, order: (maxOrd?.m ?? 2000) + 1, created_at: now, updated_at: now,
    });
    notebookId = f?.id ? String(f.id) : null;
  }
  console.log(`${notebook} folder id: ${notebookId}`);

  // Get notebook folder_color
  const notebookRow = await dbOne(`SELECT folder_color FROM notes WHERE id = $1`, [notebookId]);
  const folderColor = notebookRow?.folder_color || '#555560';

  // Get max order
  const maxOrdRow = await dbOne(`SELECT MAX("order") AS m FROM notes WHERE is_folder = false`);
  let nextOrder = (maxOrdRow?.m ?? 2000) + 1;

  // Load existing titles from DB to skip duplicates
  const existingTitles = await loadExistingTitles(notebook);
  console.log(`${existingTitles.size} notes already in DB for "${notebook}" — skipping those`);

  let importedCount = 0;
  for (const block of orderedBlocks) {
    if (limit && importedCount >= limit) break;

    // Now fully parse this single block (base64 decode only for this note)
    const note = parseNoteBlock(block);

    // Skip if already in DB (by title) or manifest
    if (existingTitles.has(note.title.toLowerCase())) {
      console.log(`  ⏭ Skip (already in DB): ${note.title}`);
      continue;
    }

    console.log(`Converting: ${note.title}`);
    const tiptap = await enmlToTiptap(note.enml, note.resources);
    const imageCount = JSON.stringify(tiptap).match(/"type":"image"/g)?.length || 0;
    console.log(`  → ${tiptap.content.length} blocks, ${imageCount} image(s)`);

    // Insert directly into Supabase with correct folder_id
    const noteColor = randomColor();
    const row = await sbInsert('notes', {
      title: note.title,
      content: JSON.stringify(tiptap),
      folder_name: notebook,
      folder_color: noteColor,
      folder_id: notebookId,
      type: 'rich',
      is_folder: false,
      list_mode: false,
      parent_folder_name: null,
      order: nextOrder++,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    });

    if (row?.id) {
      manifest[note.key] = { id: row.id, title: row.title, importedAt: new Date().toISOString() };
      saveManifest(manifest);
      existingTitles.add(note.title.toLowerCase());
      console.log(`  ✓ Inserted: ${row.title} (id: ${row.id})`);
      await pusherTrigger('note-created', row);
      importedCount++;
    } else {
      // Retry without images if content too large
      console.warn(`  ⚠ Insert failed, retrying without images...`);
      const stripped = stripImagesFromTiptap(tiptap);
      const row2 = await sbInsert('notes', {
        title: note.title,
        content: JSON.stringify(stripped),
        folder_name: notebook,
        folder_color: noteColor,
        folder_id: notebookId,
        type: 'rich',
        is_folder: false,
        list_mode: false,
        parent_folder_name: null,
        order: nextOrder - 1,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
      });
      if (row2?.id) {
        manifest[note.key] = { id: row2.id, title: row2.title, importedAt: new Date().toISOString(), imagesStripped: true };
        saveManifest(manifest);
        existingTitles.add(note.title.toLowerCase());
        console.log(`  ✓ Inserted (no images): ${row2.title} (id: ${row2.id})`);
        await pusherTrigger('note-created', row2);
        importedCount++;
      } else {
        console.error(`  ✗ Failed:`, row2);
      }
    }
  }

  console.log('\nDone.');
  await pool.end();
}

main().catch(console.error);
