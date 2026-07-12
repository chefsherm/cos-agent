import { query, tx } from "@/lib/db";

// The opposite side. The cross-functional sourcing rule is structural:
// FOH users can only be surfaced as Referrers for BOH searches, and BOH users
// only for FOH searches. Same-side suggestions are excluded from the query
// itself, not filtered after the fact.
export function oppositeSide(side) {
  if (side === "foh") return "boh";
  if (side === "boh") return "foh";
  throw new Error(`Unknown side: ${side}`);
}

// ---------------------------------------------------------------------------
// Recompute vouch scores from the edge graph.
// ---------------------------------------------------------------------------
// Trust distance = shortest strength-weighted path from a user to each
// lineage's Tier-0 anchor, over the (undirected) vouch graph. Anchors are the
// users whose current_employer or name matches a lineage anchor.
//
// This rebuilds vouch_scores wholesale and never writes to `users`, so lineage
// edges can be recomputed without touching core user data.
export async function recomputeVouchScores({ maxHops = 6 } = {}) {
  return tx(async (client) => {
    const { rows: lineages } = await client.query(
      `SELECT id, name, anchor_name FROM lineages`
    );
    const { rows: edges } = await client.query(
      `SELECT voucher_id, vouchee_id, strength FROM vouch_edges`
    );
    const { rows: users } = await client.query(
      `SELECT id, name, current_employer FROM users`
    );

    // Build an undirected adjacency list. Edge cost falls as strength rises,
    // so a stronger vouch is a shorter hop (strength 5 -> 0.2, strength 1 -> 1).
    const adj = new Map();
    const addEdge = (a, b, cost) => {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push({ to: b, cost });
    };
    for (const e of edges) {
      const cost = 1 / e.strength;
      addEdge(e.voucher_id, e.vouchee_id, cost);
      addEdge(e.vouchee_id, e.voucher_id, cost);
    }

    await client.query(`TRUNCATE vouch_scores`);

    for (const lineage of lineages) {
      // Anchor set: users whose name or employer matches the lineage anchor.
      const anchors = users
        .filter(
          (u) =>
            matches(u.name, lineage.anchor_name) ||
            matches(u.name, lineage.name) ||
            matches(u.current_employer, lineage.anchor_name) ||
            matches(u.current_employer, lineage.name)
        )
        .map((u) => u.id);

      if (anchors.length === 0) continue;

      // Dijkstra from all anchors at distance 0.
      const dist = new Map(anchors.map((id) => [id, 0]));
      // Simple priority handling via repeated scan (graphs here are small).
      const visited = new Set();
      while (visited.size < dist.size) {
        let cur = null;
        let best = Infinity;
        for (const [id, d] of dist) {
          if (!visited.has(id) && d < best) {
            best = d;
            cur = id;
          }
        }
        if (cur === null) break;
        visited.add(cur);
        if (best >= maxHops) continue;
        for (const { to, cost } of adj.get(cur) || []) {
          const nd = best + cost;
          if (nd < (dist.get(to) ?? Infinity)) dist.set(to, nd);
        }
      }

      const values = [];
      const params = [];
      let i = 1;
      for (const [userId, d] of dist) {
        values.push(`($${i++}, $${i++}, $${i++})`);
        params.push(userId, lineage.id, Number(d.toFixed(2)));
      }
      if (values.length) {
        await client.query(
          `INSERT INTO vouch_scores (user_id, lineage_id, vouch_number)
             VALUES ${values.join(", ")}
             ON CONFLICT (user_id, lineage_id) DO UPDATE
               SET vouch_number = EXCLUDED.vouch_number, computed_at = now()`,
          params
        );
      }
    }

    const { rows } = await client.query(`SELECT count(*)::int AS n FROM vouch_scores`);
    return { scored: rows[0].n };
  });
}

function matches(a, b) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Surface candidate Referrers for a role.
// ---------------------------------------------------------------------------
// Returns people most likely to KNOW the right candidate, ranked by trust
// distance and lineage proximity. The cross-functional rule is baked into the
// WHERE clause: only opposite-side users are ever returned.
export async function surfaceReferrers(role, { limit = 12 } = {}) {
  const referrerSide = oppositeSide(role.side);

  // best_vouch = closest (min) vouch_number for this user, optionally focused
  // on the role's target lineage. Lower is better.
  const { rows } = await query(
    `
    SELECT u.id,
           u.name,
           u.side,
           u.role_title,
           u.current_employer,
           u.is_referrer,
           MIN(vs.vouch_number)                       AS best_vouch,
           MIN(CASE WHEN vs.lineage_id = $2
                    THEN vs.vouch_number END)          AS lineage_vouch,
           count(distinct ve.vouchee_id)               AS people_vouched_for
      FROM users u
      LEFT JOIN vouch_scores vs ON vs.user_id = u.id
      LEFT JOIN vouch_edges ve  ON ve.voucher_id = u.id
     WHERE u.side = $1               -- cross-functional rule: opposite side only
       AND u.is_referrer = TRUE
       AND u.id <> $3                -- never the operator themselves
     GROUP BY u.id
     ORDER BY
       -- lineage proximity first (nulls last), then overall trust distance,
       -- then breadth of vouching history.
       (lineage_vouch IS NULL),
       lineage_vouch ASC NULLS LAST,
       (best_vouch IS NULL),
       best_vouch ASC NULLS LAST,
       people_vouched_for DESC
     LIMIT $4
    `,
    [referrerSide, role.lineage_id || -1, role.operator_id, limit]
  );

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    side: r.side,
    roleTitle: r.role_title,
    employer: r.current_employer,
    bestVouch: r.best_vouch === null ? null : Number(r.best_vouch),
    lineageVouch: r.lineage_vouch === null ? null : Number(r.lineage_vouch),
    peopleVouchedFor: Number(r.people_vouched_for),
  }));
}

// Dormant high-value Referrers: people who have successfully vouched (their
// vouch led to a hire) but have gone quiet.
export async function dormantReferrers({ dormantDays = 45, limit = 10 } = {}) {
  const { rows } = await query(
    `
    SELECT u.id,
           u.name,
           u.side,
           u.role_title,
           u.current_employer,
           u.last_active_at,
           count(distinct ms.id) AS successful_matches
      FROM users u
      JOIN match_states ms ON ms.referrer_id = u.id AND ms.state = 'hired'
     WHERE u.last_active_at < now() - ($1 || ' days')::interval
     GROUP BY u.id
     ORDER BY successful_matches DESC, u.last_active_at ASC
     LIMIT $2
    `,
    [dormantDays, limit]
  );

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    side: r.side,
    roleTitle: r.role_title,
    employer: r.current_employer,
    lastActiveAt: r.last_active_at,
    successfulMatches: Number(r.successful_matches),
  }));
}
