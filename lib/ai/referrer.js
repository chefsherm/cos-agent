import { anthropic, CC_MODEL, extractJson } from "@/lib/anthropic";
import { surfaceReferrers, oppositeSide } from "@/lib/vouchGraph";

// Referrer-surfacing engine.
//
// Given a posted role, return ranked people most likely to KNOW the right
// candidate — weighted by vouch distance, lineage proximity, and the
// cross-functional sourcing rule.
//
// This function recommends WHO TO ASK. It never scores or certifies a
// candidate's quality — that judgment stays human. The AI only re-ranks and
// explains the pool the Vouch Graph already surfaced.
export async function surfaceRankedReferrers(role, { limit = 12 } = {}) {
  // The candidate pool comes from the graph. The cross-functional rule is
  // already enforced in surfaceReferrers() — every person here is opposite-side.
  const pool = await surfaceReferrers(role, { limit });
  const referrerSide = oppositeSide(role.side);

  if (pool.length === 0) {
    return { referrerSide, ranked: [], usedAi: false };
  }

  const client = anthropic();
  if (!client) {
    // Graceful fallback: return the graph ranking with a distance-based note.
    return {
      referrerSide,
      usedAi: false,
      ranked: pool.map((p) => ({
        ...p,
        reason: p.lineageVouch != null
          ? `Close in the ${role.lineageName || "target"} lineage (vouch distance ${p.lineageVouch}).`
          : p.bestVouch != null
            ? `Trusted position in the Vouch Graph (distance ${p.bestVouch}).`
            : "In the community; no scored path yet.",
      })),
    };
  }

  const system = [
    "You help Candidate Collective decide WHO TO ASK for a referral — never who to hire.",
    "You are given a posted role and a pool of possible Referrers already surfaced by the Vouch Graph.",
    "Every person in the pool is on the OPPOSITE side of the house from the role (the cross-functional sourcing rule); do not question or override that.",
    "Rank people by how likely they are to KNOW the right candidate, weighted by vouch distance (lower is closer), lineage proximity, and breadth of prior vouching.",
    "You must NOT score, rate, certify, or judge any candidate's quality or the Referrers' quality — that judgment is human. Only explain who is well-positioned to make an introduction.",
    "CC vocabulary is strict. Use: vouch, vouched for, Referrer, introduction, match, community. NEVER use: vetted, vetting, network, placement, placements, Scouts, recruiters, apply, résumé.",
    'Return ONLY JSON: {"ranked":[{"id":<number>,"reason":"<one sentence on why they are well-positioned to know the right person>"}]}. Order the array best-first.',
  ].join("\n");

  const userMsg = [
    `ROLE: ${role.title} at ${role.venue}`,
    `ROLE SIDE: ${role.side} (surfacing ${referrerSide} Referrers)`,
    role.lineageName ? `LINEAGE FOCUS: ${role.lineageName}` : null,
    role.description ? `NOTES: ${role.description}` : null,
    "",
    "REFERRER POOL:",
    ...pool.map(
      (p) =>
        `- id=${p.id} | ${p.name} | ${p.side} | ${p.roleTitle || "?"} @ ${p.employer || "?"} | ` +
        `best_vouch=${p.bestVouch ?? "none"} | lineage_vouch=${p.lineageVouch ?? "none"} | ` +
        `people_vouched_for=${p.peopleVouchedFor}`
    ),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const msg = await client.messages.create({
      model: CC_MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const parsed = extractJson(msg.content[0]?.text);
    const ranking = parsed?.ranked || [];
    const byId = new Map(pool.map((p) => [p.id, p]));
    const ranked = [];
    for (const r of ranking) {
      const person = byId.get(Number(r.id));
      if (person) {
        ranked.push({ ...person, reason: r.reason || "" });
        byId.delete(Number(r.id));
      }
    }
    // Append anyone the model dropped, preserving graph order.
    for (const p of pool) if (byId.has(p.id)) ranked.push({ ...p, reason: "" });
    return { referrerSide, usedAi: true, ranked };
  } catch (err) {
    console.error("referrer AI error:", err);
    return {
      referrerSide,
      usedAi: false,
      ranked: pool.map((p) => ({ ...p, reason: "" })),
    };
  }
}
