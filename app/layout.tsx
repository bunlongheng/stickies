import type { Metadata } from 'next'
import './globals.css'

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
        <meta name="theme-color" content="#FFCC00" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')`
        }} />
      </body>
    </html>
  )
}
