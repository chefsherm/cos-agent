import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, DEFAULT_VENTURES, DEFAULT_DECISIONS } from "@/lib/data";

export async function POST(req) {
  try {
    const { messages, ventures, decisions } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      system: buildSystemPrompt(ventures || DEFAULT_VENTURES, decisions || DEFAULT_DECISIONS),
      messages,
    });

    return Response.json({ reply: msg.content[0].text });
  } catch (err) {
    console.error("Chat error:", err);
    return Response.json({ error: "Chat failed." }, { status: 500 });
  }
}
