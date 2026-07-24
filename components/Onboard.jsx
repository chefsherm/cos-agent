"use client";

import { useState, useEffect, useRef } from "react";
import { PATHS, READINESS, readinessBand } from "@/lib/onboarding";

function md(t) {
  if (!t) return "";
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

// Candidate Collective spark mark
function Spark({ size = 40, color = "var(--text)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2c.4 4.6 2.4 6.6 7 7-4.6.4-6.6 2.4-7 7-.4-4.6-2.4-6.6-7-7 4.6-.4 6.6-2.4 7-7z"
        fill={color}
      />
    </svg>
  );
}

// Circular score ring
function ScoreRing({ score, color }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132">
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
      <circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 66 66)"
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x="66" y="62" textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--text)">
        {score}
      </text>
      <text x="66" y="84" textAnchor="middle" fontSize="11" fill="var(--muted)">
        / 100
      </text>
    </svg>
  );
}

export default function Onboard() {
  const [path, setPath] = useState(null); // null | "employer" | "referrer"
  const [view, setView] = useState("chat"); // "chat" | "scan"
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // readiness scan state
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState(null);
  const [scanError, setScanError] = useState("");

  // submit-to-CC state
  const [note, setNote] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const chatEnd = useRef(null);
  const stepTimer = useRef(null);

  useEffect(() => {
    if (view === "chat") chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, view]);

  useEffect(() => () => clearInterval(stepTimer.current), []);

  const choosePath = (key) => {
    setPath(key);
    setView("chat");
    setMessages([{ role: "assistant", content: PATHS[key].intro }]);
  };

  const startOver = () => {
    setPath(null);
    setView("chat");
    setMessages([]);
    setInput("");
    setScanInput("");
    setResult(null);
    setScanError("");
    setNote("");
    setContact({ name: "", email: "", phone: "" });
    setSubmitted(false);
    setSubmitError("");
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, path }),
      });
      const data = await r.json();
      setMessages([
        ...next,
        { role: "assistant", content: data.reply || "Sorry — something went wrong. Try again?" },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection error. Give it another go." }]);
    }
    setLoading(false);
  };

  const openScan = () => {
    setView("scan");
    setScanError("");
    // Seed from the member's own words in the conversation.
    if (!scanInput) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser) setScanInput(lastUser.content);
    }
  };

  const runScan = async () => {
    if (scanning) return;
    setScanning(true);
    setResult(null);
    setScanError("");
    setScanStep(0);
    const steps = READINESS[path].steps;
    stepTimer.current = setInterval(() => {
      setScanStep((s) => (s + 1) % steps.length);
    }, 1100);
    try {
      const r = await fetch("/api/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, input: scanInput, messages }),
      });
      const data = await r.json();
      if (data.insufficient) {
        setScanError("Tell me a bit more first — there wasn't enough to score yet.");
      } else if (data.result) {
        setResult(data.result);
      } else {
        setScanError("The check couldn't complete. Give it another run.");
      }
    } catch {
      setScanError("Connection error. Give it another run.");
    }
    clearInterval(stepTimer.current);
    setScanning(false);
  };

  const openSubmit = () => {
    setView("submit");
    setSubmitError("");
  };

  const doSubmit = async () => {
    if (submitting) return;
    if (!contact.name.trim() || !contact.email.trim()) {
      setSubmitError("Add your name and email so the team can reach you.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, messages, note, contact }),
      });
      const data = await r.json();
      if (data.ok) setSubmitted(true);
      else setSubmitError(data.error || "Couldn't send that. Try again.");
    } catch {
      setSubmitError("Connection error. Try again.");
    }
    setSubmitting(false);
  };

  const active = path ? PATHS[path] : null;
  const accent = active?.accent || "var(--text)";
  const cfg = path ? READINESS[path] : null;

  return (
    <>
      <style>{`
        .ob-wrap { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; padding: 28px 22px 20px; }
        .ob-mark { display: flex; justify-content: center; margin: 8px 0 22px; }
        .ob-hero-h { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
        .ob-hero-p { font-size: 15px; color: var(--muted); margin-top: 12px; line-height: 1.6; }
        .ob-paths { display: flex; flex-direction: column; gap: 12px; margin-top: 30px; }
        .ob-path { text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; transition: border-color .15s, transform .05s; }
        .ob-path:hover { border-color: #cfcfc8; }
        .ob-path:active { transform: scale(0.995); }
        .ob-path-ic { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 19px; }
        .ob-path-t { font-size: 16px; font-weight: 600; }
        .ob-path-s { font-size: 13px; color: var(--muted); margin-top: 2px; }
        .ob-path-arrow { margin-left: auto; color: var(--muted); font-size: 18px; }
        .ob-foot { margin-top: auto; padding-top: 24px; text-align: center; font-size: 12px; color: var(--muted); }
        .ob-foot a { color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--border); }
        .ob-foot a:hover { color: var(--text); }

        .ob-top { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--border-soft); }
        .ob-chip { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
        .ob-back { margin-left: auto; font-size: 13px; color: var(--muted); background: transparent; border: none; padding: 4px; }
        .ob-title { font-size: 14px; font-weight: 600; }

        .ob-chat { flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 2px; }
        .ob-msg { display: flex; gap: 10px; align-items: flex-start; }
        .ob-msg.user { flex-direction: row-reverse; }
        .ob-av { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
        .ob-bubble { max-width: 82%; padding: 11px 15px; border-radius: 14px; font-size: 14.5px; line-height: 1.6; }
        .ob-bubble.assistant { background: var(--surface); border: 1px solid var(--border); border-top-left-radius: 4px; }
        .ob-bubble.user { color: #fff; border-top-right-radius: 4px; }

        .ob-quicks { display: flex; flex-wrap: wrap; gap: 7px; margin: 14px 0 4px; }
        .ob-quick { font-size: 12.5px; padding: 7px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; color: var(--text); }
        .ob-quick:hover { border-color: #cfcfc8; }

        .ob-inrow { display: flex; gap: 8px; margin-top: 12px; align-items: flex-end; }
        .ob-send { width: 42px; height: 42px; border-radius: 999px; border: none; color: #fff; font-size: 17px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .ob-typing span { display: inline-block; width: 6px; height: 6px; margin: 0 1.5px; border-radius: 50%; background: var(--muted); animation: obb 1.2s infinite ease-in-out; }
        .ob-typing span:nth-child(2){ animation-delay: .15s; } .ob-typing span:nth-child(3){ animation-delay: .3s; }
        @keyframes obb { 0%,60%,100%{ opacity:.25; transform: translateY(0);} 30%{ opacity:1; transform: translateY(-3px);} }

        .ob-scanbtn { margin-top: 10px; width: 100%; padding: 11px; background: transparent; border: 1px dashed var(--border); border-radius: 10px; font-size: 13px; color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 7px; }
        .ob-scanbtn:hover { border-color: #cfcfc8; color: var(--text); }

        .ob-scan { flex: 1; display: flex; flex-direction: column; }
        .ob-scan-h { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
        .ob-scan-b { font-size: 14px; color: var(--muted); margin-top: 6px; line-height: 1.55; }
        .ob-run { margin-top: 16px; width: 100%; padding: 13px; border-radius: 12px; border: none; color: #fff; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .ob-scanning { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; }
        .ob-ringspin { width: 92px; height: 92px; border-radius: 50%; border: 6px solid var(--border); border-top-color: var(--text); animation: spin 0.9s linear infinite; margin-bottom: 18px; }
        .ob-step { font-size: 14px; color: var(--muted); min-height: 20px; }
        .ob-prog { width: 180px; height: 4px; border-radius: 4px; background: var(--border); overflow: hidden; margin-top: 14px; }
        .ob-prog > div { height: 100%; border-radius: 4px; transition: width .9s ease; }

        .ob-result-head { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 8px; }
        .ob-band { font-size: 13px; font-weight: 600; margin-top: 6px; }
        .ob-verdict { font-size: 14px; color: var(--muted); margin-top: 8px; line-height: 1.55; max-width: 340px; }
        .ob-dim { margin-top: 14px; }
        .ob-dim-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13.5px; }
        .ob-dim-name { font-weight: 500; }
        .ob-dim-score { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .ob-dim-bar { height: 6px; border-radius: 4px; background: var(--border); margin-top: 5px; overflow: hidden; }
        .ob-dim-bar > div { height: 100%; border-radius: 4px; transition: width 1s ease; }
        .ob-dim-note { font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.5; }
        .ob-steps-sec { margin-top: 22px; border-top: 1px solid var(--border-soft); padding-top: 18px; }
        .ob-steps-h { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 10px; }
        .ob-nextstep { display: flex; gap: 10px; font-size: 14px; margin: 8px 0; line-height: 1.5; }
        .ob-nextstep .ob-ns-dot { color: var(--text); }
        .ob-scan-actions { display: flex; gap: 8px; margin-top: 22px; }
        .ob-btn-ghost { flex: 1; padding: 11px; border-radius: 10px; border: 1px solid var(--border); background: transparent; font-size: 14px; color: var(--text); }
        .ob-err { font-size: 13px; color: var(--danger); margin-top: 12px; text-align: center; }

        .ob-actions { display: flex; gap: 8px; margin-top: 12px; }
        .ob-act { flex: 1; padding: 10px; background: transparent; border: 1px dashed var(--border); border-radius: 10px; font-size: 12.5px; color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 6px; }
        .ob-act:hover { border-color: #cfcfc8; color: var(--text); }
        .ob-act.primary { border-style: solid; color: #fff; }

        .ob-field { margin-top: 14px; }
        .ob-label { font-size: 12px; color: var(--muted); font-weight: 500; margin-bottom: 5px; display: block; }
        .ob-note-p { font-size: 14px; color: var(--muted); margin-top: 6px; line-height: 1.55; }
        .ob-done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
        .ob-check { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; color: #fff; margin-bottom: 8px; }
      `}</style>

      <div className="ob-wrap">
        {!path ? (
          /* ---------- LANDING ---------- */
          <>
            <div className="ob-mark"><Spark size={44} /></div>
            <h1 className="ob-hero-h">Welcome to Candidate Collective.</h1>
            <p className="ob-hero-p">
              We help the people who build hospitality find each other — with trust as the only
              currency. Tell me why you're here and I'll walk you through it.
            </p>

            <div className="ob-paths">
              {Object.values(PATHS).map((p) => (
                <button key={p.key} className="ob-path" onClick={() => choosePath(p.key)}>
                  <div className="ob-path-ic" style={{ background: p.accentBg, color: p.accent }}>
                    {p.key === "employer" ? "🏛" : "🤝"}
                  </div>
                  <div>
                    <div className="ob-path-t">{p.label}</div>
                    <div className="ob-path-s">{p.tagline}</div>
                  </div>
                  <span className="ob-path-arrow">→</span>
                </button>
              ))}
            </div>

            <div className="ob-foot">
              Not sure yet? Pick either — you can switch anytime.
              <br />
              <br />
              <a href="/">Candidate Collective team? Open your Chief of Staff →</a>
            </div>
          </>
        ) : view === "scan" ? (
          /* ---------- READINESS SCAN ---------- */
          <>
            <div className="ob-top">
              <Spark size={22} color={accent} />
              <div className="ob-title">Candidate Collective</div>
              <span className="ob-chip" style={{ background: active.accentBg, color: accent, marginLeft: 8 }}>
                {active.label}
              </span>
              <button className="ob-back" onClick={() => setView("chat")}>← Back</button>
            </div>

            <div className="ob-scan">
              {scanning ? (
                <div className="ob-scanning">
                  <div className="ob-ringspin" style={{ borderTopColor: accent }} />
                  <div style={{ fontSize: 17, fontWeight: 600 }}>Checking your trust readiness…</div>
                  <div className="ob-step">{cfg.steps[scanStep]}</div>
                  <div className="ob-prog">
                    <div style={{ width: `${((scanStep + 1) / cfg.steps.length) * 100}%`, background: accent }} />
                  </div>
                </div>
              ) : result ? (
                (() => {
                  const b = readinessBand(result.overall);
                  return (
                    <div>
                      <div className="ob-result-head">
                        <ScoreRing score={result.overall} color={b.color} />
                        <div className="ob-band" style={{ color: b.color }}>{b.label}</div>
                        {result.verdict && <div className="ob-verdict">{result.verdict}</div>}
                      </div>

                      {result.dimensions.map((d) => {
                        const db = readinessBand(d.score);
                        return (
                          <div key={d.name} className="ob-dim">
                            <div className="ob-dim-row">
                              <span className="ob-dim-name">{d.name}</span>
                              <span className="ob-dim-score">{d.score}</span>
                            </div>
                            <div className="ob-dim-bar">
                              <div style={{ width: `${d.score}%`, background: db.color }} />
                            </div>
                            {d.note && <div className="ob-dim-note">{d.note}</div>}
                          </div>
                        );
                      })}

                      {result.nextSteps.length > 0 && (
                        <div className="ob-steps-sec">
                          <div className="ob-steps-h">Build trust — do these next</div>
                          {result.nextSteps.map((s, i) => (
                            <div key={i} className="ob-nextstep">
                              <span className="ob-ns-dot" style={{ color: accent }}>→</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        className="ob-run"
                        style={{ background: accent, marginTop: 22 }}
                        onClick={openSubmit}
                      >
                        ✦ Send this to the CC team →
                      </button>
                      <div className="ob-scan-actions">
                        <button className="ob-btn-ghost" onClick={runScan}>↻ Run again</button>
                        <button className="ob-btn-ghost" onClick={() => setView("chat")}>
                          Back to guide
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div>
                  <div className="ob-scan-h">{cfg.title}</div>
                  <div className="ob-scan-b">{cfg.blurb}</div>
                  <textarea
                    rows={6}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder={cfg.placeholder}
                    style={{ marginTop: 16, resize: "vertical" }}
                  />
                  {scanError && <div className="ob-err">{scanError}</div>}
                  <button
                    className="ob-run"
                    style={{ background: accent, opacity: scanInput.trim() ? 1 : 0.45 }}
                    onClick={runScan}
                    disabled={!scanInput.trim()}
                  >
                    ◎ Run readiness check
                  </button>
                </div>
              )}
            </div>
          </>
        ) : view === "submit" ? (
          /* ---------- SUBMIT TO CC TEAM ---------- */
          <>
            <div className="ob-top">
              <Spark size={22} color={accent} />
              <div className="ob-title">Candidate Collective</div>
              <span className="ob-chip" style={{ background: active.accentBg, color: accent, marginLeft: 8 }}>
                {active.label}
              </span>
              {!submitted && (
                <button className="ob-back" onClick={() => setView("chat")}>← Back</button>
              )}
            </div>

            {submitted ? (
              <div className="ob-done">
                <div className="ob-check" style={{ background: accent }}>✓</div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>We've got it.</div>
                <div className="ob-note-p" style={{ maxWidth: 320 }}>
                  {path === "employer"
                    ? "Your role is with the Candidate Collective team. They'll reach out to line up matches worth standing behind."
                    : "Your vouch is with the Candidate Collective team. They'll take it from here and follow up with you."}
                </div>
                <button
                  className="ob-btn-ghost"
                  style={{ marginTop: 18, maxWidth: 200, borderColor: accent, color: accent }}
                  onClick={() => setView("chat")}
                >
                  Back to guide
                </button>
              </div>
            ) : (
              <div className="ob-scan">
                <div className="ob-scan-h">
                  {path === "employer" ? "Send your role to the CC team" : "Send your vouch to the CC team"}
                </div>
                <div className="ob-note-p">
                  We'll pass along what you've shared so far. Add anything else that matters, and where
                  to reach you.
                </div>

                <div className="ob-field">
                  <label className="ob-label">Anything to add? (optional)</label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      path === "employer"
                        ? "Timeline, comp range, must-haves…"
                        : "Anything else about who you're vouching for…"
                    }
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div className="ob-field">
                  <label className="ob-label">Your name</label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="ob-field">
                  <label className="ob-label">Email</label>
                  <input
                    type="text"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    placeholder="you@restaurant.com"
                  />
                </div>
                <div className="ob-field">
                  <label className="ob-label">Phone (optional)</label>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    placeholder="(555) 555-5555"
                  />
                </div>

                {submitError && <div className="ob-err">{submitError}</div>}

                <button
                  className="ob-run"
                  style={{ background: accent, opacity: submitting ? 0.6 : 1 }}
                  onClick={doSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Send to the CC team →"}
                </button>
              </div>
            )}
          </>
        ) : (
          /* ---------- CHAT ---------- */
          <>
            <div className="ob-top">
              <Spark size={22} color={accent} />
              <div className="ob-title">Candidate Collective</div>
              <span
                className="ob-chip"
                style={{ background: active.accentBg, color: accent, marginLeft: 8 }}
              >
                {active.label}
              </span>
              <button className="ob-back" onClick={startOver} title="Start over">
                ↺ Restart
              </button>
            </div>

            <div className="ob-chat">
              {messages.map((m, i) => (
                <div key={i} className={`ob-msg ${m.role}`}>
                  {m.role === "assistant" && (
                    <div className="ob-av" style={{ background: active.accentBg }}>
                      <Spark size={15} color={accent} />
                    </div>
                  )}
                  <div
                    className={`ob-bubble ${m.role}`}
                    style={m.role === "user" ? { background: accent } : undefined}
                    dangerouslySetInnerHTML={{ __html: md(m.content) }}
                  />
                </div>
              ))}
              {loading && (
                <div className="ob-msg">
                  <div className="ob-av" style={{ background: active.accentBg }}>
                    <Spark size={15} color={accent} />
                  </div>
                  <div className="ob-bubble assistant ob-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {messages.length <= 1 && (
              <div className="ob-quicks">
                {active.quicks.map((q) => (
                  <button key={q} className="ob-quick" onClick={() => send(q)} disabled={loading}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="ob-actions">
              <button className="ob-act" onClick={openScan}>◎ Trust readiness</button>
              <button className="ob-act primary" style={{ background: accent }} onClick={openSubmit}>
                ✦ Send to CC team
              </button>
            </div>

            <div className="ob-inrow">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type your answer…"
                style={{ resize: "none", maxHeight: 120 }}
                disabled={loading}
              />
              <button
                className="ob-send"
                style={{ background: accent }}
                onClick={() => send()}
                disabled={loading || !input.trim()}
              >
                →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
