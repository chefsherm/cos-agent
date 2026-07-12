"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "../components/Nav";

export default function PostRolePage() {
  const router = useRouter();
  const [lineages, setLineages] = useState([]);
  const [form, setForm] = useState({
    title: "",
    side: "boh",
    venue: "",
    lineageId: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/lineages")
      .then((r) => r.json())
      .then((d) => setLineages(d.lineages || []))
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          lineageId: form.lineageId ? Number(form.lineageId) : null,
        }),
      });
      const data = await r.json();
      if (r.status === 401) {
        router.push("/login");
        return;
      }
      if (!r.ok) throw new Error(data.error || "Could not post role.");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const referrerSide = form.side === "boh" ? "front-of-house" : "back-of-house";

  return (
    <div className="cc-root">
      <Nav />
      <div className="cc-wrap cc-app">
        <div className="cc-panel cc-panel-narrow">
          <div className="cc-section-eyebrow">Post a role</div>
          <h1 style={{ fontSize: 30, marginBottom: 6 }}>Make the introduction through CC</h1>
          <p className="cc-note" style={{ marginBottom: 22 }}>
            No applications, no résumés. CC surfaces {referrerSide} Referrers who
            already know the right person for this seat.
          </p>
          <form onSubmit={submit}>
            <div className="cc-field">
              <label>Role title</label>
              <input className="cc-input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Chef de Cuisine" required />
            </div>
            <div className="cc-field">
              <label>Venue / house</label>
              <input className="cc-input" value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. Jean-Georges 425 Park" required />
            </div>
            <div className="cc-field">
              <label>Which side of the house is this role?</label>
              <div className="cc-seg">
                <button type="button" className={`cc-seg-btn${form.side === "boh" ? " active" : ""}`} onClick={() => set("side", "boh")}>
                  Back-of-house
                </button>
                <button type="button" className={`cc-seg-btn${form.side === "foh" ? " active" : ""}`} onClick={() => set("side", "foh")}>
                  Front-of-house
                </button>
              </div>
              <p className="cc-note">
                CC will surface <strong>{referrerSide}</strong> Referrers — the
                cross-functional sourcing rule.
              </p>
            </div>
            <div className="cc-field">
              <label>Lineage focus (optional)</label>
              <select className="cc-select" value={form.lineageId} onChange={(e) => set("lineageId", e.target.value)}>
                <option value="">Any lineage</option>
                {lineages.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="cc-field">
              <label>Notes (optional)</label>
              <textarea className="cc-textarea" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What matters for this seat." />
            </div>
            {error && <div className="cc-error">{error}</div>}
            <button className="cc-btn cc-btn-primary cc-btn-lg" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
              {loading ? "Posting…" : "Post role"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
