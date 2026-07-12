import { query } from "@/lib/db";
import { verifyPassword, createSessionCookie } from "@/lib/auth";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return Response.json({ error: "email and password are required" }, { status: 400 });
    }

    const { rows } = await query(
      `SELECT id, email, name, side, password_hash, is_operator
         FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await query(`UPDATE users SET last_active_at = now() WHERE id = $1`, [user.id]);
    createSessionCookie(user);
    return Response.json({
      user: { id: user.id, email: user.email, name: user.name, side: user.side, is_operator: user.is_operator },
    });
  } catch (err) {
    console.error("login error:", err);
    return Response.json({ error: "Login failed." }, { status: 500 });
  }
}
