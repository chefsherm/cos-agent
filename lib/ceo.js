// CC AI CEO — runtime policy gate.
// The system prompt (lib/ceo-prompt.js) tells the model the rules; this module
// enforces them in code, so a model that talks itself into "act, don't ask"
// still cannot run an action the framework forbids.

import { CEO_FRAMEWORK, CEO_FRAMEWORK_VERSION } from "@/lib/ceo-prompt";

export const TIERS = { GREEN: "green", AMBER: "amber", RED: "red", PROHIBITED: "prohibited" };

// Read from env so neither the model nor the app can change them at runtime.
// Pausing or advancing a stage is a deploy-level decision that only Sherm makes.
export function currentStage() {
  const n = parseInt(process.env.CEO_STAGE || "1", 10);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1;
}

export function isPaused() {
  return process.env.CEO_PAUSED === "true";
}

// Red categories: the four gates plus every red line under Additional controls.
export const RED_CATEGORIES = {
  signature: "Signature required (contracts, Founding Partner equity documents)",
  money_movement: "Money movement (wires, payroll, vendor payments)",
  investor_commitment: "Investor-facing commitment (term sheets, binding raise terms)",
  deal_room: "CC-hosted deal room work (pending securities counsel review)",
  employment_sensitive: "Employment-sensitive action (rejections, adverse actions, comp guidance, background checks, verification claims)",
  sensitive_personal_data: "Sensitive personal data (compensation, health, immigration, demographic)",
  public_reputation: "Public reputation move (criticism, rebuttals, apologies, announcements, endorsements, guarantees)",
  new_external_terms: "New external terms (referral fees, discounts, exclusivity, timelines, data sharing)",
  escalated_communication: "Escalated communication (legal, harassment, safety, media, regulators, security)",
  policy_change: "Policy change (vouch eligibility, graph scoring, matching rules, pricing, incentives, retention)",
};

// Never executable by the AI CEO, even with Sherm's approval: the AI is never a
// party to a vouch, and fabrication is never authorized.
export const PROHIBITED_CATEGORIES = {
  vouch: "Creating, approving, or blocking a vouch — strictly between a Referrer, a candidate, and an employer",
  fabrication: "Fabricating or implying a vouch, introduction, mutual connection, or Sherm's personal knowledge",
  excluded_workspace: "Touching ClickUp workspace 9017065181 (dev-only)",
};

// Agent Authority Register. Stage 2 prerequisite; this is the v1 baseline and
// must be reviewed by its owner before any Amber action is enabled.
export const AUTHORITY_REGISTER = {
  version: CEO_FRAMEWORK_VERSION,
  owner: "Sherm",
  reviewCadence: "monthly",
  tools: {
    gmail: {
      status: "connected",
      green: ["read", "search", "draft", "label"],
      amber: ["send", "reply"],
      prohibited: ["forward_external_without_playbook", "delete_sent_mail"],
    },
    apollo: {
      status: "connected",
      green: ["search_contacts", "dedupe_contacts"],
      amber: ["enroll_in_sequence", "remove_from_sequence"],
      prohibited: ["overlapping_sequence"],
    },
    clickup: {
      status: "connected",
      workspace: "90141390262",
      green: ["create_task", "update_task", "comment", "organize"],
      amber: [],
      prohibited: ["delete_task_without_log"],
    },
    calendar: {
      status: "connected",
      green: ["read", "suggest_time"],
      amber: ["create_event", "update_event", "respond_to_event"],
      prohibited: [],
    },
    drive: {
      status: "connected",
      green: ["read", "create_file", "organize"],
      amber: [],
      prohibited: [],
      // Sharing outside CC is a data-exposure decision: always Red.
    },
    platform_crm: { status: "not_connected", green: [], amber: [], prohibited: [] },
    dripify: { status: "not_connected", green: [], amber: [], prohibited: [] },
    make: { status: "not_connected", green: [], amber: [], prohibited: [] },
  },
};

// Approved outreach playbooks with numeric caps. Empty on purpose: the Outreach
// Playbook is a Stage 2 prerequisite, and no Amber send runs without one.
export const PLAYBOOKS = {};

// Fields every external action must carry before it runs (Action Ledger).
export const LEDGER_FIELDS = ["id", "tool", "account", "target", "contactSource", "content"];

/**
 * Classify a proposed action.
 * action: { tool, op, external, reversible, sensitiveData, externalCommitment,
 *           categories: string[], playbook, workspace }
 */
export function classifyAction(action = {}) {
  const categories = action.categories || [];
  const reasons = [];

  const prohibited = categories.filter((c) => c in PROHIBITED_CATEGORIES);
  if (action.tool === "clickup" && action.workspace && action.workspace !== AUTHORITY_REGISTER.tools.clickup.workspace) {
    prohibited.push("excluded_workspace");
  }
  if (prohibited.length) {
    return { tier: TIERS.PROHIBITED, reasons: prohibited.map((c) => PROHIBITED_CATEGORIES[c]) };
  }

  const red = categories.filter((c) => c in RED_CATEGORIES);
  if (red.length) {
    return { tier: TIERS.RED, reasons: red.map((c) => RED_CATEGORIES[c]) };
  }

  const tool = AUTHORITY_REGISTER.tools[action.tool];
  if (!tool) return { tier: TIERS.RED, reasons: [`Tool "${action.tool}" is not in the Authority Register`] };
  if (tool.status !== "connected") {
    return { tier: TIERS.RED, reasons: [`${action.tool} is not connected and separately authorized`] };
  }
  if (tool.prohibited.includes(action.op)) {
    return { tier: TIERS.PROHIBITED, reasons: [`${action.tool}.${action.op} is prohibited in the Authority Register`] };
  }

  // Uncertainty rule: anything not clearly safe falls to Red.
  if (action.reversible !== true) reasons.push("Not clearly reversible");
  if (action.sensitiveData !== false) reasons.push("Sensitive data not ruled out");
  if (action.externalCommitment !== false) reasons.push("External commitment not ruled out");
  if (reasons.length) return { tier: TIERS.RED, reasons };

  if (action.external !== true && tool.green.includes(action.op)) {
    return { tier: TIERS.GREEN, reasons: ["Internal, reversible, no sensitive data, no commitment"] };
  }
  if (tool.amber.includes(action.op)) {
    return { tier: TIERS.AMBER, reasons: ["External action permitted only through an approved playbook and cap"] };
  }
  return { tier: TIERS.RED, reasons: [`${action.tool}.${action.op} is outside the Authority Register`] };
}

/**
 * Decide whether an action may run now. Returns the tier, whether it is
 * allowed, the ClickUp log prefix to use, and why.
 */
export function authorize(action = {}, { stage = currentStage(), paused = isPaused() } = {}) {
  if (paused) {
    return { allowed: false, tier: null, log: null, reasons: ["Kill switch engaged — all autonomous action halted until Sherm resumes"] };
  }

  const { tier, reasons } = classifyAction(action);

  if (tier === TIERS.PROHIBITED) {
    return { allowed: false, tier, log: null, reasons };
  }
  if (tier === TIERS.RED) {
    return { allowed: false, tier, log: "[NEEDS SHERM]", reasons, escalation: escalationTemplate(action, reasons) };
  }
  if (tier === TIERS.GREEN) {
    return { allowed: true, tier, log: "[DONE]", logTiming: "after", reasons };
  }

  // Amber.
  const blockers = [];
  if (stage < 2) blockers.push("Stage 1 — external sends are not enabled; save as a draft instead");
  if (!action.playbook || !PLAYBOOKS[action.playbook]) blockers.push("No approved playbook with numeric caps");
  const missing = LEDGER_FIELDS.filter((f) => !action[f]);
  if (missing.length) blockers.push(`Action Ledger fields missing: ${missing.join(", ")}`);

  if (blockers.length) return { allowed: false, tier, log: "[IN-PROGRESS]", reasons: [...reasons, ...blockers] };
  return { allowed: true, tier, log: "[DONE]", logTiming: "immediate", reasons };
}

// The exact shape a [NEEDS SHERM] flag must carry.
export function escalationTemplate(action, reasons) {
  return {
    action: action.op ? `${action.tool}.${action.op}` : action.description || null,
    target: action.target || null,
    terms: action.content || null,
    deadline: action.deadline || null,
    riskBasis: reasons,
    continuesMeanwhile: action.continuesMeanwhile || null,
  };
}

export function buildCeoSystemPrompt({ stage = currentStage(), paused = isPaused() } = {}) {
  const status = paused
    ? "KILL SWITCH ENGAGED. Take no action of any kind. Answer questions and report status only."
    : `CURRENT STAGE: ${stage}. ${
        stage < 2
          ? "Read, organize, draft, and produce the daily digest only. Every external send stays a draft."
          : "Capped sends only through approved playbooks with numeric caps."
      }`;

  const connected = Object.entries(AUTHORITY_REGISTER.tools)
    .map(([name, t]) => `- ${name}: ${t.status}`)
    .join("\n");

  return `${CEO_FRAMEWORK}

RUNTIME STATUS (framework version ${CEO_FRAMEWORK_VERSION})
${status}
Tools:
${connected}

When you propose an action, state its tier (GREEN, AMBER, RED) and why. A server-side gate re-checks every action; if it disagrees with you, it wins.`;
}
