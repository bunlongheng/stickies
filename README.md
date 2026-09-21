<div align="center">

# <img src="docs/icon.png" width="36" height="36" align="top" alt=""> Stickies

**A self-hosted sticky-notes board that syncs across every device you own.**

Colourful, draggable notes with folders, rich HTML content, a REST API, and real-time sync.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-required-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-754%20unit%20%2B%2091%20e2e-34C759)

<img src="docs/screenshots/hero.png" alt="Stickies: the folder board, colour-coded with note counts" width="900">

</div>

## Read this before you clone

**This will not work out of the box.** It is self-hosted: you run it on infrastructure you provide.

| You provide | Why | Free option |
|---|---|---|
| **PostgreSQL** | Every note, folder and session lives here. No bundled DB, no SQLite fallback | local, Neon, Supabase, Railway |
| **Google OAuth** | The only sign-in provider. Without it you cannot log in | Google Cloud Console |
| **A host** | A Next.js server, not a static site | Vercel free tier, or localhost |

**Your notes live in your database.** Nothing reaches a service of mine, and there is no account with anyone. Backups, uptime and cost are equally yours.

**Single-owner by design.** Only the Google account matching `OWNER_EMAIL` can sign in. No sign-up, no multi-user mode. If you want a board several people log into, this is the wrong repo.

**Optional:** Pusher (without it, no live updates), an Anthropic key (no AI bar), Google Drive (no uploads).

## Features

- Colourful, draggable notes in nestable folders; plain text, checklists or rich HTML
- Real-time sync across your devices over WebSockets
- A REST API and a CLI, so scripts and agents can read and write notes
- Scoped API keys: per-app, stored hashed, revocable one at a time
- Public share links and embeddable single notes
- Soft delete to TRASH with a 7-day window; `Cmd+Delete` skips the confirm

## Quick start

```bash
git clone https://github.com/bunlongheng/stickies.git
cd stickies
npm install
cp .env.example .env.local     # then fill in the REQUIRED block
npm run migrate                # create the schema in your database
npm run dev                    # http://localhost:4444
```

`npm run migrate` applies every unrun file in `supabase/migrations/` in order and
records it in a `schema_migrations` ledger, so it is safe to re-run. Against a
database that already has a `stickies` table it baselines instead, marking the
existing migrations as applied without executing any SQL.

If the app starts but every request fails, `DATABASE_URL` is almost certainly wrong -
the connection pool throws on its first query rather than at boot.

## Configuration

`.env.example` documents every variable. Required to boot: `DATABASE_URL`, `AUTH_SECRET`,
`OWNER_EMAIL`, `OWNER_USER_ID`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
Set `DATABASE_CA_CERT` too, or remote Postgres TLS goes unverified.

## Architecture

A Next.js App Router app talking to Postgres through `pg`, broadcasting every change over Pusher. Two auth paths: a browser owner session, and bearer API keys for scripts.

<a href="https://flows-bheng.vercel.app/?id=725b4551-4440-49b6-a90b-d9fcadef7cbb">
  <img src="docs/diagrams/architecture.svg" alt="Stickies architecture" width="820">
</a>

<sub>Diagram made with [Flows](https://flows-bheng.vercel.app).</sub>

## How a note is saved

<a href="https://sequences-bheng.vercel.app/d/c974e83b-441b-4535-990f-38629466bdf7">
  <img src="docs/diagrams/save-flow.svg" alt="Sequence: saving a Stickies note" width="760">
</a>

Autosave is deliberately off for plain-text and checklist notes: they save on `Cmd+S`.
Rich-text notes debounce-save as you type.

<sub>Made with [Sequences](https://sequences-bheng.vercel.app).</sub>

Autosave is off for text and checklist notes on purpose: they save on `Cmd+S`. Rich text debounces as you type.

## Tech stack

Next.js 16 · React 19 · TypeScript · PostgreSQL (`pg`, no ORM) · NextAuth v5 · Pusher · Tailwind · TipTap · Vitest + Playwright

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and the checks to run. Security issues go through [SECURITY.md](SECURITY.md), never a public issue.

## License

[MIT](LICENSE) (c) Bunlong Heng

---

<div align="center">

<a href="https://bunlongheng.com"><img src="https://img.shields.io/badge/bunlongheng.com-3A3A3C?style=for-the-badge&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWAQMAAAD+ev54AAAABlBMVEVMaXH///+a4ocPAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAD6AAAA+gBtXtSawAAAC1JREFUCNdjYEADzP+A+D8INzAwvwfi4w0QNlCMcX8DAyOQzfgcKgcVB+lBAwANvRHlhhcQugAAAABJRU5ErkJggg==" alt="bunlongheng.com"></a>
<a href="https://www.linkedin.com/in/bunlongheng/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://www.instagram.com/ibunlong/"><img src="https://img.shields.io/badge/Instagram-C13584?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
<a href="mailto:bheng.code@gmail.com"><img src="https://img.shields.io/badge/Email-2E7D32?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"></a>

<br>

Built by **[Bunlong](https://bunlongheng.com)** &nbsp;·&nbsp; [more apps](https://bunlongheng.com/projects)

</div>
