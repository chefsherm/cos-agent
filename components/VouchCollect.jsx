"use client";

import { useState, useEffect, useRef } from "react";

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

const ACCENT = "#2d7a4f"; // Referrer green

export default function VouchCollect({ token }) {
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | done
  const [ctx, setCtx] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/vouch/${token}`);
        if (!r.ok) return setStatus("notfound");
        const data = await r.json();
        if (!data.request) return setStatus("notfound");
        setCtx(data.request);
        if (data.request.status === "collected") {
          setStatus("done");
        } else {
          setMessages([
            {
              role: "assistant",
              content: `Hi — **${data.request.requester}** asked me to collect a quick vouch from you for Candidate Collective, where trust is the only currency. No forms, just a couple of questions. To start: how do you know ${data.request.requester}'s work?`,
            },
          ]);
          setStatus("ready");
        }
      } catch {
        setStatus("notfound");
      }
    })();
  }, [token]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch(`/api/vouch/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: next }),
      });
      const data = await r.json();
      setMessages([...next, { role: "assistant", content: data.reply || "Thanks — tap finish whenever you're ready." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection error. Try again." }]);
    }
    setLoading(false);
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/vouch/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "submit", messages }),
      });
      const data = await r.json();
      if (data.ok) setStatus("done");
    } catch {}
    setSubmitting(false);
  };

  const hasReplied = messages.some((m) => m.role === "user");

  return (
    <>
      <style>{`
        .vc-wrap { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; padding: 28px 22px 20px; }
        .vc-top { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--border-soft); }
        .vc-title { font-size: 14px; font-weight: 600; }
        .vc-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
        .vc-check { width: 64px; height: 64px; border-radius: 50%; background: ${ACCENT}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 30px; margin-bottom: 8px; }
        .vc-chat { flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 2px; }
        .vc-msg { display: flex; gap: 10px; align-items: flex-start; }
        .vc-msg.user { flex-direction: row-reverse; }
        .vc-av { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-top: 2px; background: #eef7f2; }
        .vc-bubble { max-width: 82%; padding: 11px 15px; border-radius: 14px; font-size: 14.5px; line-height: 1.6; }
        .vc-bubble.assistant { background: var(--surface); border: 1px solid var(--border); border-top-left-radius: 4px; }
        .vc-bubble.user { color: #fff; border-top-right-radius: 4px; background: ${ACCENT}; }
        .vc-typing span { display: inline-block; width: 6px; height: 6px; margin: 0 1.5px; border-radius: 50%; background: var(--muted); animation: obb 1.2s infinite ease-in-out; }
        .vc-typing span:nth-child(2){ animation-delay:.15s;} .vc-typing span:nth-child(3){ animation-delay:.3s;}
        @keyframes obb { 0%,60%,100%{ opacity:.25; transform: translateY(0);} 30%{ opacity:1; transform: translateY(-3px);} }
        .vc-finish { width: 100%; margin-top: 12px; padding: 12px; border: none; border-radius: 12px; background: ${ACCENT}; color: #fff; font-size: 14.5px; font-weight: 600; }
        .vc-inrow { display: flex; gap: 8px; margin-top: 10px; align-items: flex-end; }
        .vc-send { width: 42px; height: 42px; border-radius: 999px; border: none; background: ${ACCENT}; color: #fff; font-size: 17px; flex-shrink: 0; }
        .vc-hint { font-size: 12px; color: var(--muted); text-align: center; margin-top: 8px; }
      `}</style>

      <div className="vc-wrap">
        {status === "loading" && (
          <div className="vc-center"><span className="spin" style={{ fontSize: 22 }}>↻</span></div>
        )}

        {status === "notfound" && (
          <div className="vc-center">
            <Spark size={40} color="var(--muted)" />
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 10 }}>This link isn't valid.</div>
            <div style={{ fontSize: 14, color: "var(--muted)", maxWidth: 300 }}>
              It may have expired or already been used. Ask for a fresh link.
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="vc-center">
            <div className="vc-check">✓</div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Thank you.</div>
            <div style={{ fontSize: 14, color: "var(--muted)", maxWidth: 320 }}>
              Your vouch{ctx?.requester ? ` for ${ctx.requester}` : ""} is in. On Candidate Collective,
              standing behind someone is the whole point — thanks for building the trust this runs on.
            </div>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="vc-top">
              <Spark size={22} color={ACCENT} />
              <div className="vc-title">Candidate Collective</div>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>Vouch</span>
            </div>

            <div className="vc-chat">
              {messages.map((m, i) => (
                <div key={i} className={`vc-msg ${m.role}`}>
                  {m.role === "assistant" && (
                    <div className="vc-av"><Spark size={15} color={ACCENT} /></div>
                  )}
                  <div className={`vc-bubble ${m.role}`} dangerouslySetInnerHTML={{ __html: md(m.content) }} />
                </div>
              ))}
              {loading && (
                <div className="vc-msg">
                  <div className="vc-av"><Spark size={15} color={ACCENT} /></div>
                  <div className="vc-bubble assistant vc-typing"><span></span><span></span><span></span></div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {hasReplied && (
              <button className="vc-finish" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Finish & submit vouch"}
              </button>
            )}

            <div className="vc-inrow">
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
              <button className="vc-send" onClick={() => send()} disabled={loading || !input.trim()}>→</button>
            </div>
            {!hasReplied && <div className="vc-hint">Takes about two minutes.</div>}
          </>
        )}
      </div>
    </>
  );
}
