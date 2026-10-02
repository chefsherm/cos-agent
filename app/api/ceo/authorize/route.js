import { authorize, currentStage, isPaused } from "@/lib/ceo";
import { ceoUnauthorized } from "@/lib/ceo-auth";

// Policy gate: classify a proposed action and say whether it may run now.
// Any executor (Make scenario, script, agent harness) calls this first.
export async function POST(req) {
  const denied = ceoUnauthorized(req);
  if (denied) return denied;

  const action = await req.json().catch(() => null);
  if (!action || typeof action !== "object") {
    return Response.json({ error: "action required" }, { status: 400 });
  }
  return Response.json({ stage: currentStage(), paused: isPaused(), ...authorize(action) });
}
