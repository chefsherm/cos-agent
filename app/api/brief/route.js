import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, DEFAULT_VENTURES, DEFAULT_DECISIONS } from "@/lib/data";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ventures = body.ventures || DEFAULT_VENTURES;
    const decisions = body.decisions || DEFAULT_DECISIONS;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      system: buildSystemPrompt(ventures, decisions),
      messages: [
        { role: "user", content: `Generate my morning brief for ${today}.` },
      ],
    });

    return Response.json({ brief: msg.content[0].text });
  } catch (err) {
    console.error("Brief error:", err);
    return Response.json({ error: "Failed to generate brief." }, { status: 500 });
  }
}
