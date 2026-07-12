"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../components/Nav";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    side: "boh",
    roleTitle: "",
    employer: "",
    isOperator: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Signup failed.");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="cc-root">
      <Nav />
      <div className="cc-wrap cc-app">
        <div className="cc-panel cc-panel-narrow">
          <h1 style={{ fontSize: 30, marginBottom: 6 }}>Join the community</h1>
          <p className="cc-note" style={{ marginBottom: 22 }}>
            Trust as the only currency. You'll be able to vouch for people and post roles.
          </p>
          <form onSubmit={submit}>
            <div className="cc-field">
              <label>Name</label>
              <input className="cc-input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="cc-field">
              <label>Email</label>
              <input className="cc-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="cc-field">
              <label>Password</label>
              <input className="cc-input" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
            </div>
            <div className="cc-field">
              <label>Which side of the house?</label>
              <div className="cc-seg">
                <button type="button" className={`cc-seg-btn${form.side === "boh" ? " active" : ""}`} onClick={() => set("side", "boh")}>
                  Back-of-house
                </button>
                <button type="button" className={`cc-seg-btn${form.side === "foh" ? " active" : ""}`} onClick={() => set("side", "foh")}>
                  Front-of-house
                </button>
              </div>
            </div>
            <div className="cc-field">
              <label>Role / title (optional)</label>
              <input className="cc-input" value={form.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} />
            </div>
            <div className="cc-field">
              <label>Current house (optional)</label>
              <input className="cc-input" value={form.employer} onChange={(e) => set("employer", e.target.value)} />
            </div>
            {error && <div className="cc-error">{error}</div>}
            <button className="cc-btn cc-btn-primary cc-btn-lg" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
          <p className="cc-note" style={{ marginTop: 18 }}>
            Already here? <a href="/login" style={{ color: "var(--cc-gold)" }}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
