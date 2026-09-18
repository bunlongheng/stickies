# Contributing

Thanks for taking a look. Stickies is a personal project that happens to be open
source, so the bar is simple: leave it working, and leave it readable.

## Getting set up

```bash
git clone https://github.com/bunlongheng/stickies
cd stickies
npm install
cp .env.example .env.local   # then fill it in
npm run migrate              # create the schema
npm run dev                  # http://localhost:4444
```

`.env.example` documents every variable and is the source of truth: it marks which are
required for the app to run at all (database, session secret, owner identity, Google
OAuth) and which unlock optional integrations (Pusher real-time sync, Anthropic AI,
Google Drive uploads). Fill in the required block first.

## Before you open a pull request

```bash
npm run lint
npx tsc --noEmit
npm run test        # 754 unit + integration tests, no database required
npm run test:e2e    # Playwright, needs the app running on :4444
```

All four should be clean. The unit suite mocks the database, so it runs anywhere. The
e2e suite drives a real server against a real database and reuses whatever is already
serving port 4444, so start the app first.

If Playwright complains that a browser is missing, install it: `npx playwright install`.

## House rules

- **Keep changes small and focused.** One concern per pull request.
- **Match the surrounding style.** No reformatting of code you are not changing.
- **Comments explain why, not what.** If a line needs a comment to say what it does,
  the line is usually the problem.
- **Never commit secrets.** Everything comes from the environment. `.env*` is
  gitignored and should stay that way.
- **Add a test when you fix a bug.** The test should fail before your fix and pass
  after it.
- **Prefer accessibility-backed selectors in e2e tests** (`aria-label`, roles) over
  CSS classes. Classes get deleted by refactors; the accessible name does not.

## Reporting bugs

Open an issue with what you did, what you expected, and what happened instead. The
browser and whether it reproduces on a fresh load both help. For anything
security-related, follow [SECURITY.md](SECURITY.md) instead of filing a public issue.
