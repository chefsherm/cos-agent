import { anthropic, CC_MODEL, extractJson } from "@/lib/anthropic";
import { dormantReferrers } from "@/lib/vouchGraph";

// Reactivation engine.
//
// Identify dormant high-value Referrers — people who've vouched successfully
// before but gone quiet — and DRAFT a check-in nudge for Sherm to review and
// send manually. Never auto-send. This function only returns drafts.
export async function draftReactivationNudges({ dormantDays = 45, limit = 10 } = {}) {
  const dormant = await dormantReferrers({ dormantDays, limit });
  if (dormant.length === 0) return { drafts: [], usedAi: false };

  const client = anthropic();
  if (!client) {
    return {
      usedAi: false,
      drafts: dormant.map((d) => ({
        referrerId: d.id,
        name: d.name,
        successfulMatches: d.successfulMatches,
        draft:
          `Hi ${firstName(d.name)} — it's been a while. Your vouches have led to ${d.successfulMatches} ` +
          `real match${d.successfulMatches === 1 ? "" : "es"} in the community. ` +
          `Anyone come to mind lately worth an introduction? — Sherm`,
      })),
    };
  }

  const system = [
    "You draft short, warm check-in messages for Sherm (founder of Candidate Collective) to review and send MANUALLY to dormant Referrers.",
    "These are people who have vouched successfully before — their vouch led to a real match — but have gone quiet.",
    "The message is from Sherm, personal and brief (2-3 sentences), inviting them to think of someone worth an introduction. No pressure, no marketing tone.",
    "NEVER imply the message will be auto-sent. These are drafts for human review.",
    "CC vocabulary is strict. Use: vouch, vouched for, Referrer, introduction, match, community. NEVER use: vetted, vetting, network, placement, placements, Scouts, recruiters, apply, résumé.",
    'Return ONLY JSON: {"drafts":[{"referrerId":<number>,"draft":"<message text>"}]}.',
  ].join("\n");

  const userMsg = [
    "Draft one check-in message per Referrer:",
    ...dormant.map(
      (d) =>
        `- referrerId=${d.id} | ${d.name} | ${d.roleTitle || "?"} @ ${d.employer || "?"} | ` +
        `successful_matches=${d.successfulMatches} | last_active=${fmtDate(d.lastActiveAt)}`
    ),
  ].join("\n");

  try {
    const msg = await client.messages.create({
      model: CC_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const parsed = extractJson(msg.content[0]?.text);
    const drafts = parsed?.drafts || [];
    const byId = new Map(dormant.map((d) => [d.id, d]));
    const out = [];
    for (const dr of drafts) {
      const person = byId.get(Number(dr.referrerId));
      if (person && dr.draft) {
        out.push({
          referrerId: person.id,
          name: person.name,
          successfulMatches: person.successfulMatches,
          draft: dr.draft,
        });
      }
    }
    return { usedAi: true, drafts: out };
  } catch (err) {
    console.error("reactivation AI error:", err);
    return {
      usedAi: false,
      drafts: dormant.map((d) => ({
        referrerId: d.id,
        name: d.name,
        successfulMatches: d.successfulMatches,
        draft: `Hi ${firstName(d.name)} — it's been a while. Anyone worth an introduction lately? — Sherm`,
      })),
    };
  }
}

function firstName(name) {
  return (name || "there").trim().split(/\s+/)[0];
}
function fmtDate(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "?";
  }
}
