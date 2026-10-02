import { authorize } from "@/lib/ceo";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Policy decision point. Returns ALLOW (with a short-lived signed token bound
// to this exact action), DENY, ESCALATE, or PROHIBITED. Stage and pause come
// from server env only — nothing in the request body can change them.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  const action = await req.json().catch(() => null);
  return Response.json(authorize(action));
}
