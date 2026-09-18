#!/usr/bin/env node

import os from 'os';

const C = '\x1b[33m'; // yellow
const B = '\x1b[1m';
const R = '\x1b[0m';

function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}
const lanIp = getLanIp();

// Block art for "STICKIES" — each letter padded to fixed width
// S=8  T=9  I=3  C=8  K=8  I=3  E=8  S=8  (+7 spaces between) = 62 chars per line
const art = [
  ' ██████╗ ████████╗ ██╗  ██████╗ ██╗  ██╗ ██╗ ███████╗  ██████╗',
  '██╔════╝ ╚══██╔══╝ ██║ ██╔════╝ ██║ ██╔╝ ██║ ██╔════╝ ██╔════╝',
  '╚█████╗     ██║    ██║ ██║      █████╔╝  ██║ █████╗   ╚█████╗ ',
  ' ╚═══██╗    ██║    ██║ ██║      ██╔═██╗  ██║ ██╔══╝    ╚═══██╗',
  '██████╔╝    ██║    ██║ ╚██████╗ ██║  ██╗ ██║ ███████╗ ██████╔╝',
  '╚═════╝     ╚═╝    ╚═╝  ╚═════╝ ╚═╝  ╚═╝ ╚═╝ ╚══════╝ ╚═════╝ ',
];

const W = 66;
const border = '═'.repeat(W);
const blank = `║${''.padEnd(W)}║`;
const row = (s) => `║${'  ' + s}${' '.repeat(Math.max(0, W - 2 - s.length))}║`;

const lines = [
  '',
  `╔${border}╗`,
  blank,
  ...art.map(row),
  blank,
  row('▲ Next.js 16.1.6 (Turbopack)'),
  row(`  Local:    http://localhost:4444`),
  ...(lanIp ? [row(`  Network:  http://${lanIp}:4444`)] : []),

  blank,
  `╚${border}╝`,
  '',
];

process.stdout.write(B + C + lines.join('\n') + R + '\n');
