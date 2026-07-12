import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { surfaceRankedReferrers } from "@/lib/ai/referrer";

// The referrer-surfacing endpoint.
// POST { roleId } -> ranked people most likely to KNOW the right candidate.
export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const { roleId } = await req.json();
    if (!roleId) return Response.json({ error: "roleId is required" }, { status: 400 });

    const { rows } = await query(
      `SELECT r.id, r.operator_id, r.title, r.side, r.venue, r.description,
              r.lineage_id, l.name AS lineage_name
         FROM role_postings r
         LEFT JOIN lineages l ON l.id = r.lineage_id
        WHERE r.id = $1`,
      [roleId]
    );
    const role = rows[0];
    if (!role) return Response.json({ error: "Role not found." }, { status: 404 });
    if (role.operator_id !== user.id) {
      return Response.json({ error: "Not your role posting." }, { status: 403 });
    }

    const result = await surfaceRankedReferrers({
      id: role.id,
      operator_id: role.operator_id,
      title: role.title,
      side: role.side,
      venue: role.venue,
      description: role.description,
      lineage_id: role.lineage_id,
      lineageName: role.lineage_name,
    });

    return Response.json(result);
  } catch (err) {
    console.error("surface referrers error:", err);
    return Response.json({ error: "Could not surface referrers." }, { status: 500 });
  }
}
