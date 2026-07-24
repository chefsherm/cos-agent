import Anthropic from "@anthropic-ai/sdk";
import { buildOnboardingPrompt } from "@/lib/onboarding";

export async function POST(req) {
  try {
    const { messages, path } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: buildOnboardingPrompt(path),
      messages,
    });

    return Response.json({ reply: msg.content[0].text });
  } catch (err) {
    console.error("Onboard chat error:", err);
    return Response.json({ error: "Chat failed." }, { status: 500 });
  }
}
