# Stickies - Collaborative Sticky Notes Board

A real-time, AI-powered sticky notes app with folder organization, markdown rendering, and cross-device sync.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 |
| Language | TypeScript, React 19.2.3 |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Google OAuth |
| Real-time | Pusher WebSockets |
| AI | Claude API (@anthropic-ai/sdk) |
| Email | Resend |
| Testing | Vitest + Playwright |
| Hosting | Vercel |
| Port | 4444 |

---

## Architecture

Next.js App Router with route groups: `(app)` for the main board, `sign-in` for auth, `share` for public note links, and `tools` for utilities. The API layer (`/api/stickies/*`) exposes a full REST interface for CRUD, AI generation, file uploads, backups, automations, and integrations. Pusher broadcasts mutations to all connected clients for real-time sync. Supabase handles persistence and auth, with localhost/LAN bypass for local development.

---

## Features

- Colorful draggable sticky notes with folder organization
- Real-time sync across devices via Pusher WebSockets
- AI-powered diagram generation (Mermaid) and content assistance via Claude
- Markdown rendering with code syntax highlighting (Prism.js, highlight.js)
- QR code sharing for individual notes
- PDF parsing and import
- Email sharing via Resend
- Google Drive integration and backup/restore
- Push notifications and automation workflows
- Full REST API for programmatic access (CLI: `npm run stickies`)
- Auth with Google OAuth + automatic localhost bypass for LAN

---

## Project Structure

```
app/
  (app)/                    # Main board (route group)
  api/
    auth/                   # OAuth callback, email check
    hue/                    # Smart light integration
    stickies/
      ai/                   # Claude-powered generation
      ai-mode/              # AI mode toggle
      automation-logs/      # Automation history
      automations/          # Scheduled workflows
      backup/               # Backup & restore
      ext/                  # Browser extension API
      folder-icon/          # Folder icon management
      gdrive/               # Google Drive sync
      img-proxy/            # Image proxy
      integrations/         # Third-party integrations
      local/                # Local-only endpoints
      magic/                # Magic link auth
      public/               # Public share endpoints
      push-nav/             # Push notification nav
      push-subscribe/       # Push subscription
      share/                # Share via link/email
      upload/               # File uploads
  share/                    # Public shared note page
  sign-in/                  # Auth page
  tools/stickies/           # Stickies tooling
```

---

## Scripts

```bash
npm run dev              # Start dev server on port 4444
npm run build            # Production build
npm run start            # Start production server
npm run prod             # Build + start on port 4444
npm run stickies         # CLI for posting notes
npm run test             # Run Vitest unit tests
npm run test:watch       # Vitest in watch mode
npm run test:coverage    # Vitest with coverage
npm run test:e2e         # Playwright end-to-end tests
npm run test:ui:headed   # Playwright with browser UI
npm run smoke            # Smoke test: signup flow
npm run smoke:images     # Smoke test: image handling
npm run smoke:flow       # Smoke test: user flow
npm run smoke:pages      # Smoke test: all pages
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API for AI features |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `DATABASE_URL` | Direct Postgres connection |
| `PUSHER_APP_ID` | Pusher app identifier |
| `PUSHER_KEY` | Pusher server key |
| `PUSHER_SECRET` | Pusher server secret |
| `PUSHER_CLUSTER` | Pusher cluster region |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher client key |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher client cluster |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `OWNER_EMAIL` | Owner email for admin features |
| `STICKIES_API_KEY` | API key for programmatic access |
| `RESEND_API_KEY` | Resend email service key |

---

Built by [Bunlong Heng](https://www.bunlongheng.com) | [GitHub](https://github.com/bunlongheng/stickies)
