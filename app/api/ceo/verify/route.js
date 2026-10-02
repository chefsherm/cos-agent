import { verifyAuthorization } from "@/lib/ceo";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Policy enforcement check for executors that cannot import lib/ceo.js (Make,
// external scripts). Call immediately before the tool call; act only on ok:true.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || !body.token || !body.action) {
    return Response.json({ ok: false, reason_codes: ["TOKEN_OR_ACTION_MISSING"] });
  }
  return Response.json(verifyAuthorization(body.token, body.action));
}
