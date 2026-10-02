import Anthropic from "@anthropic-ai/sdk";
import { buildCeoSystemPrompt } from "@/lib/ceo";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Talk to the CC AI CEO. Stage 1: it reads, organizes, drafts, and digests —
// this route returns text only and executes nothing.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "high" },
      system: [{ type: "text", text: buildCeoSystemPrompt(), cache_control: { type: "ephemeral" } }],
      messages,
    });

    if (msg.stop_reason === "refusal") {
      return Response.json({ error: "Request declined.", details: msg.stop_details || null }, { status: 422 });
    }

    const reply = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return Response.json({ reply });
  } catch (err) {
    console.error("CEO error:", err);
    return Response.json({ error: "CEO request failed." }, { status: 500 });
  }
}
