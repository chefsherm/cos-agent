# CC AI CEO — framework in code

Source: "CC AI CEO — System Prompt and Decision Framework", Oct 2, 2026, Michael Sherman.

The framework lives in two places, and neither works alone:

| File | Role |
|------|------|
| `lib/ceo-prompt.js` | The system prompt. Tells the model the mission, locked language, tiers, red lines, and rollout stages. |
| `lib/ceo.js` | The policy gate. Classifies every proposed action as Green, Amber, Red, or Prohibited and decides whether it may run now. A prompt can be argued around; this cannot. |

## Endpoints

Both require `Authorization: Bearer $CEO_API_SECRET` and return 503 if the secret is unset.

- `POST /api/ceo` — `{ messages }` → `{ reply }`. Talks to the AI CEO. Returns text only and executes nothing.
- `POST /api/ceo/authorize` — a proposed action → `{ stage, paused, tier, allowed, log, reasons, escalation? }`. Any executor (agent harness, Make scenario, script) calls this before acting.

Action shape:

```json
{
  "id": "act_0001", "tool": "gmail", "op": "send", "account": "founder@…",
  "external": true, "reversible": true, "sensitiveData": false, "externalCommitment": false,
  "categories": [], "playbook": "referrer-reactivation-pilot",
  "target": "…", "contactSource": "…", "content": "…"
}
```

## How the gate decides

- Kill switch (`CEO_PAUSED=true`) blocks everything before classification.
- Prohibited, even with Sherm's approval: any vouch action, fabrication, and ClickUp workspace 9017065181.
- Red: any of the four gates or six red-line categories, any tool not connected (platform CRM, Dripify, Make), any op outside the Authority Register, and anything not explicitly marked reversible, non-sensitive, and non-committing. Unflagged means Red — that is the framework's uncertainty rule.
- Green: internal op listed as Green for a connected tool. Log after.
- Amber: external op listed as Amber, and only when all three hold: `CEO_STAGE >= 2`, the playbook exists in `PLAYBOOKS`, and every Action Ledger field is present. Log immediately.

`CEO_STAGE` and `CEO_PAUSED` are env vars on purpose: neither the model nor the app can change them. Advancing a stage or resuming after a pause is a redeploy that only Sherm makes.

## Stage 2 prerequisites — status

| Prerequisite | Status |
|---|---|
| Agent Authority Register | v1 baseline in `AUTHORITY_REGISTER`. Needs Sherm's review before Amber is enabled. |
| Action Ledger | Required fields enforced (`LEDGER_FIELDS`). No durable store yet — Amber cannot run without one. |
| Outreach Playbook with numbers | Not written. `PLAYBOOKS` is empty, so no Amber send can pass the gate even at Stage 2. |
| Kill-Switch Runbook | Not written. `CEO_PAUSED` halts this app only; it does not cancel queued Apollo or Gmail sends or deactivate Make scenarios. |
| Stage-gate metrics and thresholds | Not set. |

## Known limits

- This app has no ClickUp, Apollo, or Gmail connection of its own. The gate decides; the harness that holds those connectors must call it and obey it.
- The daily digest is not wired to cron. Without the ledger or the CC Open Loops log as input, a digest would be the model guessing at what moved.
