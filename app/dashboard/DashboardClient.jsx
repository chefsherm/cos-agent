"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CCMark from "../components/CCMark";

export default function DashboardClient({ user }) {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [surfacing, setSurfacing] = useState(null); // roleId being surfaced
  const [results, setResults] = useState({}); // roleId -> { referrerSide, ranked, usedAi }
  const [reactivation, setReactivation] = useState(null);
  const [reactLoading, setReactLoading] = useState(false);

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((d) => setRoles(d.roles || []))
      .finally(() => setLoading(false));
  }, []);

  const surface = async (roleId) => {
    setSurfacing(roleId);
    try {
      const r = await fetch("/api/referrers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const data = await r.json();
      setResults((prev) => ({ ...prev, [roleId]: data }));
    } catch {
      setResults((prev) => ({ ...prev, [roleId]: { ranked: [], error: true } }));
    }
    setSurfacing(null);
  };

  const loadReactivation = async () => {
    setReactLoading(true);
    try {
      const r = await fetch("/api/reactivation");
      const data = await r.json();
      setReactivation(data);
    } catch {
      setReactivation({ drafts: [] });
    }
    setReactLoading(false);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const sideLabel = (s) => (s === "boh" ? "Back-of-house" : "Front-of-house");

  return (
    <div className="cc-root">
      <nav className="cc-nav">
        <Link href="/" className="cc-brand">
          <CCMark />
          Candidate Collective
        </Link>
        <div className="cc-nav-links">
          <Link href="/post-role" className="cc-btn cc-btn-primary">Post a role</Link>
          <button className="cc-btn cc-btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div className="cc-wrap cc-app">
        <div className="cc-dash-head">
          <div>
            <h1>Your roles</h1>
            <p className="cc-note">Signed in as {user.name} · {sideLabel(user.side)}</p>
          </div>
          <button className="cc-btn cc-btn-ghost" onClick={loadReactivation} disabled={reactLoading}>
            {reactLoading ? "Drafting…" : "Reactivation nudges"}
          </button>
        </div>

        {/* Reactivation drafts — for Sherm to review and send manually */}
        {reactivation && (
          <div className="cc-panel" style={{ marginBottom: 24 }}>
            <div className="cc-section-eyebrow">Dormant Referrers — drafts for manual review</div>
            <p className="cc-note" style={{ marginBottom: 14 }}>
              Nothing here is auto-sent. Review each draft and send it yourself.
            </p>
            {reactivation.drafts?.length ? (
              reactivation.drafts.map((d) => (
                <div className="cc-referrer" key={d.referrerId}>
                  <div>
                    <div className="cc-referrer-name">{d.name}</div>
                    <div className="cc-referrer-sub">{d.successfulMatches} successful match{d.successfulMatches === 1 ? "" : "es"}</div>
                    <div className="cc-referrer-reason">“{d.draft}”</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="cc-empty">No dormant high-value Referrers right now.</div>
            )}
          </div>
        )}

        {loading ? (
          <div className="cc-empty"><span className="cc-spin">↻</span> Loading…</div>
        ) : roles.length === 0 ? (
          <div className="cc-panel">
            <div className="cc-empty">
              No roles yet. <Link href="/post-role" style={{ color: "var(--cc-gold)" }}>Post your first role</Link> and CC will surface who to ask.
            </div>
          </div>
        ) : (
          roles.map((role) => {
            const res = results[role.id];
            const referrerSide = role.side === "boh" ? "front-of-house" : "back-of-house";
            return (
              <div className="cc-role-card" key={role.id}>
                <div className="cc-role-top">
                  <div>
                    <div className="cc-role-title">{role.title}</div>
                    <div className="cc-role-meta">
                      {role.venue} · surfacing {referrerSide} Referrers
                      {role.lineage_name ? ` · ${role.lineage_name} lineage` : ""}
                    </div>
                  </div>
                  <span className="cc-tag">{sideLabel(role.side)}</span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <button className="cc-btn cc-btn-ghost" onClick={() => surface(role.id)} disabled={surfacing === role.id}>
                    {surfacing === role.id ? (
                      <><span className="cc-spin">↻</span> Surfacing…</>
                    ) : (
                      "Surface Referrers to ask"
                    )}
                  </button>
                </div>

                {res && (
                  <div style={{ marginTop: 8 }}>
                    {res.error ? (
                      <div className="cc-error">Could not surface Referrers.</div>
                    ) : res.ranked?.length ? (
                      <>
                        {res.ranked.map((p) => (
                          <div className="cc-referrer" key={p.id}>
                            <div>
                              <div className="cc-referrer-name">{p.name}</div>
                              <div className="cc-referrer-sub">
                                {sideLabel(p.side)}{p.roleTitle ? ` · ${p.roleTitle}` : ""}{p.employer ? ` @ ${p.employer}` : ""}
                              </div>
                              {p.reason && <div className="cc-referrer-reason">{p.reason}</div>}
                            </div>
                            <div className="cc-referrer-dist">
                              {p.lineageVouch ?? p.bestVouch ?? "—"}
                              <small>vouch dist.</small>
                            </div>
                          </div>
                        ))}
                        <p className="cc-note" style={{ marginTop: 10 }}>
                          These are people to <strong>ask</strong> — CC recommends who is
                          well-positioned to make an introduction. It never scores a
                          candidate's quality.{res.usedAi === false ? " (Ranked by vouch distance.)" : ""}
                        </p>
                      </>
                    ) : (
                      <div className="cc-empty">
                        No {referrerSide} Referrers surfaced yet. As the Vouch Graph grows, they'll appear here.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
