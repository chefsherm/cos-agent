// Internal-only guard for the AI CEO endpoints. Fails closed when unset.
export function ceoUnauthorized(req) {
  const secret = process.env.CEO_API_SECRET;
  if (!secret) return Response.json({ error: "CEO_API_SECRET is not configured." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
