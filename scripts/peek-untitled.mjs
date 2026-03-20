import { createReadStream, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath,'utf8').split('\n').forEach(l=>{const m=l.match(/^([^#=]+)=(.*)/);if(m)process.env[m[1].trim()]=m[2].trim();});
}

const file = process.argv[2];
if (!file) { console.error('Usage: node peek-untitled.mjs <file.enex>'); process.exit(1); }

let buf='', inNote=false, blocks=[];
const stream = createReadStream(file, {encoding:'utf8', highWaterMark:256*1024});
stream.on('data', chunk => {
  buf += chunk;
  while (true) {
    if (!inNote) { const s=buf.indexOf('<note>'); if(s===-1){buf=buf.slice(-10);break;} inNote=true; buf=buf.slice(s); }
    const e=buf.indexOf('</note>'); if(e===-1) break;
    blocks.push(buf.slice(0,e+7)); buf=buf.slice(e+7); inNote=false;
  }
});
stream.on('end', () => {
  const untitled = blocks.filter(b => {
    const title = b.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || '';
    return /^untitled(\s+note)?$/i.test(title);
  });
  console.log(`Found ${untitled.length} untitled notes\n`);
  untitled.forEach((b, i) => {
    const title   = b.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const created = b.match(/<created>([\s\S]*?)<\/created>/)?.[1]?.trim();
    const raw     = b.match(/<content>([\s\S]*?)<\/content>/)?.[1] || '';
    const text    = raw.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 300);
    console.log(`${i+1}. [${created}] ${title}`);
    console.log(`   ${text || '(no text content)'}`);
    console.log('');
  });
});
stream.on('error', console.error);
