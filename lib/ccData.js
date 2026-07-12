// Candidate Collective — locked content. Phrasing here is verbatim from the
// brief and must not be softened or re-worded.

// Mission — locked, use verbatim wherever a mission statement appears.
export const MISSION =
  "Candidate Collective's mission is to connect the people who build hospitality — with trust as the only currency.";

// Founding operator clients — named only. Never expand without instruction.
export const FOUNDING_CLIENTS = ["Jean-Georges", "Major Food Group", "Gabriel Kreuther"];

// Manual-phase proof point — locked phrasing.
export const MANUAL_PROOF_POINT =
  "over 100 peer-vouched matches representing millions in salary value";

// The ten named lineages (Tier-0 anchors).
export const LINEAGES = [
  "Thomas Keller",
  "Jean-Georges",
  "Daniel Boulud",
  "Gray Kunz",
  "Danny Meyer",
  "Will Guidara",
  "Major Food Group",
  "Gabriel Kreuther",
  "Bouley",
  "Charlie Palmer",
];

// Total people across the Vouch Graph's ten lineages.
export const VOUCH_GRAPH_TOTAL = "690+";

// Hero stat bar. Four numbers, all real CC data — no invented placeholders.
//
// FLAG: Only two of the four numbers are given in the brief as locked facts
// (the manual-phase proof point and the 690+ Vouch Graph total). The other two
// — time-to-first-vouch and the trail/tasting proof-step figure — are NOT
// provided anywhere in the brief. Per the brief's "flag, don't silently soften"
// rule and its "no invented placeholders" rule, these are marked `sourced` and
// must be populated from the ClickUp Contact Spine (workspace 90141390262)
// before launch. See FLAGS.md. They are intentionally rendered as "—" until a
// real value is wired in, rather than fabricated.
export const HERO_STATS = [
  {
    key: "time_to_first_vouch",
    value: null, // FLAG: real metric not provided — source from Contact Spine
    label: "Time to first vouch",
    sourced: true,
  },
  {
    key: "manual_matches",
    value: "100+",
    label: "peer-vouched matches — millions in salary value",
    sourced: false,
  },
  {
    key: "proof_step",
    value: null, // FLAG: trail/tasting proof-step figure not provided
    label: "Trail or tasting before a hire — the free-trial equivalent",
    sourced: true,
  },
  {
    key: "vouch_graph_total",
    value: VOUCH_GRAPH_TOTAL,
    label: "people across ten lineages in the Vouch Graph",
    sourced: false,
  },
];

// The four canonical match-flow steps. Do not compress or reorder.
export const HOW_IT_WORKS = [
  {
    n: 1,
    title: "An operator posts a role",
    body: "A named house posts what they need — front-of-house or back-of-house. No open applications, no keyword search.",
  },
  {
    n: 2,
    title: "CC surfaces vouched candidates",
    body: "Through the Vouch Graph, CC surfaces people who someone already knows — scored by proximity, not self-reported experience.",
  },
  {
    n: 3,
    title: "A conversation happens on-platform",
    body: "The operator and candidate talk in-app. Nothing moves to email — everything stays on-platform.",
  },
  {
    n: 4,
    title: "A proof step follows",
    body: "A trail or tasting for culinary roles — the proof before anything moves off-platform toward a hire. Booked in-app.",
  },
];

// Case studies — real closed matches, named. Pull richer data from the Contact
// Spine at runtime; these named outcomes mirror the printed one-pager.
export const CASE_STUDIES = [
  {
    name: "Jonathan Benno → Jean-Georges 425 Park",
    challenge: "A senior culinary leadership seat at a flagship opening.",
    result: "Filled through a peer vouch — no posting, no résumé.",
  },
  {
    name: "Andy Choi → Gabriel Kreuther",
    challenge: "A precision kitchen needing a trusted, proven hand.",
    result: "Matched through lineage proximity in the Vouch Graph.",
  },
  {
    name: "Jaime Campos → Himmel Hospitality",
    challenge: "A growing group sourcing without a broker layer.",
    result: "Introduced by someone who had already worked alongside him.",
  },
];

// Closing line — locked.
export const CLOSING_CTA = "Your next hire is already vouched for.";
