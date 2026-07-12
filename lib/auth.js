import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

const COOKIE = "cc_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

// --- Password hashing (scrypt, no native deps) ---------------------------
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, derived] = stored.split(":");
  const check = scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, "hex");
  return check.length === expected.length && timingSafeEqual(check, expected);
}

// --- Stateless signed-cookie sessions ------------------------------------
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function unsign(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionCookie(user) {
  const token = sign({
    uid: user.id,
    email: user.email,
    exp: Date.now() + MAX_AGE * 1000,
  });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// Reads the signed cookie and loads the current user. Returns null if none.
export async function getSessionUser() {
  const token = cookies().get(COOKIE)?.value;
  const payload = unsign(token);
  if (!payload) return null;
  const { rows } = await query(
    `SELECT id, email, name, side, role_title, current_employer,
            is_operator, is_referrer
       FROM users WHERE id = $1`,
    [payload.uid]
  );
  return rows[0] || null;
}
