"use client";

import { useState, useEffect, useRef } from "react";
import { DEFAULT_VENTURES, DEFAULT_DECISIONS } from "@/lib/data";

const STATUS = {
  green: { label: "On track", color: "#2d7a4f", bg: "#eef7f2" },
  yellow: { label: "Needs attention", color: "#9a6b00", bg: "#fef9ec" },
  red: { label: "Blocked", color: "#c0392b", bg: "#fdf1f0" },
};

function md(t) {
  if (!t) return "";
  return t
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^TODAY — (.*)$/gm, "<div class='brief-date'>TODAY — $1</div>")
    .replace(/^PRIORITY (\d): (.*)$/gm, "<div class='brief-priority'><span class='brief-num'>$1</span><span>$2</span></div>")
    .replace(/^STALLED: (.*)$/gm, "<div class='brief-section stalled'><span class='brief-label'>Stalled</span><div>$1</div></div>")
    .replace(/^LET GO TODAY: (.*)$/gm, "<div class='brief-section'><span class='brief-label'>Let go today</span><div>$1</div></div>")
    .replace(/^- (.*)$/gm, "<div class='brief-bullet'><span>—</span><span>$1</span></div>")
    .replace(/\n\n/g, "<br>")
    .replace(/\n/g, "<br>");
}

const LS_VENTURES = "cos-ventures";
const LS_DECISIONS = "cos-decisions";
const LS_BRIEF = "cos-brief";
const LS_BRIEF_DATE = "cos-brief-date";

export default function Dashboard() {
  const [tab, setTab] = useState("brief");
  const [ventures, setVentures] = useState(DEFAULT_VENTURES);
  const [decisions, setDecisions] = useState(DEFAULT_DECISIONS);
  const [brief, setBrief] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Morning. Board reviewed. Two items blocked, four decisions sitting on your plate. Ask me anything — or say **morning brief** to get your daily triage." },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => {
    try {
      const sv = localStorage.getItem(LS_VENTURES);
      if (sv) setVentures(JSON.parse(sv));
      const sd = localStorage.getItem(LS_DECISIONS);
      if (sd) setDecisions(JSON.parse(sd));
      const sb = localStorage.getItem(LS_BRIEF);
      const sbd = localStorage.getItem(LS_BRIEF_DATE);
      if (sb && sbd === new Date().toDateString()) setBrief(sb);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !brief && tab === "brief") genBrief();
  }, [ready]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const genBrief = async () => {
    setBriefLoading(true);
    try {
      const r = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventures, decisions }),
      });
      const data = await r.json();
      const text = data.brief || "Unable to generate brief.";
      setBrief(text);
      try {
        localStorage.setItem(LS_BRIEF, text);
        localStorage.setItem(LS_BRIEF_DATE, new Date().toDateString());
      } catch {}
    } catch {
      setBrief("Connection error. Check your API key in Vercel and retry.");
    }
    setBriefLoading(false);
  };

  const sendChat = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setChatLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, ventures, decisions }),
      });
      const data = await r.json();
      setMessages([...next, { role: "assistant", content: data.reply || "Error. Try again." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection error." }]);
    }
    setChatLoading(false);
  };

  const setStatus = (id, status) => {
    const u = ventures.map((v) => (v.id === id ? { ...v, status } : v));
    setVentures(u);
    try { localStorage.setItem(LS_VENTURES, JSON.stringify(u)); } catch {}
  };

  const resolveDecision = (id) => {
    const u = decisions.map((d) => (d.id === id ? { ...d, status: "resolved" } : d));
    setDecisions(u);
    try { localStorage.setItem(LS_DECISIONS, JSON.stringify(u)); } catch {}
  };

  const pending = decisions.filter((d) => d.status === "pending");
  const redCount = ventures.filter((v) => v.status === "red").length;
  const yellowCount = ventures.filter((v) => v.status === "yellow").length;

  return (
    <>
      <style>{`
        .wrap { max-width: 640px; margin: 0 auto; padding: 40px 24px; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; }
        .title { font-size: 15px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 8px; }
        .subtitle { font-size: 12px; color: var(--muted); margin-top: 3px; }
        .badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .badge { font-size: 11px; padding: 3px 9px; border-radius: 6px; font-weight: 500; }
        .tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 24px; gap: 2px; }
        .tab { padding: 8px 14px; background: transparent; border: none; border-bottom: 2px solid transparent; font-size: 13px; color: var(--muted); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
        .tab.active { border-bottom-color: var(--text); color: var(--text); font-weight: 500; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; }
        .card + .card { margin-top: 8px; }
        .venture-name { font-size: 14px; font-weight: 500; }
        .venture-sub { font-size: 11px; color: var(--muted); margin-left: 6px; }
        .venture-next { font-size: 13px; color: var(--muted); margin-top: 4px; }
        .venture-blocker { font-size: 12px; color: var(--danger); margin-top: 4px; }
        .status-dots { display: flex; gap: 5px; flex-shrink: 0; }
        .dot { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--border); cursor: pointer; background: transparent; transition: all 0.15s; }
        .loading { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 14px; padding: 24px 0; }
        .brief-date { font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 14px; }
        .brief-priority { display: flex; gap: 14px; align-items: baseline; margin: 8px 0; font-size: 14px; }
        .brief-num { font-size: 11px; font-weight: 600; color: var(--muted); min-width: 14px; }
        .brief-section { margin: 10px 0; font-size: 14px; }
        .brief-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 600; display: block; margin-bottom: 4px; }
        .brief-section.stalled .brief-label { color: var(--danger); }
        .brief-bullet { display: flex; gap: 8px; margin: 4px 0; font-size: 14px; color: var(--muted); }
        .chat-wrap { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; max-height: 380px; overflow-y: auto; padding-right: 4px; }
        .msg { display: flex; gap: 10px; align-items: flex-start; }
        .msg.user { flex-direction: row-reverse; }
        .avatar { width: 28px; height: 28px; border-radius: 50%; background: #f0f0ec; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: var(--muted); margin-top: 2px; }
        .bubble { max-width: 78%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.65; }
        .bubble.assistant { background: var(--surface); border: 1px solid var(--border); }
        .bubble.user { background: #f0f0ec; }
        .input-row { display: flex; gap: 8px; }
        .send-btn { padding: 0 16px; background: var(--text); color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; flex-shrink: 0; }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .quick-btns { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
        .quick-btn { font-size: 12px; padding: 4px 10px; color: var(--muted); background: transparent; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
        .regen-btn { margin-top: 16px; padding: 5px 12px; font-size: 12px; color: var(--muted); background: transparent; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
        .decision-card { background: var(--surface); border-radius: 12px; padding: 14px 18px; margin-bottom: 8px; }
        .resolve-btn { border: 1px solid var(--border); background: transparent; border-radius: 6px; padding: 5px 8px; cursor: pointer; color: var(--muted); flex-shrink: 0; font-size: 13px; }
      `}</style>

      <div className="wrap">
        {/* Header */}
        <div className="header">
          <div>
            <div className="title">⬛ Chief of Staff</div>
            <div className="subtitle">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
          <div className="badges">
            {redCount > 0 && <span className="badge" style={{ background: STATUS.red.bg, color: STATUS.red.color }}>{redCount} blocked</span>}
            {yellowCount > 0 && <span className="badge" style={{ background: STATUS.yellow.bg, color: STATUS.yellow.color }}>{yellowCount} in progress</span>}
            {pending.length > 0 && <span className="badge" style={{ background: "#eef4fc", color: "#1a5fa8" }}>{pending.length} decisions pending</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { k: "brief", label: "Today's Brief" },
            { k: "ventures", label: "Ventures" },
            { k: "decisions", label: `Decisions${pending.length ? ` (${pending.length})` : ""}` },
            { k: "chat", label: "Ask CoS" },
          ].map((t) => (
            <button key={t.k} className={`tab${tab === t.k ? " active" : ""}`} onClick={() => setTab(t.k)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* BRIEF */}
        {tab === "brief" && (
          <div>
            {briefLoading ? (
              <div className="loading">
                <span className="spin">↻</span> Pulling your brief...
              </div>
            ) : brief ? (
              <div>
                <div style={{ fontSize: 14, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: md(brief) }} />
                <button className="regen-btn" onClick={genBrief}>↻ Regenerate</button>
              </div>
            ) : (
              <div className="loading">Initializing...</div>
            )}
          </div>
        )}

        {/* VENTURES */}
        {tab === "ventures" && (
          <div>
            {ventures.map((v) => (
              <div key={v.id} className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <span className="venture-name">{v.name}</span>
                    <span className="venture-sub">{v.sub}</span>
                  </div>
                  <div className="venture-next">→ {v.next}</div>
                  {v.blocker && <div className="venture-blocker">⚠ {v.blocker}</div>}
                </div>
                <div className="status-dots" style={{ marginTop: 2 }}>
                  {["green", "yellow", "red"].map((s) => (
                    <button
                      key={s}
                      title={STATUS[s].label}
                      onClick={() => setStatus(v.id, s)}
                      className="dot"
                      style={{
                        background: v.status === s ? STATUS[s].color : "transparent",
                        borderColor: v.status === s ? STATUS[s].color : "#ddd",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, paddingLeft: 2 }}>
              Click dots to update status. Saved to this browser.
            </div>
          </div>
        )}

        {/* DECISIONS */}
        {tab === "decisions" && (
          <div>
            {pending.length === 0 ? (
              <div style={{ color: STATUS.green.color, fontSize: 14, padding: "16px 0" }}>✓ Clear board. No pending decisions.</div>
            ) : (
              pending.map((d) => {
                const days = Math.floor((Date.now() - new Date(d.created)) / 86400000);
                const isHigh = d.urgency === "high";
                return (
                  <div key={d.id} className="decision-card" style={{ border: `1px solid ${isHigh ? "#f5c5c2" : "var(--border)"}` }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 500, background: isHigh ? STATUS.red.bg : STATUS.yellow.bg, color: isHigh ? STATUS.red.color : STATUS.yellow.color }}>{d.urgency}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>{d.venture}</span>
                          <span style={{ fontSize: 11, color: isHigh ? STATUS.red.color : "var(--muted)" }}>{days} days pending</span>
                        </div>
                        <div style={{ fontSize: 14 }}>{d.text}</div>
                      </div>
                      <button className="resolve-btn" onClick={() => resolveDecision(d.id)} title="Mark resolved">✓</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div>
            <div className="chat-wrap">
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>
                  {m.role === "assistant" && <div className="avatar">CoS</div>}
                  <div className={`bubble ${m.role}`} dangerouslySetInnerHTML={{ __html: md(m.content) }} />
                </div>
              ))}
              {chatLoading && (
                <div className="msg">
                  <div className="avatar">CoS</div>
                  <div className="bubble assistant" style={{ color: "var(--muted)", fontSize: 13 }}>
                    <span className="spin">↻</span> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            <div className="input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask your CoS anything..."
                disabled={chatLoading}
              />
              <button className="send-btn" onClick={sendChat} disabled={chatLoading || !input.trim()}>→</button>
            </div>
            <div className="quick-btns">
              {["What needs my attention today?", "Status on VERITAS", "What can wait?", "Stalled list"].map((q) => (
                <button key={q} className="quick-btn" onClick={() => setInput(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
