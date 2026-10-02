# CC AI CEO — framework in code

Source: "CC AI CEO — System Prompt and Decision Framework", Oct 2, 2026, Michael Sherman.
Board resolution: approved as Stage 1 policy infrastructure (read and draft only). Stage 2 is withheld until the gate sits in the execution path.

> The AI may propose. The gate decides. Only a controlled executor may act, and it must refuse to act without a fresh, valid gate authorization.

| File | Role |
|------|------|
| `lib/ceo-prompt.js` | The system prompt: mission, locked language, tiers, red lines, rollout stages. Guidance only. |
| `lib/ceo.js` | Deterministic policy engine. No model calls. Issues and verifies signed, action-bound authorizations. |
| `test/ceo.test.mjs` | Policy test matrix. Run `npm test`. |

## Endpoints

All require `Authorization: Bearer $CEO_API_SECRET` and fail closed when it is unset.

- `POST /api/ceo` — `{ messages }` → `{ reply }`. Planning and drafting. Executes nothing.
- `POST /api/ceo/authorize` — a normalized action → a decision. Policy decision point.
- `POST /api/ceo/verify` — `{ token, action }` → `{ ok, reason_codes }`. For executors that cannot import `lib/ceo.js`.

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

On ALLOW the token is an HMAC-signed claim set: decision, tier, action ID, SHA-256 of the canonicalized action, policy version, principal, agent ID, tool, operation, target, playbook, stage, issued and expiry times. Tokens live five minutes.

## Executor contract

The component that holds a credential (Gmail, Apollo, ClickUp, Calendar, Drive, Make) must follow this order on every action:

- Build the normalized action.
- Call `authorize`. Anything other than ALLOW stops here.
- Immediately before the tool call, call `verifyAuthorization(token, action)`. It re-checks signature, expiry, policy version, stage, pause state, the action hash, and the current policy decision. Any failure stops here.
- Reject an `action_id` the Action Ledger has already recorded (replay).
- Write the attempt to the Action Ledger. A failed write stops here.
- Run exactly the action that was hashed. Any change to recipient, content, attachment, playbook, or tool means authorizing again.
- Write the outcome, provider ID, and timestamp to the ledger.

No gate response, an unreachable gate, or a missing signing key all mean no action.

## How the engine decides

- Kill switch (`CEO_PAUSED=true`): DENY everything, Green included. Tokens issued before the pause stop verifying.
- PROHIBITED, even with Sherm's approval: any vouch action, pressuring a Referrer, fabrication, an inference presented as fact, protected traits, eligibility decisions, reading a sparse graph as low trust, an identity claim without source evidence, any ClickUp workspace other than `CC_CLICKUP_WORKSPACE_ID`, and ClickUp delete, move, permission, external share, cross-workspace copy, and attachment upload.
- ESCALATE (Red, `[NEEDS SHERM]`): the four gates, the six red-line categories, identity claims with evidence, unregistered or unconnected tools, external Drive sharing, Apollo enrichment and export, Gmail forwarding, ClickUp writes outside the approved lists, and anything not explicitly marked reversible, non-sensitive, and non-committing.
- ALLOW Green: an internal op registered as Green.
- ALLOW Amber: only with Stage 2 or later, an approved playbook in `PLAYBOOKS`, every ledger field (including contact source and legitimate reason), suppression, cap, and overlap checks attested, and a known recipient status that is not a stop condition.

Stage and pause come from server env only. Nothing in a request body can change them.

## Stage 2 prerequisites

| Prerequisite | Status |
|---|---|
| Approved Referrer reactivation playbook with caps, timing, stop conditions, templates, escalation criteria | Not written. `PLAYBOOKS` is empty. |
| Source-audited, suppression-checked pilot cohort from the 184 Referrers | Not selected. |
| Durable Action Ledger (attempts, authorizations, sends, provider responses, opt-outs, corrections) | Not built. Field requirements are enforced; storage and replay rejection are not. |
| Executor integration that verifies a fresh token before every send | Not built. The gate decides; nothing yet forces a connected tool through it. |
| Provider-level stop path for Apollo, Gmail, and later Dripify and Make | Not built. `CEO_PAUSED` stops this app only. |
| Tested kill-switch runbook with owner, invocation, disablement time, resumption | Not written. |
| Protected runtime control for pause and stage (authenticated, audited, immediate, default-deny) | Not built. Env plus redeploy is acceptable for Stage 1 only. |
| Cross-channel no-duplicate-touch mechanism | Attested by the executor (`noOverlappingSequence`); no shared store yet. |
| Live-model adversarial testing of the model-to-action normalization layer | Not done. Deterministic engine tests pass. |
| Director-facing Stage 2 activation record (cohort, caps, metrics, rollback criteria) | Not written. |

## Naming

"Signal Scout" was renamed to "Bridge Signal" to keep the framework clear of the banned word "Scouts".
