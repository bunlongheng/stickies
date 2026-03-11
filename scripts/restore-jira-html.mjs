import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load .env.local manually
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env.local');
const envRaw = readFileSync(envPath, 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOTE_ID = '85b1a22c-1d91-4e2b-8044-e7239810713f';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px}
header{background:#111;border-bottom:1px solid #222;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
header h1{font-size:14px;font-weight:800;letter-spacing:-.5px}
header h1 span{color:#3b82f6}
.badge{background:#1d40af22;border:1px solid #1d40af55;color:#60a5fa;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px}
.sub{font-size:10px;color:#555}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#1a1a1a;border-bottom:1px solid #1a1a1a}
.kpi{background:#111;padding:12px 16px;display:flex;flex-direction:column;gap:2px}
.kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#444}
.kpi-value{font-size:22px;font-weight:900;letter-spacing:-1px;line-height:1}
.kpi-value small{font-size:11px;font-weight:500;color:#555;margin-left:2px}
.kpi-delta{font-size:10px;margin-top:2px}
.section-label{padding:6px 16px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.2em;color:#2a2a2a;background:#0d0d0d;border-bottom:1px solid #161616}
.grid{display:grid;gap:1px;background:#1a1a1a}
.g3{grid-template-columns:repeat(3,1fr)}
.g2{grid-template-columns:repeat(2,1fr)}
.g4{grid-template-columns:repeat(4,1fr)}
.card{background:#111;padding:14px 16px}
.card-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:2px}
.card-value{font-size:17px;font-weight:900;letter-spacing:-.5px;margin-bottom:6px}
.card-value small{font-size:11px;font-weight:500;color:#444;margin-left:3px}
.pill{display:inline-flex;align-items:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:3px;margin-bottom:8px}
.pg{background:#052e16;color:#22c55e;border:1px solid #166534}
.pr{background:#2d0a0a;color:#ef4444;border:1px solid #7f1d1d}
.py{background:#292203;color:#f59e0b;border:1px solid #78350f}
.up{color:#22c55e}.down{color:#ef4444}.warn{color:#f59e0b}
.bars{display:flex;align-items:flex-end;gap:3px;height:60px;margin-top:4px}
.bar-col{display:flex;flex-direction:column;align-items:center;flex:1;gap:2px}
.bar-col span{font-size:8px;color:#444}
.bar{width:100%;border-radius:2px 2px 0 0;min-height:2px;transition:height .3s}
.line-chart{display:flex;align-items:flex-end;gap:4px;height:55px;margin-top:4px;position:relative}
.lc-bar{flex:1;border-radius:1px;opacity:.8}
.row{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.name{width:44px;color:#888;font-weight:600;flex-shrink:0;font-size:11px}
.track{flex:1;background:#1a1a1a;border-radius:2px;height:18px;overflow:hidden}
.fill{height:100%;border-radius:2px;display:flex;align-items:center;padding-left:6px;font-size:9px;font-weight:800;color:#fff}
.cnt{width:28px;text-align:right;font-weight:800;font-size:11px;color:#888}
.brow{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;background:#161616;border-radius:4px;margin-bottom:4px}
.brow span:first-child{color:#888}
.brow span:last-child{font-weight:800}
.arow{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;background:#161616;border-radius:4px;margin-bottom:4px;border-left:3px solid transparent}
.arow.cr{border-left-color:#ef4444}
.arow.wa{border-left-color:#f59e0b}
.arow.ok{border-left-color:#22c55e}
.arow span:first-child{color:#888}
.arow span:last-child{font-weight:800}
footer{padding:10px 20px;font-size:9px;color:#222;border-top:1px solid #161616;display:flex;justify-content:space-between}
</style>
</head>
<body>

<header>
  <h1>⬡ Team <span>Alpha</span> — Manager Dashboard</h1>
  <div style="display:flex;align-items:center;gap:8px">
    <span class="badge">ALPHA</span>
    <span class="sub">6 engineers · Updated just now</span>
  </div>
  <span class="sub">● SPRINT 14 ACTIVE · Feb 23 – Mar 8, 2026</span>
</header>

<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-label">Sprint Velocity</div>
    <div class="kpi-value">49<small>pts</small></div>
    <div class="kpi-delta up">↑ +4.3% vs last sprint</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Avg Cycle Time</div>
    <div class="kpi-value">2.4<small>days</small></div>
    <div class="kpi-delta up">↓ Improved from 3.1</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Bug Escape Rate</div>
    <div class="kpi-value">7<small>%/mo</small></div>
    <div class="kpi-delta down">↑ Above 5% target</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Blocked Now</div>
    <div class="kpi-value">3<small>tickets</small></div>
    <div class="kpi-delta warn">⚠ Dave, Bob, Carol</div>
  </div>
</div>

<div class="section-label">Sprint Health</div>
<div class="grid g3">
  <div class="card">
    <div class="card-title">01 — Sprint Velocity</div>
    <div class="card-value">49<small>pts this sprint</small></div>
    <div class="pill pg">✓ On Track</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:73%;background:#1d4ed8"></div><span>S9</span></div>
      <div class="bar-col"><div class="bar" style="height:67%;background:#1d4ed8"></div><span>S10</span></div>
      <div class="bar-col"><div class="bar" style="height:54%;background:#7f1d1d"></div><span>S11</span></div>
      <div class="bar-col"><div class="bar" style="height:70%;background:#1d4ed8"></div><span>S12</span></div>
      <div class="bar-col"><div class="bar" style="height:76%;background:#1d4ed8"></div><span>S13</span></div>
      <div class="bar-col"><div class="bar" style="height:70%;background:#3b82f6"></div><span>S14</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">05 — Sprint Burndown</div>
    <div class="card-value">28<small>pts remaining · Day 7</small></div>
    <div class="pill py">⚠ Slight Delay</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:100%;background:#f59e0b55"></div><span>D1</span></div>
      <div class="bar-col"><div class="bar" style="height:95%;background:#f59e0b55"></div><span>D2</span></div>
      <div class="bar-col"><div class="bar" style="height:80%;background:#f59e0b55"></div><span>D3</span></div>
      <div class="bar-col"><div class="bar" style="height:63%;background:#f59e0b55"></div><span>D4</span></div>
      <div class="bar-col"><div class="bar" style="height:49%;background:#f59e0b55"></div><span>D5</span></div>
      <div class="bar-col"><div class="bar" style="height:35%;background:#f59e0b"></div><span>D6</span></div>
      <div class="bar-col"><div class="bar" style="height:28%;background:#f59e0b"></div><span>D7</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">11 — Sprint Goal Achievement</div>
    <div class="card-value">83<small>% hit rate · 6 sprints</small></div>
    <div class="pill pg">✓ Above 80% Target</div>
    <div class="brow"><span>Sprint 9</span><span class="up">✅ HIT 51 pts</span></div>
    <div class="brow"><span>Sprint 10</span><span class="up">✅ HIT 47 pts</span></div>
    <div class="brow"><span>Sprint 11</span><span class="down">❌ MISS 3 carried</span></div>
    <div class="brow"><span>Sprint 12</span><span class="up">✅ HIT 49 pts</span></div>
    <div class="brow"><span>Sprint 13</span><span class="up">✅ HIT 53 pts</span></div>
    <div class="brow"><span>Sprint 14</span><span class="warn">🔄 ACTIVE 49 target</span></div>
  </div>
</div>

<div class="section-label">Flow &amp; Quality</div>
<div class="grid g4">
  <div class="card">
    <div class="card-title">02 — Cycle Time</div>
    <div class="card-value">2.4<small>d median</small></div>
    <div class="pill pg">✓ &lt; 3-day Target</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:60%;background:#22c55e"></div><span>Bug</span></div>
      <div class="bar-col"><div class="bar" style="height:85%;background:#3b82f6"></div><span>Feat</span></div>
      <div class="bar-col"><div class="bar" style="height:50%;background:#f59e0b"></div><span>Chore</span></div>
      <div class="bar-col"><div class="bar" style="height:23%;background:#ef4444"></div><span>Hot</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">03 — Lead Time</div>
    <div class="card-value">5.0<small>d avg · 6 wks</small></div>
    <div class="pill pg">✓ Improving</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:59%;background:#a78bfa55"></div><span>W1</span></div>
      <div class="bar-col"><div class="bar" style="height:79%;background:#a78bfa55"></div><span>W2</span></div>
      <div class="bar-col"><div class="bar" style="height:53%;background:#a78bfa55"></div><span>W3</span></div>
      <div class="bar-col"><div class="bar" style="height:44%;background:#a78bfa55"></div><span>W4</span></div>
      <div class="bar-col"><div class="bar" style="height:38%;background:#a78bfa"></div><span>W5</span></div>
      <div class="bar-col"><div class="bar" style="height:36%;background:#a78bfa"></div><span>W6</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">04 — Bug Escape Rate</div>
    <div class="card-value">7<small>% this month</small></div>
    <div class="pill pr">✗ Above 5%</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:57%;background:#ef444466"></div><span>Aug</span></div>
      <div class="bar-col"><div class="bar" style="height:29%;background:#22c55e55"></div><span>Sep</span></div>
      <div class="bar-col"><div class="bar" style="height:79%;background:#ef444466"></div><span>Oct</span></div>
      <div class="bar-col"><div class="bar" style="height:43%;background:#ef444466"></div><span>Nov</span></div>
      <div class="bar-col"><div class="bar" style="height:21%;background:#22c55e55"></div><span>Dec</span></div>
      <div class="bar-col"><div class="bar" style="height:21%;background:#22c55e55"></div><span>Jan</span></div>
      <div class="bar-col"><div class="bar" style="height:50%;background:#ef444466"></div><span>Feb</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">10 — Reopened Tickets</div>
    <div class="card-value">4.2<small>% of closed</small></div>
    <div class="pill pg">✓ Under 5%</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:61%;background:#f472b655"></div><span>S9</span></div>
      <div class="bar-col"><div class="bar" style="height:32%;background:#f472b655"></div><span>S10</span></div>
      <div class="bar-col"><div class="bar" style="height:58%;background:#f472b655"></div><span>S11</span></div>
      <div class="bar-col"><div class="bar" style="height:41%;background:#f472b6"></div><span>S12</span></div>
      <div class="bar-col"><div class="bar" style="height:29%;background:#f472b6"></div><span>S13</span></div>
      <div class="bar-col"><div class="bar" style="height:31%;background:#f472b6"></div><span>S14</span></div>
    </div>
  </div>
</div>

<div class="section-label">Team &amp; Process</div>
<div class="grid g3">
  <div class="card">
    <div class="card-title">07 — WIP per Developer</div>
    <div class="card-value">2.8<small>avg/dev</small></div>
    <div class="pill pr">✗ Dave Overloaded</div>
    <div class="row"><span class="name">Alice</span><span class="track"><span class="fill" style="width:29%;background:#3b82f6">2</span></span><span class="cnt">2</span></div>
    <div class="row"><span class="name">Bob</span><span class="track"><span class="fill" style="width:43%;background:#3b82f6">3</span></span><span class="cnt">3</span></div>
    <div class="row"><span class="name">Carol</span><span class="track"><span class="fill" style="width:14%;background:#22c55e">1</span></span><span class="cnt">1</span></div>
    <div class="row"><span class="name">Dave</span><span class="track"><span class="fill" style="width:100%;background:#ef4444">7 🚨</span></span><span class="cnt down">7</span></div>
    <div class="row"><span class="name">Eve</span><span class="track"><span class="fill" style="width:29%;background:#3b82f6">2</span></span><span class="cnt">2</span></div>
    <div class="row"><span class="name">Frank</span><span class="track"><span class="fill" style="width:29%;background:#3b82f6">2</span></span><span class="cnt">2</span></div>
  </div>
  <div class="card">
    <div class="card-title">08 — Blocked Ticket Rate</div>
    <div class="card-value">13<small>% of active</small></div>
    <div class="pill pr">✗ Above 10%</div>
    <div class="bars" style="height:80px">
      <div class="bar-col"><div class="bar" style="height:42%;background:#f59e0b"></div><span>Design</span></div>
      <div class="bar-col"><div class="bar" style="height:26%;background:#ef4444"></div><span>Ext.API</span></div>
      <div class="bar-col"><div class="bar" style="height:21%;background:#a78bfa"></div><span>M.Req</span></div>
      <div class="bar-col"><div class="bar" style="height:11%;background:#555"></div><span>Other</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">06 — Weekly Throughput</div>
    <div class="card-value">12.3<small>tickets/wk avg</small></div>
    <div class="pill py">⚠ Dip Wk 5</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:70%;background:#3b82f655"></div><span>W1</span></div>
      <div class="bar-col"><div class="bar" style="height:60%;background:#3b82f655"></div><span>W2</span></div>
      <div class="bar-col"><div class="bar" style="height:65%;background:#3b82f655"></div><span>W3</span></div>
      <div class="bar-col"><div class="bar" style="height:75%;background:#3b82f6"></div><span>W4</span></div>
      <div class="bar-col"><div class="bar" style="height:40%;background:#ef444466"></div><span>W5</span></div>
      <div class="bar-col"><div class="bar" style="height:55%;background:#3b82f655"></div><span>W6</span></div>
      <div class="bar-col"><div class="bar" style="height:70%;background:#3b82f655"></div><span>W7</span></div>
      <div class="bar-col"><div class="bar" style="height:65%;background:#3b82f655"></div><span>W8</span></div>
    </div>
  </div>
</div>

<div class="section-label">Backlog &amp; Risk</div>
<div class="grid g2">
  <div class="card">
    <div class="card-title">09 — Backlog Health</div>
    <div class="card-value">87<small>items · 1.8 sprints</small></div>
    <div class="pill pg">✓ Under 2-sprint Limit</div>
    <div class="bars">
      <div class="bar-col"><div class="bar" style="height:60%;background:#22c55e55"></div><span>Done</span></div>
      <div class="bar-col"><div class="bar" style="height:100%;background:#3b82f655"></div><span>Todo</span></div>
      <div class="bar-col"><div class="bar" style="height:20%;background:#f59e0b55"></div><span>Block</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">12 — Ticket Age (Open)</div>
    <div class="card-value">3<small>tickets over 14 days</small></div>
    <div class="pill pr">✗ 3 Aged Tickets</div>
    <div class="arow cr"><span>ALPHA-291 — Auth refactor</span><span>21d 🚨</span></div>
    <div class="arow cr"><span>ALPHA-274 — Dark mode bug</span><span>18d 🚨</span></div>
    <div class="arow cr"><span>ALPHA-283 — API rate limit</span><span>15d 🚨</span></div>
    <div class="arow wa"><span>ALPHA-301 — Onboarding flow</span><span>11d ⚠</span></div>
    <div class="arow wa"><span>ALPHA-308 — Search perf</span><span>9d ⚠</span></div>
    <div class="arow ok"><span>ALPHA-315 — Email templates</span><span>4d ✓</span></div>
    <div class="arow ok"><span>ALPHA-318 — CSV export</span><span>2d ✓</span></div>
  </div>
</div>

<footer>
  <span>Team Alpha · 6 engineers · Sprint 14 · 2026</span>
  <span>Fake data — dashboard proposal</span>
</footer>

</body>
</html>`;

async function main() {
  console.log('Connecting to Supabase:', SUPABASE_URL);
  console.log('Updating note:', NOTE_ID);
  console.log('HTML length:', html.length, 'chars');

  const { data, error } = await supabase
    .from('notes')
    .update({ content: html, type: 'html' })
    .eq('id', NOTE_ID)
    .select('id, type, content');

  if (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }

  console.log('\nUpdate successful!');
  console.log('id:', data[0].id);
  console.log('type:', data[0].type);
  console.log('content.length:', data[0].content.length);
  console.log('content.slice(0, 80):', data[0].content.slice(0, 80));

  // Re-read from DB to confirm
  console.log('\nRe-reading from DB to confirm...');
  const { data: confirm, error: confirmError } = await supabase
    .from('notes')
    .select('id, type, content')
    .eq('id', NOTE_ID)
    .single();

  if (confirmError) {
    console.error('Re-read failed:', confirmError);
    process.exit(1);
  }

  console.log('Confirmed id:', confirm.id);
  console.log('Confirmed type:', confirm.type);
  console.log('Confirmed content.length:', confirm.content.length);
  console.log('Confirmed content.slice(0, 80):', confirm.content.slice(0, 80));
}

main();
