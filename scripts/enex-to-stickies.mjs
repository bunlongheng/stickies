#!/usr/bin/env node
/**
 * Evernote .enex → Stickies importer
 * Structure: INTEGRATIONS → EVERNOTE → $notebook → $note
 */

import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs';
import { basename, dirname } from 'path';
import { createHmac, createHash } from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_FILE = `${__dirname}/.import-manifest.json`;

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

const STICKIES_URL = process.env.STICKIES_URL || 'https://bheng.vercel.app/api/stickies';
const STICKIES_KEY = process.env.STICKIES_KEY;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const PUSHER = {
  appId:   process.env.PUSHER_APP_ID,
  key:     process.env.PUSHER_KEY,
  secret:  process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || 'us2',
};

if (!SB_URL || !SB_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars'); process.exit(1); }

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
    resources[md5] = { mime, b64 };
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
  const allMatches = [...html.matchAll(/<(h[1-6]|ul|ol|div|p|pre)([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>|<hr\s*\/?>|<en-media([^>]*)\/>/gi)];

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
  if (!mime.startsWith('image/')) return null;

  const resource = hashMatch
    ? resources[hashMatch[1]]
    : Object.values(resources).find(r => r.mime === mime);

  if (!resource) return null;

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

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return res.json();
}

async function sbPatch(table, filter, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

async function sbInsert(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
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
  const filter = `is_folder=eq.true&folder_name=eq.${encodeURIComponent(folderName)}`;
  const rows = await sbGet(`notes?${filter}&select=id,parent_folder_name`);
  if (!Array.isArray(rows)) return null;
  const match = rows.find(r =>
    parentName ? r.parent_folder_name?.toLowerCase() === parentName.toLowerCase() : !r.parent_folder_name
  );
  return match?.id || null;
}

// ── Pusher trigger ────────────────────────────────────────────────────────────
async function pusherTrigger(event, data) {
  const { appId, key, secret, cluster } = PUSHER;
  const channel = 'stickies';
  const ts = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(data);
  const md5 = createHmac('md5', '').update(body).digest('hex'); // body_md5
  const toSign = `POST\n/apps/${appId}/events\nauth_key=${key}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${md5}&channels%5B%5D=${channel}&name=${event}`;
  const sig = createHmac('sha256', secret).update(toSign).digest('hex');
  const url = `https://api-${cluster}.pusher.com/apps/${appId}/events?auth_key=${key}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${md5}&auth_signature=${sig}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: event, channels: [channel], data: JSON.stringify(data) }),
  }).catch(() => {});
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

  // Quick key extraction (no base64 decode) to count pending without OOM
  let skippedCount = 0;
  let pendingCount = 0;
  for (const block of blocks) {
    const title = decodeHtmlEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'Untitled');
    const created = block.match(/<created>([\s\S]*?)<\/created>/)?.[1]?.trim() || '';
    const key = `${title}::${created}`;
    if (manifest[key]) skippedCount++; else pendingCount++;
  }
  const toImport = limit ? Math.min(limit, pendingCount) : pendingCount;
  console.log(`${skippedCount} already imported, ${pendingCount} pending — importing ${toImport}`);

  // Ensure EVERNOTE folder exists under Integrations
  let evernoteId = await getFolderId('EVERNOTE', 'Integrations');
  if (!evernoteId) {
    console.log('Creating EVERNOTE folder...');
    await post({ type: 'folder', name: 'EVERNOTE', parent_folder: 'Integrations' });
    evernoteId = await getFolderId('EVERNOTE', 'Integrations');
  }
  console.log(`EVERNOTE folder id: ${evernoteId}`);

  // Ensure notebook folder exists under EVERNOTE
  let notebookId = await getFolderId(notebook, 'EVERNOTE');
  if (!notebookId) {
    console.log(`Creating ${notebook} folder...`);
    await post({ type: 'folder', name: notebook, parent_folder: 'EVERNOTE' });
    notebookId = await getFolderId(notebook, 'EVERNOTE');
    if (notebookId) {
      await sbPatch('notes', `id=eq.${notebookId}`, { parent_folder_name: 'EVERNOTE', folder_id: evernoteId });
    }
  }
  console.log(`${notebook} folder id: ${notebookId}`);

  // Get notebook folder_color
  const notebookRows = await sbGet(`notes?id=eq.${notebookId}&select=folder_color`);
  const folderColor = (Array.isArray(notebookRows) && notebookRows[0]?.folder_color) || '#555560';

  // Get max order
  const orderRows = await sbGet('notes?select=order&order=order.desc&limit=1');
  let nextOrder = (Array.isArray(orderRows) && orderRows[0]?.order ? orderRows[0].order : 2000) + 1;

  let importedCount = 0;
  for (const block of blocks) {
    // Quick key check first — no base64 decode yet
    const quickTitle = decodeHtmlEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'Untitled');
    const quickCreated = block.match(/<created>([\s\S]*?)<\/created>/)?.[1]?.trim() || '';
    const quickKey = `${quickTitle}::${quickCreated}`;

    if (manifest[quickKey]) continue;
    if (limit && importedCount >= limit) continue;

    // Now fully parse this single block (base64 decode only for this note)
    const note = parseNoteBlock(block);
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
      console.log(`  ✓ Inserted: ${row.title} (id: ${row.id})`);
      await pusherTrigger('note-created', row);
      importedCount++;
    } else if (row?.code === '54000' || row?.message?.includes('tsvector')) {
      // Content too large for full-text index — retry without images
      console.warn(`  ⚠ tsvector limit hit, retrying without images...`);
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
        order: nextOrder - 1, // reuse same order slot
        created_at: note.createdAt,
        updated_at: note.updatedAt,
      });
      if (row2?.id) {
        manifest[note.key] = { id: row2.id, title: row2.title, importedAt: new Date().toISOString(), imagesStripped: true };
        saveManifest(manifest);
        console.log(`  ✓ Inserted (no images): ${row2.title} (id: ${row2.id})`);
        await pusherTrigger('note-created', row2);
        importedCount++;
      } else {
        console.error(`  ✗ Failed even without images:`, row2);
      }
    } else {
      console.error(`  ✗ Failed:`, row);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
