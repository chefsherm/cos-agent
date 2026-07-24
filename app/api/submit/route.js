import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { CC_PRIMER, CC_VOCAB, PATHS } from "@/lib/onboarding";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Where member submissions go. Falls back to the brief recipient, then the founder.
function recipient() {
  return process.env.SUBMIT_EMAIL || process.env.BRIEF_EMAIL || "founder@candidatecollective.com";
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Ask Claude to turn the conversation into a clean brief for the CC team.
async function summarize(client, path, transcript, note) {
  const isEmployer = path === "employer";
  const system = `You turn an onboarding conversation into a short, scannable brief for the Candidate Collective team.

${CC_PRIMER}

${CC_VOCAB}

Write plain text (no markdown headers, no code fences). Be concise and factual — only what the member actually said. If something wasn't covered, write "Not specified". Keep it under 180 words.

${
  isEmployer
    ? `Format as a ROLE BRIEF with these labeled lines:\nRole:\nRestaurant / group:\nMust-haves:\nCompensation:\nCulture / notes:\nWhat they want next:`
    : `Format as a VOUCH with these labeled lines:\nWho they're vouching for:\nWhat this person does well:\nWhy the Referrer stands behind them:\nRelationship / context:\nWhat they want next:`
}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system,
    messages: [
      {
        role: "user",
        content: `Conversation:\n${transcript}${note ? `\n\nMember's added note:\n${note}` : ""}`,
      },
    ],
  });
  return msg.content[0]?.text?.trim() || "";
}

export async function POST(req) {
  try {
    const { path, messages, note, contact } = await req.json();
    const p = PATHS[path];
    const name = contact?.name?.trim();
    const email = contact?.email?.trim();
    const phone = contact?.phone?.trim();

    if (!p) return Response.json({ error: "Unknown path." }, { status: 400 });
    if (!name) return Response.json({ error: "Please add your name." }, { status: 400 });
    if (!email || !EMAIL_RE.test(email))
      return Response.json({ error: "Please add a valid email." }, { status: 400 });

    const transcript = Array.isArray(messages)
      ? messages
          .filter((m) => m && m.content)
          .map((m) => `${m.role === "user" ? "MEMBER" : "GUIDE"}: ${m.content}`)
          .join("\n")
      : "";

    if (!transcript && !note?.trim()) {
      return Response.json({ error: "Tell us a bit more before sending." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let brief = "";
    try {
      brief = await summarize(client, path, transcript, note);
    } catch (e) {
      console.error("Submit summarize failed, using raw transcript:", e);
      brief = `${note ? `Note: ${note}\n\n` : ""}${transcript}`;
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("SUBMIT (no RESEND_API_KEY configured):", { path, name, email, phone, brief });
      return Response.json({ error: "Submissions aren't wired up yet — set RESEND_API_KEY." }, { status: 503 });
    }

    const kind = path === "employer" ? "role brief" : "vouch";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f9f9f7">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e8e8e4;border-radius:8px;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">New ${esc(kind)} · ${esc(p.label)}</div>
    <div style="font-size:18px;font-weight:700;color:#1a1a1a">${esc(name)}</div>
    <div style="font-size:13px;color:#555;margin-top:2px">
      <a href="mailto:${esc(email)}" style="color:#1a5fa8;text-decoration:none">${esc(email)}</a>${phone ? ` · ${esc(phone)}` : ""}
    </div>
    <div style="margin:20px 0;border-top:1px solid #f0f0ec"></div>
    <pre style="font-family:inherit;font-size:14px;line-height:1.6;color:#1a1a1a;white-space:pre-wrap;margin:0">${esc(brief)}</pre>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f0f0ec;font-size:12px;color:#aaa">
      Submitted via the Candidate Collective onboarding guide.
    </div>
  </div>
</body></html>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Candidate Collective <onboarding@resend.dev>",
      to: recipient(),
      reply_to: email,
      subject: `New ${kind} from ${name}`,
      html,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Submit error:", err);
    return Response.json({ error: "Couldn't send that. Try again." }, { status: 500 });
  }
}
