import { admit } from "@/lib/ceo-ledger";
import { getLedgerDb } from "@/lib/db";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Policy enforcement point. Executors call this immediately before the tool
// call and act only on ok:true. Consumes the token and writes the admission
// receipt; the returned attempt_id must be cited in the outcome receipt.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body?.token || !body?.action) return Response.json({ ok: false, reason_codes: ["TOKEN_OR_ACTION_MISSING"] });
  return Response.json(await admit(getLedgerDb(), body.token, body.action));
}
