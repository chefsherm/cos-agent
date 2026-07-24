"use client";

import { useState, useEffect, useRef } from "react";
import { PATHS, WELCOME } from "@/lib/onboarding";

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

export default function Onboard() {
  const [path, setPath] = useState(null); // null | "employer" | "referrer"
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const choosePath = (key) => {
    setPath(key);
    setMessages([{ role: "assistant", content: PATHS[key].intro }]);
  };

  const startOver = () => {
    setPath(null);
    setMessages([]);
    setInput("");
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

  const active = path ? PATHS[path] : null;
  const accent = active?.accent || "var(--text)";

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

            <div className="ob-foot">Not sure yet? Pick either — you can switch anytime.</div>
          </>
        ) : (
          /* ---------- CHAT ---------- */
          <>
            <div className="ob-top">
              <Spark size={22} color={accent} />
              <div>
                <div className="ob-title">Candidate Collective</div>
              </div>
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
