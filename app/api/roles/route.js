import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createRoleTask } from "@/lib/clickup";

// List the signed-in operator's role postings.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const { rows } = await query(
    `SELECT r.id, r.title, r.side, r.venue, r.description, r.status, r.created_at,
            l.name AS lineage_name,
            count(ms.id)::int AS surfaced_count
       FROM role_postings r
       LEFT JOIN lineages l ON l.id = r.lineage_id
       LEFT JOIN match_states ms ON ms.role_id = r.id
      WHERE r.operator_id = $1
      GROUP BY r.id, l.name
      ORDER BY r.created_at DESC`,
    [user.id]
  );
  return Response.json({ roles: rows });
}

// Post a role. The CTA is always to make an introduction through CC — the role
// posting is the operator's entry into the match flow.
export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const { title, side, venue, lineageId, description } = await req.json();
    if (!title || !side || !venue) {
      return Response.json({ error: "title, side, and venue are required" }, { status: 400 });
    }
    if (!["foh", "boh"].includes(side)) {
      return Response.json({ error: "side must be 'foh' or 'boh'" }, { status: 400 });
    }

    const { rows } = await query(
      `INSERT INTO role_postings (operator_id, title, side, venue, lineage_id, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, side, venue, description, status, created_at`,
      [user.id, title, side, venue, lineageId || null, description || null]
    );
    const role = rows[0];

    // Best-effort sync to the ClickUp Contact Spine (workspace 90141390262).
    // The hard-block guard prevents any reference to the forbidden workspace.
    if (process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_ROLE_LIST_ID) {
      try {
        const task = await createRoleTask(process.env.CLICKUP_ROLE_LIST_ID, {
          title: role.title,
          venue: role.venue,
          side: role.side,
          description: role.description,
        });
        if (task?.id) {
          await query(`UPDATE role_postings SET clickup_task_id = $1 WHERE id = $2`, [
            task.id,
            role.id,
          ]);
        }
      } catch (e) {
        console.error("ClickUp role sync failed (non-fatal):", e.message);
      }
    }

    await query(`UPDATE users SET last_active_at = now() WHERE id = $1`, [user.id]);
    return Response.json({ role });
  } catch (err) {
    console.error("create role error:", err);
    return Response.json({ error: "Could not post role." }, { status: 500 });
  }
}
