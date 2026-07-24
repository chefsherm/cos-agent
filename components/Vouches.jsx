"use client";

import { useState, useEffect } from "react";

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

const ACCENT = "#2d7a4f";
const LS_NAME = "cc-vouch-requester";

export default function Vouches() {
  const [name, setName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [rows, setRows] = useState([]);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const saved = localStorage.getItem(LS_NAME);
    if (saved) {
      setName(saved);
      setNameSet(true);
    }
  }, []);

  useEffect(() => {
    if (nameSet && name) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSet, name]);

  const load = async () => {
    try {
      const r = await fetch(`/api/vouch-requests?requester=${encodeURIComponent(name)}`);
      const data = await r.json();
      setRows(data.requests || []);
      setSmsEnabled(!!data.smsEnabled);
    } catch {}
  };

  const saveName = () => {
    const n = nameDraft.trim();
    if (!n) return;
    localStorage.setItem(LS_NAME, n);
    setName(n);
    setNameSet(true);
  };

  const add = async () => {
    if (!cName.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/vouch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester: name, contactName: cName, contactPhone: cPhone, origin }),
      });
      const data = await r.json();
      if (data.request) {
        setCName("");
        setCPhone("");
        await load();
        if (data.sms?.sent) setCopied("sent:" + data.request.token);
      } else {
        setErr(data.error || "Couldn't add that.");
      }
    } catch {
      setErr("Connection error.");
    }
    setBusy(false);
  };

  const copyLink = async (token) => {
    const link = `${origin}/vouch/${token}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {}
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? "" : c)), 1800);
  };

  const collected = rows.filter((r) => r.status === "collected").length;
  const goal = Math.max(5, rows.length);
  const pct = goal ? (collected / goal) * 100 : 0;

  return (
    <>
      <style>{`
        .vs-wrap { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; padding: 28px 22px 24px; }
        .vs-mark { display: flex; justify-content: center; margin: 6px 0 20px; }
        .vs-h { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
        .vs-p { font-size: 14.5px; color: var(--muted); margin-top: 10px; line-height: 1.55; }
        .vs-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; margin-top: 16px; }
        .vs-label { font-size: 12px; color: var(--muted); font-weight: 500; margin-bottom: 5px; display: block; }
        .vs-row2 { display: flex; gap: 8px; }
        .vs-btn { border: none; border-radius: 10px; background: ${ACCENT}; color: #fff; font-size: 14px; font-weight: 600; padding: 11px 16px; }
        .vs-btn.full { width: 100%; margin-top: 10px; padding: 12px; }
        .vs-prog-h { display: flex; justify-content: space-between; align-items: baseline; margin: 24px 0 8px; }
        .vs-prog-t { font-size: 14px; font-weight: 600; }
        .vs-prog-c { font-size: 13px; color: var(--muted); }
        .vs-bar { height: 6px; border-radius: 4px; background: var(--border); overflow: hidden; }
        .vs-bar > div { height: 100%; background: ${ACCENT}; border-radius: 4px; transition: width .5s ease; }
        .vs-item { display: flex; align-items: center; gap: 12px; padding: 14px 4px; border-bottom: 1px solid var(--border-soft); }
        .vs-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .vs-iname { font-size: 15px; font-weight: 500; }
        .vs-isub { font-size: 12px; color: var(--muted); margin-top: 1px; }
        .vs-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 6px; }
        .vs-copy { font-size: 12px; color: ${ACCENT}; background: transparent; border: 1px solid var(--border); border-radius: 7px; padding: 6px 10px; }
        .vs-empty { font-size: 13.5px; color: var(--muted); padding: 18px 4px; text-align: center; }
        .vs-foot { margin-top: auto; padding-top: 22px; text-align: center; font-size: 12px; color: var(--muted); }
        .vs-foot a { color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--border); }
        .vs-err { font-size: 13px; color: var(--danger); margin-top: 8px; }
      `}</style>

      <div className="vs-wrap">
        <div className="vs-mark"><Spark size={40} color={ACCENT} /></div>
        <h1 className="vs-h">Build trust.</h1>
        <p className="vs-p">
          Vouches from people who know your work are the currency on Candidate Collective. Ask a few
          people to vouch for you — each gets a private link and a two-minute chat.
        </p>

        {!nameSet ? (
          <div className="vs-card">
            <label className="vs-label">First, what's your name?</label>
            <div className="vs-row2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                placeholder="Your full name"
              />
              <button className="vs-btn" onClick={saveName}>Start</button>
            </div>
            <div className="vs-isub" style={{ marginTop: 8 }}>
              We'll tell each person that <strong>you</strong> asked them to vouch.
            </div>
          </div>
        ) : (
          <>
            <div className="vs-card">
              <label className="vs-label">Ask someone to vouch for you</label>
              <input
                type="text"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Their name (e.g. a former chef or manager)"
              />
              <div style={{ height: 8 }} />
              <input
                type="text"
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value)}
                placeholder={smsEnabled ? "Their phone (we'll text the link)" : "Their phone (optional)"}
              />
              {err && <div className="vs-err">{err}</div>}
              <button className="vs-btn full" onClick={add} disabled={busy || !cName.trim()}>
                {busy ? "Adding…" : smsEnabled && cPhone.trim() ? "Add & text the link" : "Add & get a private link"}
              </button>
              {!smsEnabled && (
                <div className="vs-isub" style={{ marginTop: 8 }}>
                  Texting isn't switched on yet — you'll get a private link to share yourself.
                </div>
              )}
            </div>

            <div className="vs-prog-h">
              <span className="vs-prog-t">Your vouches</span>
              <span className="vs-prog-c">{collected} collected · {rows.length} requested</span>
            </div>
            <div className="vs-bar"><div style={{ width: `${pct}%` }} /></div>

            <div style={{ marginTop: 6 }}>
              {rows.length === 0 ? (
                <div className="vs-empty">No requests yet. Add someone above to get your first link.</div>
              ) : (
                rows.map((r) => {
                  const done = r.status === "collected";
                  return (
                    <div key={r.token} className="vs-item">
                      <span className="vs-dot" style={{ background: done ? ACCENT : "#e0a800" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="vs-iname">{r.contactName}</div>
                        <div className="vs-isub">
                          {done ? "Vouch received" : copied === "sent:" + r.token ? "Texted just now" : "Awaiting response"}
                        </div>
                      </div>
                      {done ? (
                        <span className="vs-badge" style={{ background: "#eef7f2", color: ACCENT }}>Collected</span>
                      ) : (
                        <button className="vs-copy" onClick={() => copyLink(r.token)}>
                          {copied === r.token ? "Copied ✓" : "Copy link"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <button className="vs-copy" onClick={load} style={{ color: "var(--muted)" }}>↻ Refresh</button>
            </div>
          </>
        )}

        <div className="vs-foot">
          <a href="/onboard">← Back to the Candidate Collective guide</a>
        </div>
      </div>
    </>
  );
}
