# CC AI CEO — framework in code

Source: "CC AI CEO — System Prompt and Decision Framework", Oct 2, 2026, Michael Sherman.
Board resolution: approved as Stage 1 policy infrastructure (read and draft only). Stage 2 is withheld until the gate sits in the execution path.

> The AI may propose. The gate decides. Only a controlled executor may act, and it must refuse to act without a fresh, valid gate authorization.

| File | Role |
|------|------|
| `lib/ceo-prompt.js` | The system prompt: mission, locked language, tiers, red lines, rollout stages. Guidance only. |
| `lib/ceo.js` | Deterministic policy engine. No model calls. Issues and verifies signed, single-use, action-bound authorizations. |
| `lib/ceo-ledger.js` | Enforcement boundary: ledger-backed contact state, atomic admission, outcome receipts, suppression. |
| `db/ledger.sql` | Append-only Action Ledger schema. UPDATE, DELETE, and TRUNCATE are refused by the database. |
| `test/` | Policy and ledger test matrix, the ledger tests on a real Postgres engine (PGlite). Run `npm test`. |

## The loop

propose → authorize → admit → execute once → record outcome

All endpoints require `Authorization: Bearer $CEO_API_SECRET` and fail closed when it is unset.

| Endpoint | Who calls it | What it does |
|---|---|---|
| `POST /api/ceo` | Sherm, the harness | Planning and drafting. Executes nothing. |
| `POST /api/ceo/authorize` | The agent | Decides. Reads suppression, cross-channel touches, and recent Red decisions from the ledger. Records every decision. Returns a token on ALLOW only. |
| `POST /api/ceo/admit` | The executor, immediately before the tool call | In one transaction: locks the contact, re-reads contact state, verifies the token, consumes it, writes the admission receipt. Returns `attempt_id`. |
| `POST /api/ceo/outcome` | The executor, immediately after | Writes the outcome receipt (one per attempt). A committed outreach send records a contact touch. |
| `POST /api/ceo/suppress` | The agent, the executor, a human | Records an opt-out or stop condition for every alias and channel at once. Nothing can lift it. |

Decision shape:

```json
{
  "decision": "ALLOW | DENY | ESCALATE | PROHIBITED",
  "tier": "GREEN | AMBER | RED | NONE",
  "reason_codes": ["STAGE_TOO_LOW", "MISSING_APPROVED_PLAYBOOK"],
  "required_controls": ["playbook", "action_log", "suppression_check", "frequency_cap_check", "log_immediately"],
  "policy_version": "2026-10-02+abc1234",
  "stage": 1, "paused": false,
  "token": "only on ALLOW",
  "escalation": "only on ESCALATE"
}
```

Token claims: jti (single-use ID), decision, tier, action ID, SHA-256 of the canonicalized action, contact key, policy version, principal, agent ID, tool, operation, target, playbook, stage, reason codes, required controls, issued and expiry times. HMAC-signed, five-minute TTL. Rotating `CEO_SIGNING_KEY` kills every outstanding token.

## Executor contract

- No `attempt_id` from `/admit`, no tool call. That covers an unreachable gate, an unavailable ledger, a missing signing key, an expired or replayed token, a changed action, a new opt-out, a reached cap, a pause, and a stage change.
- Execute exactly the action that was hashed. Any change means authorizing again.
- Always write the outcome, including failures. An admission without an outcome keeps counting against the contact's cap.
- Keep `resultSummary` free of message bodies and personal data. It is capped at 280 characters.

## Action Ledger

| Table | Contents |
|---|---|
| `ceo_decisions` | Every gate decision: action hash, contact key, tool, op, decision, tier, reason codes, policy version, stage. |
| `ceo_attempts` | Admission receipts. `authorization_jti` is UNIQUE, which makes token consumption atomic. |
| `ceo_outcomes` | Outcome receipts. `attempt_id` is UNIQUE and must reference an admission. |
| `ceo_contact_suppression` | Opt-outs and stop conditions by contact key. |
| `ceo_contact_touches` | Committed outreach touches by contact key and channel. |
| `ceo_corrections` | Human-only notes on earlier rows. The original row is never changed. |

- Append-only for every role, the owner included, by trigger.
- The app connects as `ceo_agent`: INSERT and SELECT only. Grants are at the bottom of `db/ledger.sql`.
- No message bodies, documents, vouch text, or raw addresses. Contacts are `sha256("cc-contact:" + normalized address)`. That is pseudonymous, not anonymous: anyone holding a candidate address can test for it.
- Aliases collapse before hashing: lowercase, `+tags` stripped on every domain, Gmail dots stripped, `googlemail.com` folded into `gmail.com`, LinkedIn URLs reduced to host and path. Over-matching only suppresses more.
- Caps count across every channel together, and in-flight admissions count before their outcome arrives. Failed, blocked, and canceled sends do not count.

## ClickUp authorization ceremony

Write access is scoped per list. A list must be in the code-reviewed register (`AUTHORITY_REGISTER.tools.clickup.lists`) and in `CC_CLICKUP_ALLOWED_LIST_IDS`.

| Workspace | List | ID | Register ops | Status |
|---|---|---|---|---|
| 90141390262 | CC Open Loops | 901418025585 | create_task, update_task, comment | In register. Awaiting Sherm's verification and env setting. |
| 90141390262 | Contact Spine | 901417767809 | none | Not in register. Holds contact data; needs a separate decision. |

To complete it:

- Open CC Open Loops in ClickUp and confirm the URL shows workspace 90141390262 and list 901418025585.
- Set `CC_CLICKUP_ALLOWED_LIST_IDS=901418025585` in Vercel.
- Run `npm test`. The ClickUp tests cover the exact ID, a near-match ID, a list in env but not in the register, the dev workspace, and every destructive op.
- Once the ledger is live, log one non-sensitive test task and confirm its admission and outcome receipts.

## How the engine decides

- Kill switch (`CEO_PAUSED=true`): DENY everything, Green included. Tokens issued before the pause stop verifying.
- PROHIBITED, even with Sherm's approval: any vouch action, pressuring a Referrer, fabrication, an inference presented as fact, protected traits, eligibility decisions, reading a sparse graph as low trust, an identity claim without source evidence, any ClickUp workspace other than `CC_CLICKUP_WORKSPACE_ID`, and ClickUp delete, move, permission, external share, cross-workspace copy, and attachment upload.
- ESCALATE (Red, `[NEEDS SHERM]`): the four gates, the six red-line categories, identity claims with evidence, unregistered or unconnected tools, external Drive sharing, Apollo enrichment and export, Gmail forwarding, ClickUp writes outside the approved lists, and anything not explicitly marked reversible, non-sensitive, and non-committing.
- Policy circumvention: declared circumvention is PROHIBITED. Detected deterministically and escalated: a Google Drive or Docs link anywhere in an external action, an attachment on an external action, an unregistered tool or op (Make, a rank or exclude op), and any action toward a person who drew an ESCALATE or PROHIBITED decision through a different tool or op in the past 7 days.
- ALLOW Green: an internal op registered as Green.
- ALLOW Amber: only with Stage 2 or later, an approved playbook with numeric caps (`maxTouches`, `windowDays`, `minHoursBetween`), every ledger field (including contact source and legitimate reason), and ledger contact state showing no suppression, cap headroom, the minimum delay met, and no stop condition. Executor attestations are not accepted.

What the engine cannot catch: a disguise that uses a registered op and clean fields — a vouch request reworded as a "quick confirmation", or an exclusion expressed as a neutral reordering. Those need content review and periodic human audit of the ledger.

Stage and pause come from server env only. Nothing in a request body can change them.

## Stage 2 prerequisites

| Prerequisite | Status |
|---|---|
| Append-only Action Ledger with admission and outcome receipts | Built and tested (`db/ledger.sql`, `lib/ceo-ledger.js`). Not deployed: needs a Postgres database and `CEO_LEDGER_DATABASE_URL`. |
| Atomic single-use tokens | Built and tested, including concurrent admission. |
| Shared suppression and contact-state store | Built and tested. Opt-outs from Gmail replies, Apollo, and Dripify still have to be written into it — nothing feeds it automatically yet. |
| Cross-channel no-duplicate-touch | Built and tested across channels and aliases, under concurrency. |
| Approved Referrer reactivation playbook with real numbers | Not written. `PLAYBOOKS` is empty. |
| Source-audited, suppression-checked pilot cohort | Not selected. |
| Executor integration (ClickUp logging first, then a capped Gmail pilot) | Not built. Nothing yet forces a connected tool through `/admit`. |
| Provider-level stop path for Apollo, Gmail, Dripify, Make, with credential revocation | Not built. `CEO_PAUSED` stops this app only. |
| Tested kill-switch runbook | Not written. |
| Protected runtime control for pause and stage | Not built. Env plus redeploy is acceptable for Stage 1 only. |
| Live-model structured-action and adversarial testing | Not done. |
| Director-facing Stage 2 activation record | Not written. |

## Naming

"Signal Scout" was renamed to "Bridge Signal" to keep the framework clear of the banned word "Scouts". The rename covers this repo only. Any tool label, Make scenario, ClickUp field, or prompt elsewhere that still says "Signal Scout" needs the same change.
