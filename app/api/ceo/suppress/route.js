import { suppress } from "@/lib/ceo-ledger";
import { getLedgerDb } from "@/lib/db";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Record an opt-out or stop condition across every channel. Append-only;
// there is no endpoint to lift a suppression.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body?.target) return Response.json({ ok: false, reason_codes: ["TARGET_REQUIRED"] });
  const { target, source, reason, recordedBy, evidenceRef } = body;
  return Response.json(await suppress(getLedgerDb(), target, { source, reason, recordedBy, evidenceRef }));
}
