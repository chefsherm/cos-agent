# Candidate Collective — platform

Trust infrastructure for hospitality, built on peer vouching — not vetting.
This rebuild puts the manual broker layer back, at scale, powered by AI, without
ever pretending the AI is the one vouching.

> **Mission (locked):** Candidate Collective's mission is to connect the people
> who build hospitality — with trust as the only currency.

## What's here

| Path | What it is |
|------|-----------|
| `/` | Landing page — hero + mission, stat bar, four-step match flow, "Signal, not applications", case studies, closing CTA. Dark palette. |
| `/signup`, `/login` | Auth scaffold (scrypt password hashing, signed-cookie sessions). |
| `/post-role` | Role-posting form. Surfaces opposite-side Referrers per the cross-functional rule. |
| `/dashboard` | Operator dashboard — roles, one-click referrer surfacing, reactivation-nudge drafts. |
| `/cos` | The original CoS Agent (Chief of Staff for Sherm), preserved. |

## The Vouch Graph

Every user sits in a graph modeled on the Erdős Number — trust distance is the
scored signal. Vouch Number is computed from proximity to ten Tier-0 anchors
(Thomas Keller, Jean-Georges, Daniel Boulud, Gray Kunz, Danny Meyer, Will
Guidara, Major Food Group, Gabriel Kreuther, Bouley, Charlie Palmer).

Scoring lives in its own table (`vouch_scores`), separate from user profiles, so
lineage edges can be recomputed (`lib/vouchGraph.js#recomputeVouchScores`)
without touching core user data.

- **Schema:** `db/schema.sql` — `users`, `lineages`, `vouch_edges`,
  `vouch_scores`, `role_postings`, `match_states`.
- **Seed:** `db/seed.sql` — the ten lineages.
- **Migrate:** `DATABASE_URL=… npm run db:migrate`

## AI layer — two functions only (`claude-sonnet-4-6`)

1. **Referrer-surfacing engine** (`lib/ai/referrer.js`, `POST /api/referrers`) —
   given a posted role, ranks people most likely to *know* the right candidate,
   weighted by vouch distance, lineage proximity, and the cross-functional rule.
   Recommends *who to ask*. Never scores or certifies a candidate.
2. **Reactivation engine** (`lib/ai/reactivation.js`, `GET /api/reactivation`) —
   finds dormant high-value Referrers and **drafts** a check-in nudge for Sherm
   to review and send manually. Never auto-sends.

Both degrade gracefully to the raw graph ranking when `ANTHROPIC_API_KEY` is unset.

## ClickUp CRM spine — with a hard block

`lib/clickup.js` reads from and writes to workspace **90141390262 only**.
Workspace **9017065181** is hard-blocked at two layers:

- **Runtime:** `assertWorkspaceAllowed()` throws on any request referencing it.
- **Build:** `scripts/check-workspace-guard.js` runs as `prebuild` and fails
  `npm run build` if the blocked ID appears anywhere outside the guard.

## Cross-functional sourcing rule

Enforced in the matching query itself (`lib/vouchGraph.js#surfaceReferrers`),
not filtered after the fact: front-of-house users are only surfaced as Referrers
for back-of-house searches, and back-of-house users only for front-of-house
searches.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY, CLICKUP_API_TOKEN
npm run db:migrate
npm run dev
```

## Design system

Background `#0A0A12`, cream type `#F0EDE4`, gold accent `#B8962E`. Cormorant
Garamond for display, Inter for body/UI (`app/cc.css`, scoped under `.cc-root`).
No teal, no bright-white backgrounds.

## Open flags

See **[FLAGS.md](./FLAGS.md)** — points where real data/assets were missing and
were surfaced rather than faked (two hero stat numbers, the logo asset).
