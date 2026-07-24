// Application-level encryption at rest for stored data.
// Uses AES-256-GCM with a key derived from DATA_ENCRYPTION_KEY. This lets us
// keep sensitive JSON (names, vouch text) opaque even when it lives in a
// public Vercel Blob — the URL may be reachable, but the contents are useless
// without the server-only key. Falls back to plaintext when no key is set so
// existing/local deployments keep working; set the key to turn on encryption.

import crypto from "crypto";

const PREFIX = "enc:v1:";
const RAW = process.env.DATA_ENCRYPTION_KEY;

export function encryptionEnabled() {
  return !!RAW;
}

function key() {
  // Derive a stable 32-byte key from whatever secret string is provided.
  return crypto.createHash("sha256").update(String(RAW)).digest();
}

export function isCiphertext(s) {
  return typeof s === "string" && s.startsWith(PREFIX);
}

export function encrypt(plain) {
  if (!RAW) return plain; // no key configured -> store as-is
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload) {
  if (!isCiphertext(payload)) return payload; // legacy plaintext
  if (!RAW) throw new Error("DATA_ENCRYPTION_KEY required to read encrypted data");
  const raw = Buffer.from(payload.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
