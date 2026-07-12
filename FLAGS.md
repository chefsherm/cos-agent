# Conflicts flagged, not silently softened

The brief instructs: "Anywhere the reference page's conversion pattern would
require language CC's vocabulary rules forbid, flag it instead of silently
softening it — don't guess at a workaround without surfacing the conflict
first." These are the points where the brief's requirements couldn't be met
with real data / assets, or where the reference pattern collided with CC's
rules. Each is surfaced here rather than papered over.

## 1. Two of the four hero stat numbers are not provided (data gap)

The brief specifies four hero numbers, "all real CC data, not invented
placeholders":

| Stat | Status |
|------|--------|
| Time to first vouch | **Not provided anywhere in the brief.** |
| 100+ peer-vouched matches (millions in salary value) | Locked fact — used verbatim. |
| Trail/tasting proof step (free-trial equivalent) | **No figure provided.** |
| 690+ people across ten lineages | Locked fact — used verbatim. |

Because inventing placeholders is explicitly forbidden, the two missing
numbers are rendered as "—" with a visible `Sourced · pending real value`
tag, and marked `sourced: true` in `lib/ccData.js`. They must be populated
from the ClickUp Contact Spine (workspace 90141390262) before launch. Nothing
fabricated ships.

## 2. No logo asset in the repo (asset gap)

The brief says: "The CC mark is two interlocking rings — reference the existing
logo asset, never regenerate it." No logo asset exists in this repository.
`app/components/CCMark.jsx` renders a minimal geometric two-ring placeholder
(not an AI-generated logo) and will use `/public/cc-mark.svg` once the real
asset is added. Flagged so the real mark replaces the placeholder rather than
the placeholder being mistaken for final.

## 3. Case-study detail beyond the three named matches (data source)

The brief says to "pull real closed matches from the Contact Spine rather than
inventing composites," then names exactly three (Jonathan Benno → Jean-Georges
425 Park, Andy Choi → Gabriel Kreuther, Jaime Campos → Himmel Hospitality).
Those three named outcomes are used verbatim with one-line challenge/result
framing mirroring the printed one-pager. The challenge/result *sentences* are
descriptive, not invented facts or numbers — richer per-match detail should be
pulled live from the Contact Spine (`lib/clickup.js#getContactSpineTasks`)
before these are treated as final marketing copy.

## Vocabulary compliance (no conflict — resolved cleanly)

The reference page's conversion pattern was mapped onto CC's mechanic without
needing any forbidden term:

- Reference "your next hire is already **vetted**" → CC "Your next hire is
  already **vouched for**." (uses an allowed term — no conflict)
- Reference CTAs "apply" / "résumé" → CC CTAs "Vouch for someone" / "Post a
  role" / "make the introduction through CC."
- "signal, not resumes" differentiation block → "Signal, not applications."

None of `vetted`, `vetting`, `network`, `placements`, `Scouts`, `recruiters`,
`apply`, or `résumé` appear in any user-facing copy or AI system prompt. The
two AI system prompts (`lib/ai/referrer.js`, `lib/ai/reactivation.js`) restate
the vocabulary rules so model output stays compliant.
