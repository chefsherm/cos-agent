// CC AI CEO — Action Ledger and enforcement boundary.
// propose → authorize → admit → execute once → record outcome.
// Every function takes a db adapter: { query(sql, params), transaction(fn) }.
// No db means fail closed: nothing external is admitted.

import { authorize, verifyAuthorization, contactKey, playbookCaps, actionHash, DECISIONS } from "./ceo.js";

const CIRCUMVENTION_WINDOW_DAYS = 7;
const SUMMARY_MAX = 280;

function iso(now) {
  return new Date(now).toISOString();
}

function deny(code) {
  return { ok: false, reason_codes: [code] };
}

function targetScope(action, key) {
  if (action.tool === "clickup") return `clickup:${action.workspace}/${action.listId ?? "-"}`;
  if (key) return `contact:${key.slice(0, 12)}`;
  return action.tool || null;
}

/**
 * Contact state read from shared records — suppression, touches across all
 * channels (in-flight admissions count), and recent Red or Prohibited
 * decisions for the same person through a different tool or operation.
 */
export async function getContactState(q, key, { playbook, tool, op, now = Date.now() } = {}) {
  if (!key) return null;
  const at = iso(now);
  const windowDays = playbookCaps(playbook)?.windowDays ?? 0;

  const sup = await q.query(
    `SELECT 1 FROM ceo_contact_suppression
      WHERE contact_key = $1 AND suppressed_at <= $2 AND (expires_at IS NULL OR expires_at > $2) LIMIT 1`,
    [key, at],
  );

  const touches = await q.query(
    `SELECT count(*) FILTER (WHERE a.created_at > $2::timestamptz - make_interval(days => $3)) AS in_window,
            max(a.created_at) AS last_at
       FROM ceo_attempts a LEFT JOIN ceo_outcomes o ON o.attempt_id = a.attempt_id
      WHERE a.contact_key = $1 AND a.created_at <= $2
        AND (o.attempt_id IS NULL OR o.terminal_state = 'committed')`,
    [key, at, windowDays],
  );

  const adverse = await q.query(
    `SELECT 1 FROM ceo_decisions
      WHERE contact_key = $1 AND decision IN ('ESCALATE', 'PROHIBITED')
        AND created_at > $2::timestamptz - make_interval(days => $3) AND created_at <= $2
        AND (tool IS DISTINCT FROM $4 OR operation IS DISTINCT FROM $5)
      LIMIT 1`,
    [key, at, CIRCUMVENTION_WINDOW_DAYS, tool ?? null, op ?? null],
  );

  const row = touches.rows[0] || {};
  const lastAt = row.last_at ? new Date(row.last_at).getTime() : null;
  return {
    suppressed: sup.rows.length > 0,
    touchesInWindow: Number(row.in_window || 0),
    hoursSinceLastTouch: lastAt === null ? null : (now - lastAt) / 3_600_000,
    circumventionSuspected: adverse.rows.length > 0,
  };
}

/**
 * Policy decision with ledger-backed contact state. Every decision is
 * recorded (hash and codes only). If an ALLOW cannot be recorded, it becomes
 * DENY — no token leaves without a receipt.
 */
export async function authorizeWithLedger(action, { db, now = Date.now(), ...opts } = {}) {
  const valid = action && typeof action === "object" && !Array.isArray(action);
  const key = valid && action.external === true ? contactKey(action.target) : null;

  let contactState = null;
  if (db && key) {
    try {
      contactState = await getContactState(db, key, { playbook: action.playbook, tool: action.tool, op: action.op, now });
    } catch {
      contactState = null;
    }
  }

  const decision = authorize(action, { ...opts, now, contactState });
  if (!db || !valid) return decision;

  try {
    await db.query(
      `INSERT INTO ceo_decisions (action_hash, contact_key, tool, operation, decision, tier, reason_codes, policy_version, stage, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [decision.authorization?.action_hash ?? actionHash(action), key, action.tool ?? null, action.op ?? null,
        decision.decision, decision.tier, decision.reason_codes, decision.policy_version, decision.stage, iso(now)],
    );
  } catch {
    if (decision.decision === DECISIONS.ALLOW) {
      const { token, authorization, ...rest } = decision;
      return { ...rest, decision: DECISIONS.DENY, reason_codes: ["LEDGER_UNAVAILABLE"] };
    }
  }
  return decision;
}

/**
 * Admission receipt. Run immediately before the provider call. In one
 * transaction: lock the contact, re-read contact state, verify the token
 * against it, and consume the token. A token admits exactly once, even under
 * concurrent calls. Returns the attempt_id the outcome receipt must cite.
 */
export async function admit(db, token, action, { now = Date.now(), ...opts } = {}) {
  if (!db) return deny("LEDGER_UNAVAILABLE");
  if (!action || typeof action !== "object" || Array.isArray(action)) return deny("MALFORMED_ACTION");

  const key = action.external === true ? contactKey(action.target) : null;
  try {
    return await db.transaction(async (tx) => {
      if (key) await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);

      // Report replay as replay. The jti is read unverified here only to pick
      // the reason code; the signature is checked below before anything is written.
      const jti = unverifiedJti(token);
      if (jti) {
        const seen = await tx.query("SELECT 1 FROM ceo_attempts WHERE authorization_jti = $1", [jti]);
        if (seen.rows.length) return deny("TOKEN_ALREADY_CONSUMED");
      }
      const contactState = key
        ? await getContactState(tx, key, { playbook: action.playbook, tool: action.tool, op: action.op, now })
        : null;

      const v = verifyAuthorization(token, action, { ...opts, now, contactState });
      if (!v.ok) return v;
      const c = v.authorization;

      const ins = await tx.query(
        `INSERT INTO ceo_attempts (authorization_jti, action_id, action_hash, issued_at, expires_at, agent_id,
           delegated_principal, tier, decision, policy_version, stage, tool, operation, contact_key, target_scope,
           playbook_id, reason_codes, required_controls, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ALLOW', $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (authorization_jti) DO NOTHING
         RETURNING attempt_id`,
        [c.jti, c.action_id, c.action_hash, c.issued_at, c.expires_at, c.agent_id, c.principal, c.tier,
          c.policy_version, c.stage, c.tool, c.operation, key, targetScope(action, key), c.playbook_id,
          c.reason_codes, c.required_controls, iso(now)],
      );
      if (ins.rows.length === 0) return deny("TOKEN_ALREADY_CONSUMED");
      return { ok: true, attempt_id: ins.rows[0].attempt_id, authorization: c };
    });
  } catch {
    return deny("LEDGER_UNAVAILABLE");
  }
}

function unverifiedJti(token) {
  try {
    const jti = JSON.parse(Buffer.from(String(token).split(".")[0], "base64url").toString("utf8")).jti;
    return /^[0-9a-f-]{36}$/.test(jti) ? jti : null;
  } catch {
    return null;
  }
}

const TERMINAL = ["committed", "failed", "blocked", "canceled"];

/**
 * Outcome receipt. Exactly one per attempt. A committed outreach outcome also
 * records a contact touch, which feeds the cross-channel cap.
 */
export async function recordOutcome(db, attemptId, outcome = {}, { now = Date.now() } = {}) {
  if (!db) return deny("LEDGER_UNAVAILABLE");
  if (!TERMINAL.includes(outcome.terminalState)) return deny("INVALID_TERMINAL_STATE");
  const summary = typeof outcome.resultSummary === "string" ? outcome.resultSummary.slice(0, SUMMARY_MAX) : null;
  const executedAt = outcome.executedAt ? iso(outcome.executedAt) : iso(now);

  try {
    return await db.transaction(async (tx) => {
      const a = await tx.query("SELECT tool, contact_key, playbook_id FROM ceo_attempts WHERE attempt_id = $1", [attemptId]);
      if (a.rows.length === 0) return deny("ATTEMPT_NOT_FOUND");

      const ins = await tx.query(
        `INSERT INTO ceo_outcomes (attempt_id, provider_request_id, provider_response_status, terminal_state,
           executed_at, failure_code, result_summary, incident_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (attempt_id) DO NOTHING
         RETURNING outcome_id`,
        [attemptId, outcome.providerRequestId ?? null, outcome.providerResponseStatus ?? null, outcome.terminalState,
          executedAt, outcome.failureCode ?? null, summary, outcome.incidentId ?? null, iso(now)],
      );
      if (ins.rows.length === 0) return deny("OUTCOME_ALREADY_RECORDED");

      const { tool, contact_key, playbook_id } = a.rows[0];
      if (outcome.terminalState === "committed" && contact_key) {
        await tx.query(
          `INSERT INTO ceo_contact_touches (contact_key, channel, playbook_id, attempt_id, sent_at, result)
           VALUES ($1, $2, $3, $4, $5, 'committed')`,
          [contact_key, tool, playbook_id, attemptId, executedAt],
        );
      }
      return { ok: true, outcome_id: ins.rows[0].outcome_id };
    });
  } catch {
    return deny("LEDGER_UNAVAILABLE");
  }
}

/**
 * Record an opt-out or stop condition. Takes effect for every channel at once.
 * There is deliberately no function to remove one.
 */
export async function suppress(db, target, { source, reason, recordedBy, evidenceRef = null, expiresAt = null, now = Date.now() } = {}) {
  if (!db) return deny("LEDGER_UNAVAILABLE");
  const key = contactKey(target);
  if (!key) return deny("TARGET_REQUIRED");
  if (!source || !reason || !recordedBy) return deny("SUPPRESSION_FIELDS_REQUIRED");
  try {
    const r = await db.query(
      `INSERT INTO ceo_contact_suppression (contact_key, source, reason, suppressed_at, expires_at, recorded_by, evidence_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING suppression_id`,
      [key, source, reason, iso(now), expiresAt ? iso(expiresAt) : null, recordedBy, evidenceRef],
    );
    return { ok: true, suppression_id: r.rows[0].suppression_id };
  } catch {
    return deny("LEDGER_UNAVAILABLE");
  }
}
