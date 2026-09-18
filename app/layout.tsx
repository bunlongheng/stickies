import type { Metadata } from 'next'
import './globals.css'
import { BOOT_WATCHDOG } from '@/lib/boot-watchdog'
import BootBeacon from '@/components/BootBeacon'
import BuildWatch from '@/components/BuildWatch'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const metadata: Metadata = {
  title: 'Stickies',
  description: 'Your personal sticky notes board',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

// Read once per process: a rebuild restarts the server, so this cannot go stale
// within a process. It is the id the document was SERVED with, which is exactly
// what BuildWatch compares against the live one.
let SERVED_BUILD_ID = ''
try { SERVED_BUILD_ID = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() } catch { /* dev or bundled */ }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/stickies.webmanifest" />
        <link rel="icon" href="/icons/stickies/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/stickies/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Stickies" />
        <meta name="theme-color" content="#000000" />
        {/* Runs in BOTH dev and prod: React is exactly what is missing when the screen goes white. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_WATCHDOG }} />
      </head>
      <body suppressHydrationWarning>
        <BootBeacon />
        <BuildWatch current={SERVED_BUILD_ID} />
        {children}
        <script dangerouslySetInnerHTML={{
          // Production: NO service worker. public/sw.js was removed in ba94c80; the old
          // register('/sw.js') fetched a 404 HTML page and failed on every load.
          // Dev: never register it (a SW intercepting Turbopack's hot chunks goes
          // stale on every HMR/restart and serves a broken shell = white screen on
          // every note). Actively tear down any SW + caches left from a prior prod
          // visit so the broken state self-heals on the next dev load.
          // Dev teardown SELF-HEALS: a zombie SW from a prior build serves a stale
          // broken shell (white screen on every note) BEFORE this script even runs, so
          // merely unregistering isn't enough — the current page is already broken.
          // After we tear down any SW + caches, force ONE clean reload (sessionStorage
          // guard prevents a loop) so the fresh chunks load and the white screen heals.
          __html: process.env.NODE_ENV === "production"
            ? ``
            : `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){var had=rs.length>0;Promise.all(rs.map(function(r){return r.unregister()})).then(function(){if(window.caches){return caches.keys().then(function(ks){if(ks.length)had=true;return Promise.all(ks.map(function(k){return caches.delete(k)}))})}}).finally(function(){if(had&&!sessionStorage.getItem('sw-healed')){sessionStorage.setItem('sw-healed','1');location.reload()}})})}`
        }} />
      </body>
    </html>
  )
}
