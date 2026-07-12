import { getSessionUser } from "@/lib/auth";
import { draftReactivationNudges } from "@/lib/ai/reactivation";

// Reactivation engine endpoint. Returns DRAFT check-in nudges for Sherm to
// review and send manually. Never auto-sends.
export async function GET(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const url = new URL(req.url);
  const dormantDays = Number(url.searchParams.get("dormantDays")) || 45;

  try {
    const result = await draftReactivationNudges({ dormantDays });
    // Make the never-auto-send contract explicit in the payload.
    return Response.json({ ...result, autoSend: false });
  } catch (err) {
    console.error("reactivation error:", err);
    return Response.json({ error: "Could not draft nudges." }, { status: 500 });
  }
}
