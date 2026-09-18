# Security Policy

## Supported versions

Stickies is a self-hosted application with no released versions: the `main` branch is
what is supported. Fixes land on `main`, so run the current `main`.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.

- Open a [private security advisory](https://github.com/bunlongheng/stickies/security/advisories/new) (preferred), or
- email **bheng.code@gmail.com** with `[security]` in the subject.

Include what you need to reproduce it: the endpoint or page, the request, and what
you observed versus what you expected. A proof of concept helps, but a clear
description is enough to get started.

This is a personal project, not a funded program - there is no bounty, and response
times depend on availability. Expect an acknowledgement within a week.

## Scope

Stickies is designed to be run by a single owner on their own infrastructure. The
areas most worth scrutiny:

- **The external API** (`/api/stickies/ext`). It authenticates bearer API keys against
  sha-256 hashes in the `api_keys` table. On production deployments a label gate
  restricts it further, and deletes are refused for every API key - they are
  owner-browser only.
- **Owner-gated auth.** NextAuth v5 with Google OAuth; a session is only treated as
  the owner when its email matches `OWNER_EMAIL`.
- **LAN trust.** `STICKIES_LAN_TRUST` lets the owner's own network reach the board
  without a key. It is intended for a private LAN, refuses to apply in production
  unless explicitly opted in, and should never be enabled on a public host.
- **Public share links** (`/share`, `/embed/note/[id]`), which expose a single note by
  design and should expose nothing else.

## Out of scope

- Anything requiring physical or shell access to the host.
- Findings that depend on the operator deliberately misconfiguring their own instance,
  such as exposing a LAN-trusted deployment to the public internet.
- Missing hardening headers with no demonstrated impact. The Content-Security-Policy
  currently ships in report-only mode on purpose (see `next.config.ts`).

## Handling of secrets

Every credential is read from the environment; none are committed. If you ever find a
key, token, or connection string in this repository or its history, treat that as a
vulnerability and report it through the channels above.
