#!/usr/bin/env node
/**
 * Evernote .enex → Stickies importer
 * Structure: INTEGRATIONS → EVERNOTE → $notebook → $note
 * Uses Supabase Management API — bypasses PostgREST quota entirely.
 */
// Allow Pusher HTTPS on macOS where system certs aren't in Node's bundle
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs';
import { basename, dirname, join } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
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

// Supabase Management API — same db/dbOne interface as pg, no connection string needed
const SB_REF   = process.env.SUPABASE_PROJECT_REF;
const SB_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;

async function sbQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Supabase SQL error (${res.status}): ${t}`); }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Inline $1,$2,… params safely into SQL literals for the Management API */
function fmt(sql, params = []) {
  return sql.replace(/\$(\d+)/g, (_, n) => {
    const v = params[parseInt(n, 10) - 1];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

const db    = (sql, p) => sbQuery(fmt(sql, p));
const dbOne = (sql, p) => sbQuery(fmt(sql, p)).then(r => r[0] ?? null);

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

// ── Terminal UI ───────────────────────────────────────────────────────────────
/** Convert #RRGGBB → ANSI truecolor escape */
function hex(color) {
  const c = color.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const CLEAR  = '\x1b[2K\x1b[1G'; // clear line + move to col 1

const SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
// Rainbow cycle for the spinner itself
const RAINBOW = ['#FF3B30','#FF9500','#FFCC00','#34C759','#007AFF','#5856D6','#AF52DE'];
let _spinFrame = 0;
let _spinTimer = null;
let _spinLabel = '';

function spinStart(label) {
  _spinLabel = label;
  _spinFrame = 0;
  process.stdout.write('\x1b[?25l'); // hide cursor
  _spinTimer = setInterval(() => {
    const frame  = SPINNER_FRAMES[_spinFrame % SPINNER_FRAMES.length];
    const color  = RAINBOW[_spinFrame % RAINBOW.length];
    process.stdout.write(`${CLEAR}${hex(color)}${frame}${RESET} ${_spinLabel}`);
    _spinFrame++;
  }, 80);
}

function spinStop() {
  if (_spinTimer) { clearInterval(_spinTimer); _spinTimer = null; }
  process.stdout.write(`${CLEAR}\x1b[?25h`); // restore cursor
}

function spinLabel(label) { _spinLabel = label; }

/** Render a colorful progress bar */
function progressBar(done, total, color, width = 28) {
  const pct   = total > 0 ? done / total : 0;
  const filled = Math.round(pct * width);
  const bar   = hex(color) + '█'.repeat(filled) + DIM + '░'.repeat(width - filled) + RESET;
  const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
  return `[${bar}] ${hex(color)}${BOLD}${pctStr}${RESET}`;
}

const PUSHER = {
  appId:   process.env.PUSHER_APP_ID,
  key:     process.env.PUSHER_KEY,
  secret:  process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || 'us2',
};

if (!process.env.SUPABASE_PROJECT_REF || !process.env.SUPABASE_MANAGEMENT_TOKEN) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_MANAGEMENT_TOKEN env var');
  process.exit(1);
}

const enexFile = process.argv[2];
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

if (!enexFile) {
  console.error('Usage: node enex-to-stickies.mjs <file.enex> [--limit=N]');
  process.exit(1);
}

// Derive notebook name from filename: "My Notebook.enex" → "MY NOTEBOOK"
const notebook = (process.argv[3] && !process.argv[3].startsWith('--'))
  ? process.argv[3]
  : basename(enexFile, '.enex').toUpperCase();
console.log(`Notebook: "${notebook}" (from ${process.argv[3] && !process.argv[3].startsWith('--') ? 'arg' : 'filename'})`);

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
    `SELECT id FROM stickies WHERE is_folder = true AND lower(folder_name) = lower($1) AND lower(parent_folder_name) = lower($2) LIMIT 1`,
    [folderName, parentName]
  );
  return row?.id ? String(row.id) : null;
}

// Load existing note titles from DB to skip duplicates
async function loadExistingTitles(folderName) {
  const rows = await db(`SELECT lower(title) AS t FROM stickies WHERE is_folder = false AND folder_name = $1`, [folderName]);
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
    const maxOrd = await dbOne(`SELECT MAX("order") AS m FROM stickies WHERE is_folder = true`);
    const intRow = await dbOne(`SELECT id FROM stickies WHERE is_folder = true AND lower(folder_name) = 'integrations' LIMIT 1`);
    const now = new Date().toISOString();
    const f = await sbInsert('stickies', {
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
    const maxOrd = await dbOne(`SELECT MAX("order") AS m FROM stickies WHERE is_folder = true`);
    const now = new Date().toISOString();
    const f = await sbInsert('stickies', {
      is_folder: true, folder_name: notebook, title: notebook, content: '',
      folder_color: randomColor(), parent_folder_name: 'EVERNOTE',
      folder_id: evernoteId, order: (maxOrd?.m ?? 2000) + 1, created_at: now, updated_at: now,
    });
    notebookId = f?.id ? String(f.id) : null;
  }
  console.log(`${notebook} folder id: ${notebookId}`);

  // Get notebook folder_color
  const notebookRow = await dbOne(`SELECT folder_color FROM stickies WHERE id = $1`, [notebookId]);
  const folderColor = notebookRow?.folder_color || '#555560';

  // Get max order
  const maxOrdRow = await dbOne(`SELECT MAX("order") AS m FROM stickies WHERE is_folder = false`);
  let nextOrder = (maxOrdRow?.m ?? 2000) + 1;

  // Load existing titles from DB to skip duplicates
  const existingTitles = await loadExistingTitles(notebook);
  if (existingTitles.size > 0)
    console.log(`${DIM}↩  ${existingTitles.size} already in DB — will skip${RESET}`);

  let importedCount  = 0;
  let failedNotes    = [];
  let dbSkippedCount = 0;
  const skipLog      = []; // { title, reason }

  // Print a blank line before the live block
  console.log('');

  for (const block of orderedBlocks) {
    if (limit && importedCount >= limit) break;

    const note = parseNoteBlock(block);

    if (existingTitles.has(note.title.toLowerCase())) {
      dbSkippedCount++;
      continue;
    }

    // ── Skip: untitled
    const isUntitled = /^untitled(\s+note)?$/i.test(note.title.trim());
    if (isUntitled) {
      const preview = (note.enml || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
      skipLog.push({ title: note.title, reason: 'untitled', preview, createdAt: note.createdAt });
      console.log(`${hex('#555560')}⊘${RESET} ${DIM}skip (untitled):  ${note.title}${RESET}`);
      continue;
    }

    // ── Skip: empty ENML content
    const enmlText = (note.enml || '').replace(/<[^>]+>/g, '').trim();
    if (!enmlText && !note.enml?.includes('<en-media')) {
      skipLog.push({ title: note.title, reason: 'empty content', preview: '', createdAt: note.createdAt });
      console.log(`${hex('#555560')}⊘${RESET} ${DIM}skip (empty):      ${note.title}${RESET}`);
      continue;
    }

    const noteColor = randomColor();
    const shortTitle = note.title.length > 42 ? note.title.slice(0, 41) + '…' : note.title;

    // ── Spinner: converting ──
    spinStart(`${DIM}converting${RESET}  ${hex(noteColor)}${BOLD}${shortTitle}${RESET}`);
    const tiptap = await enmlToTiptap(note.enml, note.resources);
    const imageCount = JSON.stringify(tiptap).match(/"type":"image"/g)?.length || 0;
    spinStop();

    // ── Spinner: uploading ──
    spinStart(`${DIM}uploading${RESET}   ${hex(noteColor)}${BOLD}${shortTitle}${RESET}`);
    const row = await sbInsert('stickies', {
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
    spinStop();

    if (row?.id) {
      manifest[note.key] = { id: row.id, title: row.title, importedAt: new Date().toISOString() };
      saveManifest(manifest);
      existingTitles.add(note.title.toLowerCase());
      importedCount++;
      await pusherTrigger('note-created', row);

      const imgs  = imageCount > 0 ? `  ${DIM}${imageCount} img${RESET}` : '';
      const bar   = progressBar(importedCount, toImport, noteColor);
      console.log(
        `${hex(noteColor)}${BOLD}✓${RESET} ` +
        `${hex(noteColor)}[${String(importedCount).padStart(3)}/${toImport}]${RESET} ` +
        `${bar}${imgs}\n  ${DIM}${shortTitle}${RESET}`
      );
    } else {
      // Retry without images
      spinStart(`${hex('#FF9500')}retrying${RESET} (no images)  ${DIM}${shortTitle}${RESET}`);
      const stripped = stripImagesFromTiptap(tiptap);
      const row2 = await sbInsert('stickies', {
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
      spinStop();

      if (row2?.id) {
        manifest[note.key] = { id: row2.id, title: row2.title, importedAt: new Date().toISOString(), imagesStripped: true };
        saveManifest(manifest);
        existingTitles.add(note.title.toLowerCase());
        importedCount++;
        await pusherTrigger('note-created', row2);
        console.log(
          `${hex('#FF9500')}${BOLD}✓${RESET} ` +
          `${hex('#FF9500')}[${String(importedCount).padStart(3)}/${toImport}]${RESET} ` +
          `${progressBar(importedCount, toImport, '#FF9500')}  ${DIM}(imgs stripped) ${shortTitle}${RESET}`
        );
      } else {
        failedNotes.push(note.title);
        console.log(`${hex('#FF3B30')}${BOLD}✗${RESET} ${DIM}failed:${RESET} ${shortTitle}`);
      }
    }
  }
  console.log('');

  // ── Write skip review file ────────────────────────────────────────────────────
  if (skipLog.length > 0) {
    const reviewFile = `${__dirname}/.skip-review-${notebook.replace(/[^a-z0-9]/gi, '_')}.md`;
    const lines = [
      `# Skipped Notes — ${notebook}`,
      `> Generated ${new Date().toLocaleString()}  ·  ${skipLog.length} notes skipped`,
      '',
    ];
    for (const s of skipLog) {
      lines.push(`---`);
      lines.push(`## ${s.title}`);
      lines.push(`**Reason:** ${s.reason}  |  **Created:** ${s.createdAt || 'unknown'}`);
      lines.push('');
      if (s.preview) {
        lines.push(s.preview);
        lines.push('');
      } else {
        lines.push('_(no text content)_');
        lines.push('');
      }
    }
    writeFileSync(reviewFile, lines.join('\n'));
    console.log(`${hex('#32ADE6')}📋 Skip review saved →${RESET} ${DIM}${reviewFile}${RESET}\n`);
  }

  // ── Post-import quality audit ────────────────────────────────────────────────
  const auditRows = await db(
    `SELECT id, title, content, created_at FROM stickies WHERE is_folder = false AND folder_name = $1 ORDER BY "order" ASC`,
    [notebook]
  );

  let totalImages = 0;
  let totalLines = 0;
  let totalTables = 0;
  let totalBytes = 0;
  let notesWithImages = 0;
  let notesWithTables = 0;
  let strippedNotes = [];
  let emptyNotes = [];
  let largestNote = { title: '', bytes: 0 };

  for (const r of auditRows) {
    const contentStr = typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
    const bytes = Buffer.byteLength(contentStr, 'utf8');
    totalBytes += bytes;

    if (bytes > largestNote.bytes) largestNote = { title: r.title, bytes };

    const imgMatches = contentStr.match(/"type":"image"/g);
    const imgs = imgMatches ? imgMatches.length : 0;
    totalImages += imgs;
    if (imgs > 0) notesWithImages++;

    if (contentStr.includes('Image \u2014 too large to import')) strippedNotes.push(r.title);

    const tableMatches = contentStr.match(/"type":"table"/g);
    const tables = tableMatches ? tableMatches.length : 0;
    totalTables += tables;
    if (tables > 0) notesWithTables++;

    const lineMatches = contentStr.match(/"type":"(paragraph|heading|listItem|bulletList|orderedList)"/g);
    totalLines += lineMatches ? lineMatches.length : 0;

    // Detect empty/blank notes (content has no text nodes with actual content)
    const textMatches = contentStr.match(/"text":"([^"]+)"/g);
    if (!textMatches || textMatches.length === 0) emptyNotes.push(r.title);
  }

  const totalKB = (totalBytes / 1024).toFixed(1);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
  const avgKB   = auditRows.length ? (totalBytes / auditRows.length / 1024).toFixed(1) : '0';

  // ── Colors for the report table ──
  const C = {
    border:   hex('#5856D6'),
    head:     hex('#AF52DE'),
    label:    hex('#32ADE6'),
    green:    hex('#34C759'),
    yellow:   hex('#FFCC00'),
    orange:   hex('#FF9500'),
    red:      hex('#FF3B30'),
    dim:      DIM,
  };

  const W = 52; // inner content width (between │ and │)
  const row = (label, value, valColor = RESET) => {
    const lbl = `${C.label}${label}${RESET}`;
    const val = `${valColor}${BOLD}${value}${RESET}`;
    // strip ANSI for length calc
    const lblLen = label.length;
    const valLen = String(value).length;
    const gap = Math.max(1, W - lblLen - valLen - 2);
    return `${C.border}│${RESET}  ${lbl}${' '.repeat(gap)}${val}  ${C.border}│${RESET}`;
  };
  const divider = (l, m, r) => `${C.border}${l}${'─'.repeat(W + 2)}${r}${RESET}`;
  const blank   = () => `${C.border}│${' '.repeat(W + 2)}│${RESET}`;

  const successColor = failedNotes.length > 0 ? C.orange : C.green;
  const skippedStr   = (skippedCount + dbSkippedCount) > 0 ? ` ${C.dim}(${skippedCount + dbSkippedCount} skipped)${RESET}` : '';

  console.log(`\n${divider('╔','═','╗'.replace('─','═'))}`);
  const title = 'REPORT';
  const titlePad = Math.max(0, W - title.length);
  const titleColored = [...title].map((ch, i) => `${hex(RAINBOW[i % RAINBOW.length])}${ch}`).join('') + RESET;
  console.log(`${C.border}│${RESET}  ${BOLD}${titleColored}${' '.repeat(titlePad)}  ${C.border}│${RESET}`);
  console.log(divider('╠','─','╣'));

  console.log(row('Notebook',            notebook, C.head));
  console.log(divider('├','─','┤'));
  console.log(row('Inserted this run',  importedCount + skippedStr, successColor));
  console.log(row('Failed',             failedNotes.length, failedNotes.length > 0 ? C.red : C.green));
  console.log(row('Total in notebook',  auditRows.length, C.green));
  console.log(divider('├','─','┤'));

  console.log(row('Content size',       `${totalKB} KB  (${totalMB} MB)`, C.yellow));
  console.log(row('Avg note size',      `${avgKB} KB`, C.dim));
  console.log(row('Largest note',       `${largestNote.title.slice(0,22)}  ${(largestNote.bytes/1024).toFixed(1)} KB`, C.dim));
  console.log(divider('├','─','┤'));

  console.log(row('Lines',              totalLines, C.label));
  console.log(row('Images',             `${totalImages}  in ${notesWithImages} notes`, totalImages > 0 ? C.yellow : C.dim));
  console.log(row('Tables',             `${totalTables}  in ${notesWithTables} notes`, totalTables > 0 ? C.yellow : C.dim));

  if (emptyNotes.length > 0) {
    console.log(divider('├','─','┤'));
    console.log(row('⚠  Empty notes', emptyNotes.length, C.orange));
    emptyNotes.slice(0, 4).forEach(t =>
      console.log(`${C.border}│${RESET}    ${C.dim}· ${t.slice(0, W - 4)}${RESET}${' '.repeat(Math.max(0, W - 2 - t.slice(0,W-4).length))}  ${C.border}│${RESET}`)
    );
    if (emptyNotes.length > 4) console.log(`${C.border}│${RESET}    ${C.dim}· …and ${emptyNotes.length - 4} more${RESET}${' '.repeat(Math.max(0, W - 14 - String(emptyNotes.length-4).length))}  ${C.border}│${RESET}`);
  }

  if (strippedNotes.length > 0) {
    console.log(divider('├','─','┤'));
    console.log(row('⚠  Images stripped', strippedNotes.length, C.orange));
    strippedNotes.slice(0, 4).forEach(t =>
      console.log(`${C.border}│${RESET}    ${C.dim}· ${t.slice(0, W - 4)}${RESET}${' '.repeat(Math.max(0, W - 2 - t.slice(0,W-4).length))}  ${C.border}│${RESET}`)
    );
    if (strippedNotes.length > 4) console.log(`${C.border}│${RESET}    ${C.dim}· …and ${strippedNotes.length - 4} more${RESET}${' '.repeat(Math.max(0, W - 14 - String(strippedNotes.length-4).length))}  ${C.border}│${RESET}`);
  }

  if (skipLog.length > 0) {
    console.log(divider('├','─','┤'));
    const untitled = skipLog.filter(s => s.reason === 'untitled');
    const empty    = skipLog.filter(s => s.reason === 'empty content');
    if (untitled.length) {
      console.log(row('⊘  Skipped (untitled)', untitled.length, C.dim));
      untitled.slice(0, 3).forEach(s =>
        console.log(`${C.border}│${RESET}    ${DIM}· ${s.title.slice(0, W - 4)}${RESET}${' '.repeat(Math.max(0, W - 2 - s.title.slice(0,W-4).length))}  ${C.border}│${RESET}`)
      );
    }
    if (empty.length) {
      console.log(row('⊘  Skipped (empty)', empty.length, C.dim));
      empty.slice(0, 3).forEach(s =>
        console.log(`${C.border}│${RESET}    ${DIM}· ${s.title.slice(0, W - 4)}${RESET}${' '.repeat(Math.max(0, W - 2 - s.title.slice(0,W-4).length))}  ${C.border}│${RESET}`)
      );
    }
  }

  if (failedNotes.length > 0) {
    console.log(divider('├','─','┤'));
    console.log(row('✗  Failed notes', failedNotes.length, C.red));
    failedNotes.slice(0, 4).forEach(t =>
      console.log(`${C.border}│${RESET}    ${C.red}· ${t.slice(0, W - 4)}${RESET}${' '.repeat(Math.max(0, W - 2 - t.slice(0,W-4).length))}  ${C.border}│${RESET}`)
    );
  }

  console.log(divider('╚','═','╝'));
}

main().catch(console.error);
