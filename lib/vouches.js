// Candidate Collective — Vouch collection
// A member requests vouches from people who know their work. Each request gets
// a private link; the recipient opens a short CC chat that captures their vouch.
// This is CC's analog to TalentPluto's outbound reference-request flow.

import crypto from "crypto";
import { CC_PRIMER, CC_VOCAB } from "@/lib/onboarding";

const STORE = "cc-vouches.json";

// In-memory fallback so local dev works without Vercel Blob. Kept on
// globalThis because Next.js bundles each route handler separately — a plain
// module-level variable would NOT be shared across routes in one process.
// In production, BLOB_READ_WRITE_TOKEN is set (auto-provisioned with Vercel
// Blob) and state persists across serverless invocations instead.
function mem() {
  if (!globalThis.__CC_VOUCHES__) globalThis.__CC_VOUCHES__ = { requests: [] };
  return globalThis.__CC_VOUCHES__;
}

async function readStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return mem();
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "cc-vouches" });
    if (blobs.length > 0) {
      const sorted = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const res = await fetch(sorted[0].url, { cache: "no-store" });
      const data = await res.json();
      if (data && Array.isArray(data.requests)) return data;
    }
  } catch (e) {
    console.error("vouches readStore error:", e);
  }
  return { requests: [] };
}

async function writeStore(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    globalThis.__CC_VOUCHES__ = data;
    return;
  }
  const { put } = await import("@vercel/blob");
  await put(STORE, JSON.stringify(data), { access: "public", addRandomSuffix: false });
}

function token() {
  return crypto.randomUUID().replace(/-/g, "");
}

// Never expose the phone number to the recipient-facing surface.
export function publicView(r) {
  if (!r) return null;
  return {
    token: r.token,
    requester: r.requester,
    contactName: r.contactName,
    status: r.status,
  };
}

export async function listRequests(requester) {
  const { requests } = await readStore();
  const rows = requester
    ? requests.filter((r) => (r.requester || "").toLowerCase() === requester.toLowerCase())
    : requests;
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function createRequest({ requester, contactName, contactPhone }) {
  const data = await readStore();
  const req = {
    token: token(),
    requester: (requester || "").trim(),
    contactName: (contactName || "").trim(),
    contactPhone: (contactPhone || "").trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
    collectedAt: null,
    vouch: null,
  };
  data.requests = [req, ...(data.requests || [])];
  await writeStore(data);
  return req;
}

export async function getRequest(tok) {
  const { requests } = await readStore();
  return requests.find((r) => r.token === tok) || null;
}

export async function saveVouch(tok, vouch) {
  const data = await readStore();
  const r = (data.requests || []).find((x) => x.token === tok);
  if (!r) return null;
  r.vouch = vouch;
  r.status = "collected";
  r.collectedAt = new Date().toISOString();
  await writeStore(data);
  return r;
}

// ---- Prompts -------------------------------------------------------------

export function buildVouchCollectPrompt(memberName) {
  const who = memberName || "the member";
  return `You are the Candidate Collective guide. You're collecting a short, honest vouch for ${who} from someone who has worked with them. On Candidate Collective, trust is the only currency — a vouch means personally standing behind someone's work.

${CC_PRIMER}

${CC_VOCAB}

Your job:
- Warm, human, brief. One question at a time — this is a quick conversation, not a form.
- Find out: how they know ${who}'s work, what ${who} is genuinely great at, and whether they'd stand behind them.
- Ask at most 2–3 questions total. Once you have enough, thank them warmly and tell them they can tap "Finish & submit vouch" whenever they're ready.
- Never put words in their mouth or invent praise. If they're lukewarm, that's fine — capture it honestly.
- Keep every reply to 1–3 short sentences.`;
}

export function buildVouchSummaryPrompt(memberName) {
  const who = memberName || "the member";
  return `You turn a short conversation into a clean vouch for the Candidate Collective team, capturing what this person said about ${who}.

${CC_PRIMER}

${CC_VOCAB}

Write plain text (no markdown headers, no code fences). Only what the person actually said — if something wasn't covered, write "Not specified". Keep it under 140 words. Use these labeled lines:
How they know ${who}:
What ${who} is great at:
Would stand behind them:
Notable:`;
}
