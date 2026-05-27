import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { buildSystemPrompt, DEFAULT_VENTURES, DEFAULT_DECISIONS } from "@/lib/data";

export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
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
      system: buildSystemPrompt(DEFAULT_VENTURES, DEFAULT_DECISIONS),
      messages: [
        { role: "user", content: `Generate my morning brief for ${today}.` },
      ],
    });

    const brief = msg.content[0].text;

    const htmlBrief = brief
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/^---$/gm, "<hr style='border:none;border-top:1px solid #e5e5e5;margin:16px 0'>")
      .replace(/^TODAY — (.*)$/gm, "<p style='font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#888;font-weight:600;margin:0 0 16px'>TODAY — $1</p>")
      .replace(/^PRIORITY (\d): (.*)$/gm, "<div style='display:flex;gap:16px;margin:8px 0'><span style='font-size:12px;color:#888;font-weight:600;min-width:16px;padding-top:2px'>$1</span><span style='font-size:15px;color:#1a1a1a'>$2</span></div>")
      .replace(/^STALLED: (.*)$/gm, "<div style='margin:12px 0'><span style='font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#c0392b;font-weight:600'>Stalled</span><div style='font-size:14px;color:#333;margin-top:4px'>$1</div></div>")
      .replace(/^LET GO TODAY: (.*)$/gm, "<div style='margin:12px 0'><span style='font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#888;font-weight:600'>Let go today</span><div style='font-size:14px;color:#333;margin-top:4px'>$1</div></div>")
      .replace(/\n/g, "<br>");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f7">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border:1px solid #e8e8e4;border-radius:8px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #f0f0ec">
      <div style="font-size:14px;font-weight:600;color:#1a1a1a">Chief of Staff</div>
      <div style="font-size:12px;color:#888;margin-left:4px">— Sherm</div>
    </div>
    ${htmlBrief}
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f0f0ec;font-size:12px;color:#aaa">
      Sent by your CoS Agent · <a href="${process.env.NEXT_PUBLIC_URL || 'https://your-app.vercel.app'}" style="color:#888;text-decoration:none">Open dashboard →</a>
    </div>
  </div>
</body>
</html>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "CoS Agent <onboarding@resend.dev>",
      to: process.env.BRIEF_EMAIL,
      subject: `CoS Brief — ${today}`,
      html: emailHtml,
    });

    return Response.json({ ok: true, date: today });
  } catch (err) {
    console.error("Cron error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
