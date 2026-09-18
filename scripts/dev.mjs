#!/usr/bin/env node
import { spawn } from 'child_process'
import os from 'os'

function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return null
}

const lanIp = getLanIp() ?? '0.0.0.0'

const proc = spawn(
  'next',
  ['dev', '--port', '4444', '--hostname', '0.0.0.0'],
  {
    env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    stdio: ['inherit', 'pipe', 'pipe'],
  }
)

const patch = (stream, data) => {
  stream.write(data.toString().replaceAll('0.0.0.0', lanIp))
}

proc.stdout.on('data', (d) => patch(process.stdout, d))
proc.stderr.on('data', (d) => patch(process.stderr, d))
proc.on('exit', (code) => process.exit(code ?? 0))
