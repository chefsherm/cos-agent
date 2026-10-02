import { test, describe, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PLAYBOOKS } from "../lib/ceo.js";
import { authorizeWithLedger, admit, recordOutcome, suppress } from "../lib/ceo-ledger.js";

const KEY = "test-signing-key";
const T0 = Date.parse("2026-10-02T15:00:00Z");
const HOUR = 3_600_000;
const SAFE = { reversible: true, sensitiveData: false, externalCommitment: false };
let pg, db, n = 0;

const send = (target, over = {}) => ({
  id: `act_${++n}`, tool: "gmail", op: "send", account: "founder@candidatecollective.com", external: true, ...SAFE,
  target, contactSource: "CC platform signup", legitimateReason: "Registered Referrer",
  content: "Do you know someone? Vouch for them and make the introduction through CC.", playbook: "pilot", ...over,
});
const opts = (now = T0) => ({ db, stage: 2, paused: false, signingKey: KEY, now });
const adm = (token, action, now = T0) => admit(db, token, action, { stage: 2, paused: false, signingKey: KEY, now });

before(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync(new URL("../db/ledger.sql", import.meta.url), "utf8"));
  db = {
    query: (t, p) => pg.query(t, p),
    transaction: (fn) => pg.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })),
  };
});
beforeEach(() => { PLAYBOOKS.pilot = { caps: { maxTouches: 1, windowDays: 30, minHoursBetween: 72 } }; });
afterEach(() => { delete PLAYBOOKS.pilot; });

describe("full loop", () => {
  test("authorize → admit → outcome writes linked receipts and a touch", async () => {
    const a = send("loop@example.com");
    const d = await authorizeWithLedger(a, opts());
    assert.equal(d.decision, "ALLOW");
    const ad = await adm(d.token, a);
    assert.equal(ad.ok, true);
    const o = await recordOutcome(db, ad.attempt_id, { terminalState: "committed", providerRequestId: "gmail-123" }, { now: T0 });
    assert.equal(o.ok, true);
    const t = await pg.query("SELECT channel, result FROM ceo_contact_touches WHERE attempt_id = $1", [ad.attempt_id]);
    assert.deepEqual(t.rows, [{ channel: "gmail", result: "committed" }]);
  });
  test("Green ClickUp logging admits without a contact", async () => {
    process.env.CC_CLICKUP_ALLOWED_LIST_IDS = "901418025585";
    const a = { id: `act_${++n}`, tool: "clickup", op: "create_task", workspace: "90141390262", listId: "901418025585", ...SAFE };
    const d = await authorizeWithLedger(a, { ...opts(), stage: 1 });
    assert.equal(d.decision, "ALLOW");
    assert.equal((await admit(db, d.token, a, { stage: 1, paused: false, signingKey: KEY, now: T0 })).ok, true);
    delete process.env.CC_CLICKUP_ALLOWED_LIST_IDS;
  });
});

describe("single use", () => {
  test("a token admits once", async () => {
    const a = send("replay@example.com");
    const d = await authorizeWithLedger(a, opts());
    assert.equal((await adm(d.token, a)).ok, true);
    assert.deepEqual((await adm(d.token, a)).reason_codes, ["TOKEN_ALREADY_CONSUMED"]);
  });
  test("concurrent admissions of one token: exactly one wins", async () => {
    const a = send("race@example.com");
    const d = await authorizeWithLedger(a, opts());
    const rs = await Promise.all([adm(d.token, a), adm(d.token, a), adm(d.token, a)]);
    assert.equal(rs.filter((r) => r.ok).length, 1);
  });
  test("two tokens for one contact cannot both pass the cap, even concurrently", async () => {
    const a1 = send("double@example.com"), a2 = send("double@example.com");
    const d1 = await authorizeWithLedger(a1, opts()), d2 = await authorizeWithLedger(a2, opts());
    assert.equal(d1.decision, "ALLOW");
    assert.equal(d2.decision, "ALLOW"); // both issued before either is admitted
    const rs = await Promise.all([adm(d1.token, a1), adm(d2.token, a2)]);
    assert.equal(rs.filter((r) => r.ok).length, 1);
    assert.ok(rs.find((r) => !r.ok).reason_codes.includes("TOUCH_CAP_REACHED"));
  });
});

describe("caps across channels and aliases", () => {
  test("an alias cannot evade the touch cap", async () => {
    const a = send("Pat.Lee@gmail.com");
    const d = await authorizeWithLedger(a, opts());
    const ad = await adm(d.token, a);
    await recordOutcome(db, ad.attempt_id, { terminalState: "committed" }, { now: T0 });
    const r = await authorizeWithLedger(send("patlee+cc@googlemail.com"), opts(T0 + 100 * HOUR));
    assert.ok(r.reason_codes.includes("TOUCH_CAP_REACHED"));
  });
  test("switching channel to Apollo counts against the same cap", async () => {
    const a = send("channel@example.com");
    const ad = await adm((await authorizeWithLedger(a, opts())).token, a);
    await recordOutcome(db, ad.attempt_id, { terminalState: "committed" }, { now: T0 });
    const r = await authorizeWithLedger(send("channel@example.com", { tool: "apollo", op: "enroll_in_sequence" }), opts(T0 + 100 * HOUR));
    assert.ok(r.reason_codes.includes("TOUCH_CAP_REACHED"));
  });
  test("an in-flight admission counts before its outcome arrives", async () => {
    const a = send("inflight@example.com");
    await adm((await authorizeWithLedger(a, opts())).token, a);
    const r = await authorizeWithLedger(send("inflight@example.com"), opts(T0 + 100 * HOUR));
    assert.ok(r.reason_codes.includes("TOUCH_CAP_REACHED"));
  });
  test("a failed send does not count", async () => {
    PLAYBOOKS.pilot.caps.minHoursBetween = 0;
    const a = send("bounce@example.com");
    const ad = await adm((await authorizeWithLedger(a, opts())).token, a);
    await recordOutcome(db, ad.attempt_id, { terminalState: "failed", failureCode: "SMTP_421" }, { now: T0 });
    assert.equal((await authorizeWithLedger(send("bounce@example.com"), opts(T0 + HOUR))).decision, "ALLOW");
  });
  test("the window expires", async () => {
    const a = send("window@example.com");
    const ad = await adm((await authorizeWithLedger(a, opts())).token, a);
    await recordOutcome(db, ad.attempt_id, { terminalState: "committed" }, { now: T0 });
    assert.equal((await authorizeWithLedger(send("window@example.com"), opts(T0 + 31 * 24 * HOUR))).decision, "ALLOW");
  });
});

describe("suppression", () => {
  test("an opt-out blocks every alias and channel", async () => {
    assert.equal((await suppress(db, "Opt.Out@gmail.com", { source: "reply", reason: "opted_out", recordedBy: "cc-ai-ceo", now: T0 })).ok, true);
    for (const a of [send("optout+x@gmail.com"), send("opt.out@gmail.com", { tool: "apollo", op: "enroll_in_sequence" })]) {
      assert.ok((await authorizeWithLedger(a, opts(T0 + HOUR))).reason_codes.includes("CONTACT_SUPPRESSED"));
    }
  });
  test("a token issued before the opt-out cannot be admitted", async () => {
    const a = send("late-optout@example.com");
    const d = await authorizeWithLedger(a, opts());
    await suppress(db, "late-optout@example.com", { source: "reply", reason: "opted_out", recordedBy: "cc-ai-ceo", now: T0 });
    assert.ok((await adm(d.token, a, T0 + 1000)).reason_codes.includes("CONTACT_SUPPRESSED"));
  });
  test("suppression requires source, reason, and recorder", async () => {
    assert.deepEqual((await suppress(db, "x@example.com", { now: T0 })).reason_codes, ["SUPPRESSION_FIELDS_REQUIRED"]);
  });
});

describe("circumvention memory", () => {
  test("a Red decision for a person escalates a different channel to the same person", async () => {
    const red = await authorizeWithLedger(send("route@example.com", { categories: ["new_external_terms"] }), opts());
    assert.equal(red.decision, "ESCALATE");
    const r = await authorizeWithLedger(send("route@example.com", { tool: "apollo", op: "enroll_in_sequence" }), opts(T0 + HOUR));
    assert.deepEqual(r.reason_codes, ["CIRCUMVENTION_SUSPECTED"]);
  });
});

describe("receipts", () => {
  test("one outcome per attempt", async () => {
    const a = send("once@example.com");
    const ad = await adm((await authorizeWithLedger(a, opts())).token, a);
    await recordOutcome(db, ad.attempt_id, { terminalState: "committed" }, { now: T0 });
    assert.deepEqual((await recordOutcome(db, ad.attempt_id, { terminalState: "failed" }, { now: T0 })).reason_codes, ["OUTCOME_ALREADY_RECORDED"]);
  });
  test("an outcome must cite a real attempt", async () => {
    assert.deepEqual((await recordOutcome(db, "00000000-0000-0000-0000-000000000000", { terminalState: "committed" })).reason_codes, ["ATTEMPT_NOT_FOUND"]);
  });
  test("invalid terminal state is refused", async () => {
    assert.deepEqual((await recordOutcome(db, "x", { terminalState: "sent" })).reason_codes, ["INVALID_TERMINAL_STATE"]);
  });
  const COLUMN = { ceo_decisions: "created_at", ceo_attempts: "created_at", ceo_outcomes: "created_at", ceo_contact_suppression: "reason", ceo_contact_touches: "result" };
  for (const [table, col] of Object.entries(COLUMN)) {
    test(`${table} refuses UPDATE, DELETE, and TRUNCATE`, async () => {
      await assert.rejects(pg.query(`UPDATE ${table} SET ${col} = ${col}`), /append-only/);
      await assert.rejects(pg.query(`DELETE FROM ${table}`), /append-only/);
      await assert.rejects(pg.query(`TRUNCATE ${table} CASCADE`), /append-only/);
    });
  }
  test("the ledger holds no raw addresses or message content", async () => {
    const dump = JSON.stringify([
      ...(await pg.query("SELECT * FROM ceo_decisions")).rows, ...(await pg.query("SELECT * FROM ceo_attempts")).rows,
      ...(await pg.query("SELECT * FROM ceo_contact_suppression")).rows, ...(await pg.query("SELECT * FROM ceo_contact_touches")).rows,
    ]);
    assert.doesNotMatch(dump, /@example\.com|@gmail\.com|Do you know someone/);
  });
});

describe("fail closed", () => {
  test("no ledger: Amber denies and nothing admits", async () => {
    const a = send("nodb@example.com");
    const d = await authorizeWithLedger(a, { ...opts(), db: null });
    assert.ok(d.reason_codes.includes("CONTACT_STATE_UNAVAILABLE"));
    assert.deepEqual((await admit(null, "x.y", a)).reason_codes, ["LEDGER_UNAVAILABLE"]);
  });
  test("an ALLOW that cannot be recorded becomes DENY with no token", async () => {
    const broken = { query: async () => { throw new Error("down"); }, transaction: async () => { throw new Error("down"); } };
    process.env.CC_CLICKUP_ALLOWED_LIST_IDS = "901418025585";
    const a = { id: "g", tool: "clickup", op: "comment", workspace: "90141390262", listId: "901418025585", ...SAFE };
    const d = await authorizeWithLedger(a, { ...opts(), db: broken, stage: 1 });
    delete process.env.CC_CLICKUP_ALLOWED_LIST_IDS;
    assert.deepEqual(d.reason_codes, ["LEDGER_UNAVAILABLE"]);
    assert.equal(d.token, undefined);
  });
});
