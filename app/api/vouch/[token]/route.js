import Anthropic from "@anthropic-ai/sdk";
import {
  getRequest,
  saveVouch,
  publicView,
  buildVouchCollectPrompt,
  buildVouchSummaryPrompt,
} from "@/lib/vouches";

// GET /api/vouch/[token] — recipient page context (no phone exposed)
export async function GET(_req, { params }) {
  const r = await getRequest(params.token);
  if (!r) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ request: publicView(r) });
}

// POST /api/vouch/[token] — mode "chat" (default) or "submit"
export async function POST(req, { params }) {
  try {
    const r = await getRequest(params.token);
    if (!r) return Response.json({ error: "not_found" }, { status: 404 });

    const { mode = "chat", messages } = await req.json();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    if (mode === "submit") {
      if (r.status === "collected") {
        return Response.json({ ok: true, already: true });
      }
      const transcript = (messages || [])
        .filter((m) => m && m.content)
        .map((m) => `${m.role === "user" ? "REFERRER" : "GUIDE"}: ${m.content}`)
        .join("\n");

      let summary = transcript;
      try {
        const s = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system: buildVouchSummaryPrompt(r.requester),
          messages: [{ role: "user", content: `Conversation:\n${transcript}` }],
        });
        summary = s.content[0]?.text?.trim() || transcript;
      } catch (e) {
        console.error("vouch summarize failed, storing transcript:", e);
      }

      await saveVouch(params.token, { summary, transcript, at: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    // chat turn
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: buildVouchCollectPrompt(r.requester),
      messages,
    });
    return Response.json({ reply: msg.content[0].text });
  } catch (err) {
    console.error("vouch [token] POST error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
