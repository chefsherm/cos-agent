import { query } from "@/lib/db";

// Touches the DB — don't prerender at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await query(`SELECT id, name, anchor_name FROM lineages ORDER BY name`);
    return Response.json({ lineages: rows });
  } catch (err) {
    console.error("lineages error:", err);
    return Response.json({ lineages: [] });
  }
}
