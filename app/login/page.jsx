"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../components/Nav";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Login failed.");
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
          <h1 style={{ fontSize: 30, marginBottom: 22 }}>Sign in</h1>
          <form onSubmit={submit}>
            <div className="cc-field">
              <label>Email</label>
              <input className="cc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="cc-field">
              <label>Password</label>
              <input className="cc-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <div className="cc-error">{error}</div>}
            <button className="cc-btn cc-btn-primary cc-btn-lg" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="cc-note" style={{ marginTop: 18 }}>
            New here? <a href="/signup" style={{ color: "var(--cc-gold)" }}>Create an account</a>
          </p>
        </div>
      </div>
    </div>
  );
}
