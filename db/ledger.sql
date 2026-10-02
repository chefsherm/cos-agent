-- CC AI CEO — Action Ledger (append-only receipts).
-- Apply once as the database owner. Then connect the app as ceo_agent, which
-- can only INSERT and SELECT. Corrections are appended by ceo_admin (a human),
-- never by the agent. No row in any table is ever updated or deleted.
--
-- Privacy: no message bodies, documents, vouch text, or raw contact addresses.
-- Contacts are stored as contact_key = sha256 of the normalized address
-- (pseudonymous, not anonymous). Actions are stored as a canonical hash.

CREATE TABLE IF NOT EXISTS ceo_decisions (
  decision_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_hash      text NOT NULL,
  contact_key      text,
  tool             text,
  operation        text,
  decision         text NOT NULL CHECK (decision IN ('ALLOW', 'DENY', 'ESCALATE', 'PROHIBITED')),
  tier             text NOT NULL,
  reason_codes     text[] NOT NULL,
  policy_version   text NOT NULL,
  stage            int NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ceo_decisions_contact ON ceo_decisions (contact_key, created_at);

-- Admission receipt. Written before the provider call. The UNIQUE jti makes
-- token consumption atomic: a second admission with the same token fails.
CREATE TABLE IF NOT EXISTS ceo_attempts (
  attempt_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_jti   uuid NOT NULL UNIQUE,
  action_id           text,
  action_hash         text NOT NULL,
  issued_at           timestamptz NOT NULL,
  expires_at          timestamptz NOT NULL,
  agent_id            text NOT NULL,
  delegated_principal text NOT NULL,
  tier                text NOT NULL,
  decision            text NOT NULL CHECK (decision = 'ALLOW'),
  policy_version      text NOT NULL,
  stage               int NOT NULL,
  tool                text NOT NULL,
  operation           text NOT NULL,
  contact_key         text,
  target_scope        text,
  playbook_id         text,
  reason_codes        text[] NOT NULL,
  required_controls   text[] NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ceo_attempts_contact ON ceo_attempts (contact_key, created_at);

-- Outcome receipt. One per attempt, ever.
CREATE TABLE IF NOT EXISTS ceo_outcomes (
  outcome_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id               uuid NOT NULL UNIQUE REFERENCES ceo_attempts (attempt_id),
  provider_request_id      text,
  provider_response_status text,
  terminal_state           text NOT NULL CHECK (terminal_state IN ('committed', 'failed', 'blocked', 'canceled')),
  executed_at              timestamptz NOT NULL,
  failure_code             text,
  result_summary           text CHECK (char_length(result_summary) <= 280),
  incident_id              text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Opt-outs are permanent unless expires_at is set by a human-recorded reason.
CREATE TABLE IF NOT EXISTS ceo_contact_suppression (
  suppression_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_key    text NOT NULL,
  source         text NOT NULL,
  reason         text NOT NULL,
  suppressed_at  timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,
  recorded_by    text NOT NULL,
  evidence_ref   text
);
CREATE INDEX IF NOT EXISTS ceo_suppression_contact ON ceo_contact_suppression (contact_key);

CREATE TABLE IF NOT EXISTS ceo_contact_touches (
  touch_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_key text NOT NULL,
  channel     text NOT NULL,
  playbook_id text,
  attempt_id  uuid NOT NULL UNIQUE REFERENCES ceo_attempts (attempt_id),
  sent_at     timestamptz NOT NULL,
  result      text NOT NULL
);
CREATE INDEX IF NOT EXISTS ceo_touches_contact ON ceo_contact_touches (contact_key, sent_at);

-- Human-only corrections. The original row stays; this explains it.
CREATE TABLE IF NOT EXISTS ceo_corrections (
  correction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table  text NOT NULL,
  target_id     uuid NOT NULL,
  correction    text NOT NULL,
  recorded_by   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Append-only, enforced by the database for every role including the owner.
CREATE OR REPLACE FUNCTION ceo_ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ceo ledger is append-only: % on % refused', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ceo_decisions', 'ceo_attempts', 'ceo_outcomes', 'ceo_contact_suppression', 'ceo_contact_touches', 'ceo_corrections'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_no_mutation ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_no_mutation BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ceo_ledger_append_only()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I_no_truncate ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION ceo_ledger_append_only()', t, t);
  END LOOP;
END $$;

-- Roles (run once in production; skipped silently where roles can't be created):
--   CREATE ROLE ceo_agent LOGIN PASSWORD '...';
--   GRANT SELECT, INSERT ON ceo_decisions, ceo_attempts, ceo_outcomes,
--     ceo_contact_suppression, ceo_contact_touches TO ceo_agent;
--   CREATE ROLE ceo_admin LOGIN PASSWORD '...';
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO ceo_admin;
--   GRANT INSERT ON ceo_corrections, ceo_contact_suppression TO ceo_admin;
