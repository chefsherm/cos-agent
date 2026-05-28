export const DEFAULT_VENTURES = [
  {
    id: "cc",
    name: "Candidate Collective",
    sub: "CC 2.0 · Seed Round",
    status: "yellow",
    priority: 1,
    next: "3-year financial model + unit economics one-pager — P1 missing from seed data room",
    blocker: "Investors waiting on the model",
  },
  {
    id: "veritas",
    name: "VERITAS / NSF SBIR",
    sub: "zkML trust layer",
    status: "red",
    priority: 2,
    next: "Start solo EZKL prover build wrapping Llama-3 8B — no Basim needed",
    blocker: "Originally planned week of April 28 — now 4 weeks overdue",
  },
  {
    id: "terroir",
    name: "Terroir",
    sub: "AI palate coach · TerroirTable.com",
    status: "yellow",
    priority: 3,
    next: "Resolve Samin Nosrat / Salt Fat Acid Heat positioning at brand level",
    blocker: "Lovable fix delivered — deeper copy issue unresolved",
  },
  {
    id: "paerls-provisions",
    name: "Paerls Provisions",
    sub: "DTC curated pantry · 7 SKUs",
    status: "yellow",
    priority: 4,
    next: "Attend Summer Fancy Food Show at Javits — high-efficiency sourcing event",
    blocker: "Wholesale sourcing starting from scratch",
  },
  {
    id: "remarq",
    name: "Remarq.me",
    sub: "Social voice engine · SaaS",
    status: "yellow",
    priority: 5,
    next: "Book 30-min Basim session => Google Cloud Run deployment",
    blocker: "Backend runs locally only — no production launch possible",
  },
  {
    id: "the-pass",
    name: "The Pass",
    sub: "Recognition publication · Vol. I",
    status: "yellow",
    priority: 6,
    next: "Define Detroit / Cleveland nomination pipeline and launch timeline",
    blocker: "Planning phase — CC Referrer infrastructure not yet wired",
  },
  {
    id: "compute-commons",
    name: "Compute Commons",
    sub: "Peer-governed compute · Vercel live",
    status: "green",
    priority: 7,
    next: "Identify lab partner willing to honor credits — Phase 2 critical unlock",
    blocker: null,
  },
  {
    id: "paerls",
    name: "Paerls",
    sub: "Private chef practice · NYC + Hamptons",
    status: "green",
    priority: 8,
    next: "Maintain 111 West 57th St engagement — dual COI current",
    blocker: null,
  },
];

export const DEFAULT_DECISIONS = [
  {
    id: "d1",
    venture: "VERITAS",
    text: "Start solo EZKL prover build — originally planned week of April 28, now overdue.",
    urgency: "high",
    created: "2026-04-20",
    status: "pending",
  },
  {
    id: "d2",
    venture: "CC",
    text: "Build 3-year financial model + unit economics one-pager for seed data room.",
    urgency: "high",
    created: "2026-05-01",
    status: "pending",
  },
  {
    id: "d3",
    venture: "Terroir",
    text: "Resolve Samin Nosrat positioning conflict — brand-level decision, not a Lovable fix.",
    urgency: "medium",
    created: "2026-05-05",
    status: "pending",
  },
  {
    id: "d4",
    venture: "Remarq",
    text: "Book 30-min session with Basim for Google Cloud Run IAM config and deployment.",
    urgency: "medium",
    created: "2026-05-10",
    status: "pending",
  },
];

export function buildSystemPrompt(ventures, decisions) {
  const vList = ventures
    .map(
      (v) =>
        `- ${v.name} (${v.sub}): STATUS=${v.status.toUpperCase()}, NEXT=${v.next}${v.blocker ? `, BLOCKER=${v.blocker}` : ""}`
    )
    .join("\n");

  const dList = decisions
    .filter((d) => d.status === "pending")
    .map(
      (d) =>
        `- [${d.urgency.toUpperCase()}] ${d.venture}: ${d.text} (pending since ${d.created})`
    )
    .join("\n");

  return `You are the Chief of Staff for Michael Sherman (Sherm), founder and CEO of Candidate Collective. Full situational awareness across all ventures. Direct, brief, action-oriented. No fluff. Respect his time.

SHERM'S CONTEXT:
- CIA-trained, ~30 years NYC fine dining (Lespinasse under Gray Kunz, Bouley, Aureole under Charlie Palmer)
- Candidate Collective: trust-based peer-referral hiring for hospitality/culinary. Operations 2016, incorporated 2017, platform launched Jan 2025.
- Advisors: Steve Cadigan (LinkedIn founding CHRO), Dr. Michiel Bakker (CIA President)
- Founding clients: Jean-Georges, Major Food Group, Gabriel Kreuther
- Technical co-founder: Basim Newby (ex-Google)

CC VOCABULARY — STRICTLY ENFORCED:
- NEVER: network, vetted, vetting, placement, placements, recruiters, Scouts (as universal noun)
- ALWAYS: vouch, vouched for, Referrer, introduction, match, community, refer
- CC mission: "connect the people who build hospitality — with trust as the only currency"
- CC fee: 10% first-year salary; Referrers earn 50%

ACTIVE VENTURES:
${vList}

DECISIONS PENDING HIS CALL:
${dList}

YOUR THREE JOBS:
1. TRIAGE — What matters most today. Max 3 priorities. Be specific.
2. PRESSURE — Flag stalled decisions. Name them. Days pending. Urgency.
3. CLARITY — Status + next action + blocker. Three lines max per venture.

MORNING BRIEF FORMAT (use exactly when asked for brief):
TODAY — [weekday, date]
---
PRIORITY 1: [venture] — [one sentence action]
PRIORITY 2: [venture] — [one sentence action]
PRIORITY 3: [venture] — [one sentence action]
---
STALLED: [decisions sitting too long — name each with days pending]
LET GO TODAY: [one thing that can wait — one sentence]

Keep everything tight. He is a busy operator. No preambles. No "Great question." Just answers.`;
}

// --- Persistence via Vercel Blob ---

export async function getData() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ventures: DEFAULT_VENTURES, decisions: DEFAULT_DECISIONS };
  }
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "cos-data" });
    if (blobs.length > 0) {
      const sorted = blobs.sort(
        (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
      );
      const res = await fetch(sorted[0].url);
      const data = await res.json();
      if (data.ventures && data.decisions) return data;
    }
  } catch (e) {
    console.error("getData error:", e);
  }
  return { ventures: DEFAULT_VENTURES, decisions: DEFAULT_DECISIONS };
}

export async function saveData(ventures, decisions) {
  const { put } = await import("@vercel/blob");
  await put("cos-data.json", JSON.stringify({ ventures, decisions }), {
    access: "public",
    addRandomSuffix: false,
  });
}
