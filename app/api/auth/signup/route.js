import { query } from "@/lib/db";
import { hashPassword, createSessionCookie } from "@/lib/auth";

export async function POST(req) {
  try {
    const { email, password, name, side, roleTitle, employer, isOperator } =
      await req.json();

    if (!email || !password || !name || !side) {
      return Response.json(
        { error: "email, password, name, and side are required" },
        { status: 400 }
      );
    }
    if (!["foh", "boh"].includes(side)) {
      return Response.json({ error: "side must be 'foh' or 'boh'" }, { status: 400 });
    }

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [
      email.toLowerCase(),
    ]);
    if (existing.rows.length) {
      return Response.json({ error: "An account with that email exists." }, { status: 409 });
    }

    const { rows } = await query(
      `INSERT INTO users (email, password_hash, name, side, role_title, current_employer, is_operator)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, name, side, is_operator`,
      [
        email.toLowerCase(),
        hashPassword(password),
        name,
        side,
        roleTitle || null,
        employer || null,
        !!isOperator,
      ]
    );

    const user = rows[0];
    createSessionCookie(user);
    return Response.json({ user });
  } catch (err) {
    console.error("signup error:", err);
    return Response.json({ error: "Signup failed." }, { status: 500 });
  }
}
