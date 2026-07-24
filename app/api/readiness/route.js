import Anthropic from "@anthropic-ai/sdk";
import { buildReadinessPrompt, READINESS } from "@/lib/onboarding";

function clampScore(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export async function POST(req) {
  try {
    const { path, input, messages } = await req.json();
    const cfg = READINESS[path] || READINESS.employer;

    // Gather everything the member has shared: chat transcript + any pasted input.
    const transcript = Array.isArray(messages)
      ? messages
          .filter((m) => m && m.content)
          .map((m) => `${m.role === "user" ? "MEMBER" : "GUIDE"}: ${m.content}`)
          .join("\n")
      : "";
    const shared = [input?.trim(), transcript].filter(Boolean).join("\n\n");

    if (!shared) {
      return Response.json({ insufficient: true });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: buildReadinessPrompt(path),
      messages: [
        {
          role: "user",
          content: `Here is everything the member has shared. Assess their trust readiness.\n\n---\n${shared}\n---`,
        },
      ],
    });

    const raw = msg.content[0]?.text || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return Response.json({ error: "Could not read the result." }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return Response.json({ error: "Could not read the result." }, { status: 502 });
    }

    // Normalize against the configured dimensions so the UI is always well-formed.
    const byName = {};
    (parsed.dimensions || []).forEach((d) => {
      if (d && d.name) byName[d.name] = d;
    });
    const dimensions = cfg.dimensions.map((name) => {
      const d = byName[name] || {};
      return { name, score: clampScore(d.score), note: String(d.note || "").trim() };
    });

    const result = {
      overall: clampScore(
        parsed.overall != null
          ? parsed.overall
          : dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length
      ),
      verdict: String(parsed.verdict || "").trim(),
      dimensions,
      nextSteps: (Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [])
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 4),
    };

    return Response.json({ result });
  } catch (err) {
    console.error("Readiness error:", err);
    return Response.json({ error: "Readiness check failed." }, { status: 500 });
  }
}
