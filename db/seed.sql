-- Seed the ten named lineages (Tier-0 anchors).
-- These are the canonical anchors from which Vouch Number is computed.
-- Do not expand this list without explicit instruction.

INSERT INTO lineages (name, anchor_name) VALUES
  ('Thomas Keller',      'Thomas Keller'),
  ('Jean-Georges',       'Jean-Georges Vongerichten'),
  ('Daniel Boulud',      'Daniel Boulud'),
  ('Gray Kunz',          'Gray Kunz'),
  ('Danny Meyer',        'Danny Meyer'),
  ('Will Guidara',       'Will Guidara'),
  ('Major Food Group',   'Major Food Group'),
  ('Gabriel Kreuther',   'Gabriel Kreuther'),
  ('Bouley',             'David Bouley'),
  ('Charlie Palmer',     'Charlie Palmer')
ON CONFLICT (name) DO NOTHING;
