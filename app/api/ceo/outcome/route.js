import { recordOutcome } from "@/lib/ceo-ledger";
import { getLedgerDb } from "@/lib/db";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Outcome receipt. Call right after the provider responds, success or failure.
// Keep resultSummary free of message bodies and personal data.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body?.attemptId) return Response.json({ ok: false, reason_codes: ["ATTEMPT_ID_REQUIRED"] });
  const { attemptId, ...outcome } = body;
  return Response.json(await recordOutcome(getLedgerDb(), attemptId, outcome));
}
