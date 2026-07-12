-- Candidate Collective — Vouch Graph relational model
-- Postgres. Trust distance is the scored signal, modeled on the Erdős Number.
--
-- Design note: vouch scoring lives in its own table (vouch_scores), separate
-- from user profiles, so lineage edges can be recomputed without touching core
-- user data. Do not fold vouch_number back onto the users table.

-- ---------------------------------------------------------------------------
-- Core identity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  -- Cross-functional sourcing rule hinges on this. 'foh' = front-of-house,
  -- 'boh' = back-of-house. Enforced in matching logic, not just copy.
  side            TEXT NOT NULL CHECK (side IN ('foh', 'boh')),
  role_title      TEXT,
  current_employer TEXT,
  -- Operators post roles; everyone can be a Referrer.
  is_operator     BOOLEAN NOT NULL DEFAULT FALSE,
  is_referrer     BOOLEAN NOT NULL DEFAULT TRUE,
  -- ClickUp Contact Spine linkage (workspace 90141390262 only).
  clickup_task_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Lineage anchors — the ten named Tier-0 anchors
-- ---------------------------------------------------------------------------
-- Every user sits in a graph modeled on the Erdős Number. Vouch Number is
-- computed from proximity to these Tier-0 anchors across ten lineages.
CREATE TABLE IF NOT EXISTS lineages (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,   -- the lineage's canonical name
  anchor_name TEXT NOT NULL,          -- the Tier-0 anchor person/house
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Vouch edges — the peer-vouching graph
-- ---------------------------------------------------------------------------
-- A directed edge: voucher vouched for vouchee. This is the graph over which
-- trust distance is measured. The AI never creates these — vouching is human.
CREATE TABLE IF NOT EXISTS vouch_edges (
  id          BIGSERIAL PRIMARY KEY,
  voucher_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vouchee_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Free-text context on the vouch ("worked the line together at ...").
  context     TEXT,
  -- Edge strength 1-5, used to weight distance when recomputing scores.
  strength    SMALLINT NOT NULL DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (voucher_id <> vouchee_id),
  UNIQUE (voucher_id, vouchee_id)
);
CREATE INDEX IF NOT EXISTS idx_vouch_edges_voucher ON vouch_edges(voucher_id);
CREATE INDEX IF NOT EXISTS idx_vouch_edges_vouchee ON vouch_edges(vouchee_id);

-- ---------------------------------------------------------------------------
-- Vouch scores — recomputable, separate from user data
-- ---------------------------------------------------------------------------
-- One row per (user, lineage). vouch_number is the trust distance (hops,
-- weighted by edge strength) from the user to that lineage's Tier-0 anchor.
-- Lower is closer. NULL / absent means no known path.
-- This table can be truncated and rebuilt from vouch_edges + lineages without
-- any write to users.
CREATE TABLE IF NOT EXISTS vouch_scores (
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lineage_id   BIGINT NOT NULL REFERENCES lineages(id) ON DELETE CASCADE,
  vouch_number NUMERIC(6,2) NOT NULL,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lineage_id)
);
CREATE INDEX IF NOT EXISTS idx_vouch_scores_lineage ON vouch_scores(lineage_id, vouch_number);

-- ---------------------------------------------------------------------------
-- Role postings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_postings (
  id           BIGSERIAL PRIMARY KEY,
  operator_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  -- The side the ROLE is for. Cross-functional rule surfaces Referrers from
  -- the OPPOSITE side.
  side         TEXT NOT NULL CHECK (side IN ('foh', 'boh')),
  venue        TEXT NOT NULL,
  -- Optional lineage focus — surface people close to this lineage.
  lineage_id   BIGINT REFERENCES lineages(id) ON DELETE SET NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'matched', 'closed')),
  clickup_task_id TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_postings_operator ON role_postings(operator_id);

-- ---------------------------------------------------------------------------
-- Match states — the canonical match flow
-- ---------------------------------------------------------------------------
-- Flow: surfaced -> conversation -> proof_step (trail/tasting) -> hired.
-- 'passed' is a terminal off-ramp. No email touches this sequence; everything
-- is in-app or via appointment booking.
CREATE TABLE IF NOT EXISTS match_states (
  id            BIGSERIAL PRIMARY KEY,
  role_id       BIGINT NOT NULL REFERENCES role_postings(id) ON DELETE CASCADE,
  candidate_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The Referrer who surfaced / introduced this candidate.
  referrer_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  state         TEXT NOT NULL DEFAULT 'surfaced'
                  CHECK (state IN ('surfaced', 'conversation', 'proof_step', 'hired', 'passed')),
  -- Proof step is a trail or tasting for culinary roles.
  proof_type    TEXT CHECK (proof_type IN ('trail', 'tasting')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_match_states_role ON match_states(role_id);
CREATE INDEX IF NOT EXISTS idx_match_states_referrer ON match_states(referrer_id);
CREATE INDEX IF NOT EXISTS idx_match_states_hired ON match_states(state) WHERE state = 'hired';
