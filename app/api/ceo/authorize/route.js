import { authorizeWithLedger } from "@/lib/ceo-ledger";
import { getLedgerDb } from "@/lib/db";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Policy decision point. Returns ALLOW (with a short-lived, single-use token
// bound to this exact action), DENY, ESCALATE, or PROHIBITED. Suppression,
// caps, and circumvention signals come from the ledger, not the caller. Stage
// and pause come from server env only.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  const action = await req.json().catch(() => null);
  return Response.json(await authorizeWithLedger(action, { db: getLedgerDb() }));
}
