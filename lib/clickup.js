// ClickUp API — the live CRM spine (Contact Spine + role sync).
//
// HARD BLOCK: workspace 9017065181 must never be touched. This is not a
// convention — it is a check enforced at two layers:
//   1. Runtime: assertWorkspaceAllowed() throws if the blocked ID appears in
//      ANY request, so no ClickUp call can ever reach it.
//   2. Build:   scripts/check-workspace-guard.js scans the source tree and
//      fails `npm run build` (via prebuild) if the blocked ID literal appears
//      anywhere outside this guard definition.
//
// The only allowed workspace is 90141390262.

export const ALLOWED_WORKSPACE_ID = "90141390262";
export const BLOCKED_WORKSPACE_ID = "9017065181";

const BASE = "https://api.clickup.com/api/v2";

// Throws if the request references anything other than the allowed workspace,
// or contains the blocked workspace ID anywhere in its path/params/body.
export function assertWorkspaceAllowed(candidate) {
  const id = String(candidate ?? "");
  if (id === BLOCKED_WORKSPACE_ID) {
    throw new Error(
      `BLOCKED: ClickUp workspace ${BLOCKED_WORKSPACE_ID} is hard-blocked and may never be accessed.`
    );
  }
  if (id !== ALLOWED_WORKSPACE_ID) {
    throw new Error(
      `Refused: ClickUp workspace ${id || "<empty>"} is not the allowed workspace (${ALLOWED_WORKSPACE_ID}).`
    );
  }
  return id;
}

// Scans an arbitrary string (path, serialized body) for the blocked ID so a
// blocked reference can't slip through in a nested field.
function assertNoBlockedReference(haystack) {
  if (String(haystack ?? "").includes(BLOCKED_WORKSPACE_ID)) {
    throw new Error(
      `BLOCKED: request references forbidden workspace ${BLOCKED_WORKSPACE_ID}.`
    );
  }
}

function token() {
  const t = process.env.CLICKUP_API_TOKEN;
  if (!t) throw new Error("CLICKUP_API_TOKEN is not set");
  return t;
}

async function request(path, { method = "GET", body } = {}) {
  const serialized = body ? JSON.stringify(body) : undefined;
  assertNoBlockedReference(path);
  assertNoBlockedReference(serialized);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: token(),
      "Content-Type": "application/json",
    },
    body: serialized,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ClickUp ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// --- Contact Spine reads --------------------------------------------------

// Verifies we are pointed at the allowed workspace before any team-scoped read.
export async function getAllowedTeam() {
  assertWorkspaceAllowed(ALLOWED_WORKSPACE_ID);
  const data = await request(`/team/${ALLOWED_WORKSPACE_ID}`);
  return data.team;
}

// Pulls tasks from a list in the Contact Spine (workspace 90141390262).
export async function getContactSpineTasks(listId) {
  assertWorkspaceAllowed(ALLOWED_WORKSPACE_ID);
  const data = await request(`/list/${listId}/task?include_closed=true`);
  return data.tasks || [];
}

// --- Role sync writes -----------------------------------------------------

// Writes a role posting into the Contact Spine as a task.
export async function createRoleTask(listId, role) {
  assertWorkspaceAllowed(ALLOWED_WORKSPACE_ID);
  return request(`/list/${listId}/task`, {
    method: "POST",
    body: {
      name: `Role: ${role.title} — ${role.venue}`,
      description: role.description || "",
      tags: ["cc-role", role.side],
    },
  });
}

// Advances a match state onto its Contact Spine task.
export async function updateTaskStatus(taskId, status) {
  assertWorkspaceAllowed(ALLOWED_WORKSPACE_ID);
  return request(`/task/${taskId}`, {
    method: "PUT",
    body: { status },
  });
}
