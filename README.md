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

The data layer can also run as a standalone service. See [Running against stickies-api](#running-against-stickies-api).

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

## Running against stickies-api

The API lives in its own repo at [`stickies-api`](../stickies-api/README.md), a
6-dependency Hono service. `stickies-native` already calls it; this app can too.
One variable decides:

```bash
# .env.local
NEXT_PUBLIC_STICKIES_API_BASE=http://localhost:4446
```

Unset, this app serves itself from `app/api/stickies/*` exactly as it always
has, and the 755-test suite covers that path. Set, every client call goes to the
service instead and the local route handlers go unused.

| Piece | What it does |
|---|---|
| `lib/api-client.ts` | The seam. Rewrites `/api/stickies` to `/notes`, attaches the bearer token. |
| `lib/fetch-retry.ts` | Routes through the seam, so its call sites needed no edit. |
| `lib/realtime-channel.ts` | One `bind`/`close` interface over Pusher **or** SSE, picked by the same flag. |

`useRealtimeSync` did not change: it binds the same event names either way.
When the flag is on, realtime is an `EventSource` against `/live` and Pusher is
never constructed, which drops a paid dependency and the 10KB event ceiling that
made notes over 10KB silently fail to arrive live.

`/api/auth/*` is excluded from the rewrite on purpose. NextAuth owns the sign-in
pages and the session cookie, and stays here.

**The service has to be running.** With the flag set and nothing on that port the
board comes up empty, which is why it ships commented out in `.env.local`.

## Tech stack

Next.js 16 · React 19 · TypeScript · PostgreSQL (`pg`, no ORM) · NextAuth v5 · Pusher · Tailwind · TipTap · Vitest + Playwright

Optionally [`stickies-api`](../stickies-api/README.md) in place of the built-in routes: Hono · SSE · JWT.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and the checks to run. Security issues go through [SECURITY.md](SECURITY.md), never a public issue.

## License

[MIT](LICENSE) (c) Bunlong Heng

---

<div align="center">

<a href="https://bunlongheng.com"><img src="https://img.shields.io/badge/-bunlongheng.com-3A3A3C?style=for-the-badge&amp;labelColor=2A2A2C&amp;logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y%2BmAAADAFBMVEXx8vLq6v%2F19fX09PT8%2Ff309PT5%2BfnAwMBMaXHx8vL19fX5%2Bfny8vL09PT39%2Ff6%2Bfn6%2Bvr09PTx8fH4%2BPn%2F8vLy8%2FP09PTz8%2FPy8vL%2F%2F%2F%2Fz9PTz9PP19fby8vP19PXz8%2FT19%2Fb08%2FTx8vLy8vL09vby8%2FL29vf19fTv8PDz9vb7%2Bvn%2F%2Ff%2F9%2Ff3w8vH29fb%2F%2FP339%2Ff5%2Bfn59%2Ff19PT09PR7rao3VF3%2F%2Fv8AKDR6sqsBV1vv8fL4%2BPiux8b8%2Bvq90NDy8%2FR%2BlpppnZyZqrACLTxclZJSkI9en5ssZ2luqaUAeWgqbW4BX1gCfG0%2Fa3QaVG0MN0UKNUKUpKsGpYMAKjoRQ1UDf3AQRloJqIgEm32d0cUBg3ElbnQIln8eVWgrmIdP0KzF5d5s2acdfHwppJCP5MMXl4Tz8%2FLv8%2FP39%2FiewL5%2BqahYf4IrTFZkk5KlxsREiIYAHiqDnKFmnJowc3IdVllvpKK7zc3D2tnk5%2BmuycdwpKKuub2yv8Ly%2B%2FkAMT7z%2Bvjq7e09gH93q6kGdWpGgoJZmJSlw8M7c3WwyceTw76w1M8mYmpFfX8lW2AFOEpGiYhxqqRrqaRb2rdIsZ8AVE91jpU7d3t3saqBoKhako4AWVEcUlg3aWwDupAHb2YwmIkPP1ERSVA7WmZ8tq8HT14oZW%2BYuLsMl3wQT10ROksENUc8Z3MJSGVLh4dqpJ%2BXr7U51awUgHM4v6ad1MkPuJZAiowVd3IEhnZH0aoYrI05p5sDtYwkzZ8EPViYxsRel5USbHAIgmwIM0gQamzU4uF2malQi4oWQFQ1zaYrp4UXlYwfiHoyxqFE1q4qeX4yn5JIxKkdrX1b1rAbWGvd5Oh91sRijpomsJEVc3Ukc34dqIcwuJVKwZIXkoQZcXlNv5g%2BqZUZvpNl2rPG9N0WkIoNqouW4sVPwp%2BM0b6h0ssfq4d%2F1r8hpo%2Fh9e4AamUjnI9avaBixqgklYWSwL4xtItUxplYl5qZ58mq78wMgnYXfnlOmJaR1L%2Bj78ny9fS%2FrXQPAAAAFXRSTlP7Brvx%2FsJhAgD87r4U72C4uGH8vhRDodYHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC6UlEQVQokS2Sd3BUVRSHb0KS3QRCiZw5t%2By9j33zXjZkyUs2uekhEAi9dwRCL4JUEQRFAQUs9A4WOopKU0GpFoqCBZUivaqoFKkWLIS5GX7%2FfnPO78yZj%2Fj8UTViK6HggvNgSGuluEZRKbZqlN9H%2FFWiWUzIFQK5fhjOIRTDoqv4ia86S4q3KSByHdSqIhxofBKr5iNxLMm2bQqWVkorJ%2BAkO46nkQJhceSRmCTDvKJIJBLJzMxMLU6POJ4eBPF1KpNEbdt2Cms4LCcnZ%2FX6D3d%2BsKJJ7VSlNLoqgbjUtmkKKxlVmpf3bsFXW3d1b77gueJAQIPQBCilkMKemNi23Ts9T35%2FaMe2rsvmTypylGUFCSIYWJLXrm2nUwOPfNO5w%2B73Okxnjqe0JigQEL3JizoeONr%2F2u99vju4fd1rdZnyspQmnGvAUBprWNqz348%2FhXN%2F6P1%2By4Uvs%2FJkpRQRwpJBRVn7vf16Dfitz5XevQqWt3yalXtKaRIUQmglWfsu5y7%2BMrDs0TMftWo1ZVy64xioOVpcIdt8%2Fvqvf9%2F859KJsrLmrzA%2BOKC0IkFEtJza7JOfr%2FYd0P9G98tdOxe0Hp9qJrOIBgDuOeEtp%2F%2B4d%2FvWX%2F%2F9u%2B%2FtlaUTmOWZg7SQEEyuFe52%2BML9O3cZO%2F5xl06zn2VcadOJUqJTzt7a82XfP7sx9vmGNm1m1MstV4IHCVAAoTLqL1372ddn%2Fz%2B2v%2FWq12c1fSpsaeQWAZAANntxzuI3e3zbo8XGpm%2FMnNqiXrh%2BljaPd6UUabkjps19tdGnX2zKb9b4pTFDCzOMLmYtpW5h%2BpCRTeYtyV%2BT36zx808OL4xYGoFrkqDTbJpSXLdRgwbPZL%2BQnT129OOPFVEEsAMJpHKdeKMJgJSAiALdjJANQKnRJI4R6boAKEwLCiGoBBegQjBftQo1KQWOlplFKSV9qGaF1NpAE7QQESTlMSy6pp%2F4%2FFFVYxMNRBTaiM0tkImxNaL8vgfDR8gvoYRaxgAAAABJRU5ErkJggg%3D%3D" alt="bunlongheng.com"></a>
<a href="https://www.linkedin.com/in/bunlongheng/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://www.instagram.com/ibunlong/"><img src="https://img.shields.io/badge/Instagram-C13584?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
<a href="mailto:bheng.code@gmail.com"><img src="https://img.shields.io/badge/Email-2E7D32?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"></a>

<br>

Built by **[Bunlong](https://bunlongheng.com)** &nbsp;·&nbsp; [more apps](https://bunlongheng.com/projects)

</div>
